package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/diagnostics"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web"
)

// diagnosticsRequest is the body posted by the "Download diagnostics" panel action. It carries
// the datasource queries to run with HAR capture active, plus the optional panel and dashboard
// definitions the client already holds (so we avoid a dashboard-service lookup).
type diagnosticsRequest struct {
	dtos.MetricRequest
	Dashboard json.RawMessage `json:"dashboard"`
	Panel     json.RawMessage `json:"panel"`
	PanelData json.RawMessage `json:"panelData"`
}

// diagnosticsFeatureClient is a shared OpenFeature client reused across requests. Flags are
// evaluated via OpenFeature rather than featuremgmt.FeatureToggles.IsEnabled, which is deprecated
// (staticcheck SA1019) and slated for removal.
var diagnosticsFeatureClient = openfeature.NewDefaultClient()

// diagnosticsLogger is the named logger shared by both diagnostics endpoints, so an operator can raise
// only this feature ([log] filters = diagnostics:debug) instead of http.server as a whole.
//
// Every run reaches a terminal line here, because a failed generation is otherwise invisible on the
// server that ran it: the panel path reports the failure only in the requesting browser, and the
// dashboard path only in a job record that expires within the hour.
var diagnosticsLogger = log.New("diagnostics")

// QueryDiagnostics executes the supplied datasource queries with HAR capture active and returns a
// .tar.gz diagnostic bundle (captured traffic and the panel/dashboard JSON). Bundle assembly lives
// in the diagnostics service; this handler owns the HTTP concerns: gating, request binding, running
// the queries, and writing the response.
//
// Two independent gates apply by design; see registerRoutes for details.
func (hs *HTTPServer) QueryDiagnostics(c *contextmodel.ReqContext) response.Response {
	ctx := c.Req.Context()
	if !diagnosticsFeatureClient.Boolean(ctx, featuremgmt.FlagGrafanaOnDemandDiagnostics, false, openfeature.TransactionContext(ctx)) {
		return response.Error(http.StatusNotFound, "on-demand diagnostics is not enabled", nil)
	}

	reqDTO := diagnosticsRequest{}
	if err := web.Bind(c.Req, &reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if len(reqDTO.Queries) == 0 {
		return response.Error(http.StatusBadRequest, "at least one query is required", nil)
	}

	result := diagnostics.ResultError
	if hs.diagnosticsMetrics != nil {
		hs.diagnosticsMetrics.RecordStarted(ctx, diagnostics.ScopePanel)
		defer func() {
			hs.diagnosticsMetrics.RecordCompleted(ctx, diagnostics.ScopePanel, result)
		}()
	}

	// FromContext so the run's lines carry the request's trace ID, which is what ties them to the
	// datasource and plugin lines emitted while the queries below run.
	logger := diagnosticsLogger.FromContext(ctx)
	started := time.Now()

	captureCtx, harBuffer := harcapture.WithCapture(ctx)

	// Force a live query: a query-result cache hit returns without a datasource round trip, so HTTP
	// capture would run on nothing and traffic.har would be silently empty. Diagnostics must capture
	// what actually happens on the wire, so bypass the query cache. This is the same signal the
	// X-Cache-Skip request header feeds (see middleware.go); the Enterprise caching service reads it
	// back off the ReqContext via contexthandler.FromContext in the plugin caching middleware
	// (clientmiddleware.CachingMiddleware), and c is the same ReqContext pointer stored in the query
	// context, so mutating it here takes effect for this request.
	c.SkipQueryCache = true

	// Mirror QueryMetricsV2's dispatch (see ds_query.go) so diagnostics run the queries exactly as
	// the panel did: with per-query time ranges when the client asks for Query V2 semantics, else
	// the top-level from/to. Otherwise captured traffic wouldn't match a panel that uses per-query
	// ranges, defeating the "reproduce offline" goal.
	queryData := hs.queryDataService.QueryData
	if c.Req.Header.Get("X-Query-V2") == "true" {
		queryData = hs.queryDataService.QueryDataNew
	}
	resp, queryErr := queryData(captureCtx, c.SignedInUser, c.SkipDSCache, reqDTO.MetricRequest)

	// A datasource query usually fails per-refId (DataResponse.Error) with no top-level error, the
	// same way QueryMetricsV2 surfaces failures. Capture that too so it's recorded in the bundle. An
	// externalized plugin whose top-level QueryData error was swallowed to survive the gRPC boundary
	// carries it in the __har__ frame instead; fold that in as well.
	// Combine both: a mixed multi-datasource panel can carry a per-refId failure (ResponseError) AND
	// an external plugin's swallowed error (PluginCaptureError, from the __har__ frame) at the same
	// time, so folding in only one would drop the other from query-error.txt. errors.Join is nil-safe
	// (returns nil when both are nil).
	respErr := errors.Join(diagnostics.ResponseError(resp), diagnostics.PluginCaptureError(resp))

	// If the query failed before any traffic was captured (e.g. pre-flight access-denied or
	// datasource-not-found, which never reach the datasource), there's nothing to diagnose, so
	// surface the failure with the same status QueryMetricsV2 would return instead of a 200 bundle:
	// a top-level error keeps its typed status (403/404, else 500), while a per-refId (bad-query)
	// failure is a client error (400). A failure that did hit the wire leaves captured traffic and
	// falls through — that captured failure is exactly what the bundle is for, recorded alongside
	// query-error.txt.
	// Read before Build: collectHAR consumes the external plugins' __har__ responses out of resp, so
	// asking afterwards would report "nothing captured" for every externalized datasource.
	capturedHAR := diagnostics.HasCapturedHAR(resp, harBuffer)
	if !capturedHAR {
		if r := hs.diagnosticsNoCaptureError(queryErr, respErr); r != nil {
			logger.Warn("Panel diagnostics failed before any traffic was captured", "durationMs", time.Since(started).Milliseconds(),
				"queries", len(reqDTO.Queries), "err", errors.Join(queryErr, respErr))
			return r
		}
	}

	// Record whatever failure occurred in the bundle, preferring the top-level error.
	bundleErr := queryErr
	if bundleErr == nil {
		bundleErr = respErr
	}
	// Serializing the request must not sink a bundle that already captured HAR and a response: drop the
	// request JSON on failure but hand the error to Build so it records querydata-error.txt instead of
	// silently omitting the request, mirroring how the per-panel dashboard path isolates the same failure.
	queryRequestJSON, marshalErr := json.Marshal(reqDTO.MetricRequest)
	if marshalErr != nil {
		queryRequestJSON = nil
	}
	refs := panelEnvironmentRefs(reqDTO.MetricRequest, reqDTO.Panel)
	env := diagnostics.CollectEnvironment(ctx, hs.Cfg, hs.pluginStore, refs)
	bundle, err := diagnostics.NewBundler(env).Build(resp, harBuffer, reqDTO.Panel, reqDTO.Dashboard, queryRequestJSON, marshalErr, bundleErr,
		diagnostics.WithPanelData(reqDTO.PanelData))
	if err != nil {
		logger.Error("Failed to build panel diagnostics bundle", "durationMs", time.Since(started).Milliseconds(),
			"queries", len(reqDTO.Queries), "capturedHar", capturedHAR, "err", err)
		return response.Error(http.StatusInternalServerError, "failed to build diagnostics bundle", err)
	}
	logPanelDiagnosticsBundle(logger, panelDiagnosticsOutcome{
		durationMs:   time.Since(started).Milliseconds(),
		queries:      len(reqDTO.Queries),
		bundleBytes:  len(bundle),
		harEntries:   harBuffer.Len(),
		capturedHAR:  capturedHAR,
		queryFailed:  bundleErr != nil,
		requestError: marshalErr != nil,
	})

	filename := fmt.Sprintf("diagnostics-%s.tar.gz", time.Now().UTC().Format("20060102-150405"))
	header := http.Header{}
	header.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	header.Set("Content-Type", "application/tar+gzip")
	result = diagnostics.ResultSuccess
	return response.CreateNormalResponse(header, bundle, http.StatusOK)
}

// panelDiagnosticsOutcome is what one single-panel run produced, for the terminal log line.
type panelDiagnosticsOutcome struct {
	durationMs  int64
	queries     int
	bundleBytes int
	harEntries  int // in-process (core plugin) entries only; an externalized plugin's arrive pre-serialized
	capturedHAR bool
	// queryFailed records that the run captured a query failure; it does not record a
	// failure in generating a diagnostic bundle, which should NOT happen
	queryFailed bool
	// requestError records that the submitted queries could not be serialized, so the bundle has no
	// request to compare its captured traffic against.
	requestError bool
}

// logPanelDiagnosticsBundle logs a delivered bundle, warning when it is missing an artifact the reader
// will expect. A bundle with no traffic.har is the failure worth a warning even though the request
// succeeded: the datasource may not run its HTTP through the instrumented client (SQL and other
// non-HTTP plugins never do), or the failure may be in a call diagnostics does not capture -- and
// without this line, the only symptom is a support engineer opening an archive with nothing in it.
func logPanelDiagnosticsBundle(logger log.Logger, o panelDiagnosticsOutcome) {
	args := []any{"durationMs", o.durationMs, "queries", o.queries, "bundleBytes", o.bundleBytes,
		"harEntries", o.harEntries, "capturedHar", o.capturedHAR, "queryFailed", o.queryFailed,
		"requestSerializeFailed", o.requestError}
	if !o.capturedHAR || o.requestError {
		logger.Warn("Generated panel diagnostics bundle with missing artifacts", args...)
		return
	}
	logger.Info("Generated panel diagnostics bundle", args...)
}

// diagnosticsNoCaptureError returns the response to send when a query failed and nothing was
// captured — there is no traffic to diagnose, so surface the failure with the same status
// QueryMetricsV2 would return instead of a 200 bundle. A top-level error keeps its typed status
// (403/404, else 500) via handleQueryMetricsError; a per-refId failure is a bad query, so a client
// error (400), matching QueryMetricsV2's per-refId handling. Returns nil when nothing failed, so
// the caller proceeds to assemble the bundle.
func (hs *HTTPServer) diagnosticsNoCaptureError(queryErr, respErr error) response.Response {
	// Errors are surfaced verbatim -- redaction is intentionally deferred for this experimental
	// feature (see the harcapture package doc). A top-level error keeps its typed status via
	// handleQueryMetricsError; a per-refId failure is a client error (400).
	if queryErr != nil {
		return hs.handleQueryMetricsError(queryErr)
	}
	if respErr != nil {
		return response.Error(http.StatusBadRequest, "query failed", respErr)
	}
	return nil
}
