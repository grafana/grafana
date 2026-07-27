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
	// PostProcessing carries the client-captured frontend pipeline evidence (transformation
	// input/output frames + applied display context) that /api/ds/query never sees because
	// transformations and field config run in the browser.
	//
	// Contract for the capture side: omit the field, or send {}, when nothing was captured. The
	// server's emptiness check is shallow (see diagnostics.hasJSONContent), so a structurally empty
	// object -- {"input":[],"output":[],"display":null} -- is treated as evidence: it earns an artifact
	// carrying nothing, and on a non-data panel a manifest error claiming evidence was discarded.
	//
	// The shape is otherwise the client's own document, embedded verbatim when it fits. Only the
	// top-level "transformations", "display", "input" and "output" keys are understood, and only to
	// decide what to drop first when a payload is over budget (see
	// diagnostics.fitPostProcessingArtifact) -- a payload using other names still round-trips intact,
	// it just degrades to markers instead of keeping its transform config.
	PostProcessing json.RawMessage `json:"postProcessing"`
}

// diagnosticsFeatureClient is a shared OpenFeature client reused across requests. Flags are
// evaluated via OpenFeature rather than featuremgmt.FeatureToggles.IsEnabled, which is deprecated
// (staticcheck SA1019) and slated for removal.
var diagnosticsFeatureClient = openfeature.NewDefaultClient()

const (
	// maxDiagnosticsBodyBytes caps the single-panel diagnostics request body. web.Bind already applies
	// the generic web.MaxBindBodyBytes (100 MiB), which is far more than this endpoint needs -- the body
	// carries one panel's queries, its panel/dashboard JSON, and the client-captured frontend pipeline
	// evidence. Scoping it down bounds what a run holds resident: the decoded payload lives for the whole
	// request, and PostProcessing in particular is client-supplied with no size the server can predict.
	maxDiagnosticsBodyBytes = 32 << 20
	// maxDashboardDiagnosticsBodyBytes is the whole-dashboard equivalent, larger because the body
	// legitimately scales with panel count (each panel carries its own queries and frontend evidence).
	// It matters more there: generation is asynchronous, so the decoded payload stays resident until the
	// archive is assembled, multiplied by up to diagnosticsMaxInFlightJobs concurrent runs.
	//
	// Note this cap is all-or-nothing where the artifact budgets in pkg/services/diagnostics degrade:
	// there is no panel-count cap yet, so a wide dashboard whose per-panel captures add up past this
	// gets a 413 and no bundle at all, rather than a bundle with truncated evidence. The capture side
	// therefore needs its own per-panel/whole-dashboard budget to stay under it -- part of the
	// "dashboard-level limits" follow-up together with the panel-count cap.
	maxDashboardDiagnosticsBodyBytes = 64 << 20
)

// bindDiagnosticsRequest caps the request body at maxBytes before decoding it into v.
//
// An over-cap body surfaces from web.Bind as *http.MaxBytesError rather than a decode failure, so it is
// reported as 413 instead of the generic 400 -- a "bad request data" on a too-large body reads as
// malformed JSON and sends a caller looking for a syntax error that isn't there.
func bindDiagnosticsRequest(c *contextmodel.ReqContext, maxBytes int64, v any) response.Response {
	c.Req.Body = http.MaxBytesReader(c.Resp, c.Req.Body, maxBytes)
	err := web.Bind(c.Req, v)
	if err == nil {
		return nil
	}
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return response.Error(http.StatusRequestEntityTooLarge,
			fmt.Sprintf("diagnostics request body exceeds the %d-byte limit", tooLarge.Limit), nil)
	}
	return response.Error(http.StatusBadRequest, "bad request data", err)
}

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
	if r := bindDiagnosticsRequest(c, maxDiagnosticsBodyBytes, &reqDTO); r != nil {
		return r
	}
	if len(reqDTO.Queries) == 0 {
		return response.Error(http.StatusBadRequest, "at least one query is required", nil)
	}

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
	if !diagnostics.HasCapturedHAR(resp, harBuffer) {
		if r := hs.diagnosticsNoCaptureError(queryErr, respErr); r != nil {
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
	bundle, err := diagnostics.NewBundler().Build(diagnostics.BuildInput{
		Resp:             resp,
		HARBuffer:        harBuffer,
		PanelJSON:        reqDTO.Panel,
		DashboardJSON:    reqDTO.Dashboard,
		QueryRequestJSON: queryRequestJSON,
		PostProcessing:   reqDTO.PostProcessing,
		QueryRequestErr:  marshalErr,
		QueryErr:         bundleErr,
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to build diagnostics bundle", err)
	}

	filename := fmt.Sprintf("diagnostics-%s.tar.gz", time.Now().UTC().Format("20060102-150405"))
	header := http.Header{}
	header.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	header.Set("Content-Type", "application/tar+gzip")
	return response.CreateNormalResponse(header, bundle, http.StatusOK)
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
