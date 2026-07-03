package api

import (
	"net/http"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// QueryDiagnostics is the entry point for on-demand datasource diagnostics: it will run the
// supplied datasource queries with HTTP capture active and return a diagnostic bundle (captured
// traffic, scoped logs, and the panel/dashboard JSON). Bundle generation is added in a follow-up;
// for now the endpoint only establishes the flag-gated, admin-only route.
//
// The route is always registered but gated at request time on the grafana.onDemandDiagnostics
// feature flag, so enabling or disabling the flag takes effect without a server restart. Access is
// restricted to Grafana server admins via reqGrafanaAdmin (see registerRoutes).
func (hs *HTTPServer) QueryDiagnostics(c *contextmodel.ReqContext) response.Response {
	ctx := c.Req.Context()
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagGrafanaOnDemandDiagnostics, false, openfeature.TransactionContext(ctx)) {
		return response.Error(http.StatusNotFound, "on-demand diagnostics is not enabled", nil)
	}

	// Bundle generation is not implemented in this scaffold; a follow-up backend PR adds it.
	return response.Error(http.StatusNotImplemented, "on-demand diagnostics is not implemented yet", nil)
}
