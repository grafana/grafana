package api

import (
	"encoding/json"
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
}

// diagnosticsFeatureClient is a shared OpenFeature client reused across requests. Flags are
// evaluated via OpenFeature rather than featuremgmt.FeatureToggles.IsEnabled, which is deprecated
// (staticcheck SA1019) and slated for removal.
var diagnosticsFeatureClient = openfeature.NewDefaultClient()

// QueryDiagnostics executes the supplied datasource queries with HAR capture active and returns a
// .tar.gz diagnostic bundle (captured traffic and the panel/dashboard JSON). Bundle assembly lives
// in the diagnostics service; this handler owns the HTTP concerns: gating, request binding, running
// the queries, and writing the response.
//
// Two independent gates apply by design (see registerRoutes): the route is registered only on
// on-prem/self-managed instances (empty StackID) so it never runs on Grafana Cloud, and within
// on-prem it is gated at request time on the grafana.onDemandDiagnostics feature flag. Access is
// further restricted to Grafana server admins via reqGrafanaAdmin.
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

	captureCtx, harBuffer := harcapture.WithCapture(ctx)

	// Force a live query: a query-result cache hit returns without a datasource round trip, so HTTP
	// capture would run on nothing and traffic.har would be silently empty. Diagnostics must capture
	// what actually happens on the wire, so bypass the query cache. This is the same signal the
	// X-Cache-Skip request header feeds (see middleware.go); the Enterprise caching service reads it
	// back off the ReqContext via contexthandler.FromContext in the plugin caching middleware
	// (clientmiddleware.CachingMiddleware), and c is the same ReqContext pointer stored in the query
	// context, so mutating it here takes effect for this request.
	c.SkipQueryCache = true

	resp, queryErr := hs.queryDataService.QueryData(captureCtx, c.SignedInUser, c.SkipDSCache, reqDTO.MetricRequest)

	// If the query failed before any traffic was captured (e.g. pre-flight access-denied or
	// datasource-not-found, which never reach the datasource), there's nothing to diagnose, so
	// surface the real HTTP error (403/404/…) instead of a 200 bundle. A runtime failure that did
	// hit the wire leaves captured traffic (in-process buffer or an external __har__ frame) and
	// falls through — the captured failure is exactly what the bundle is for, recorded alongside
	// query-error.txt.
	if queryErr != nil && !diagnostics.HasCapturedHAR(resp, harBuffer) {
		return hs.handleQueryMetricsError(queryErr)
	}

	bundle, err := diagnostics.NewBundler().Build(resp, harBuffer, reqDTO.Panel, reqDTO.Dashboard, queryErr)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to build diagnostics bundle", err)
	}

	filename := fmt.Sprintf("diagnostics-%s.tar.gz", time.Now().UTC().Format("20060102-150405"))
	header := http.Header{}
	header.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	header.Set("Content-Type", "application/tar+gzip")
	return response.CreateNormalResponse(header, bundle, http.StatusOK)
}
