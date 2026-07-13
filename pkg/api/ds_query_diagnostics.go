package api

import (
	"net/http"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// diagnosticsFeatureClient is a shared OpenFeature client reused across requests (its evaluations
// resolve against the current global provider), so we don't allocate one per request.
var diagnosticsFeatureClient = openfeature.NewDefaultClient()

// QueryDiagnostics is the entry point for on-demand datasource diagnostics: it will run the
// supplied datasource queries with HTTP capture active and return a diagnostic bundle (captured
// traffic, scoped logs, and the panel/dashboard JSON). Bundle generation is added in a follow-up;
// for now the endpoint only establishes the route.
//
// Two independent gates apply by design (see registerRoutes):
//   - Deployment: the route is registered only on on-prem/self-managed instances (empty StackID),
//     so it is never exposed on Grafana Cloud (where the async/HA and multi-tenant story is not
//     ready). This handler therefore never runs on Cloud.
//   - Feature availability: within on-prem, it is gated at request time on the
//     grafana.onDemandDiagnostics feature flag, so it can be toggled without re-registering routes.
//
// Access is further restricted to Grafana server admins via reqGrafanaAdmin.
func (hs *HTTPServer) QueryDiagnostics(c *contextmodel.ReqContext) response.Response {
	ctx := c.Req.Context()
	if !diagnosticsFeatureClient.Boolean(ctx, featuremgmt.FlagGrafanaOnDemandDiagnostics, false, openfeature.TransactionContext(ctx)) {
		return response.Error(http.StatusNotFound, "on-demand diagnostics is not enabled", nil)
	}

	// Bundle generation is not implemented in this scaffold; a follow-up backend PR adds it.
	return response.Error(http.StatusNotImplemented, "on-demand diagnostics is not implemented yet", nil)
}
