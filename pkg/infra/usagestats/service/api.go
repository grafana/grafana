package service

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

const rootUrl = "/api/admin"

func (uss *UsageStats) registerAPIEndpoints() {
	authorize := accesscontrol.Middleware(uss.accesscontrol)

	uss.RouteRegister.Group(rootUrl, func(subrouter routing.RouteRegister) {
		subrouter.Get("/usage-report-preview", authorize(accesscontrol.EvalPermission(accesscontrol.ActionUsageStatsRead)), routing.Wrap(uss.getUsageReportPreview))
	})
}

func (uss *UsageStats) getUsageReportPreview(ctx *contextmodel.ReqContext) response.Response {
	ctxTracer, span := uss.tracer.Start(ctx.Req.Context(), "usageStats.getUsageReportPreview")
	defer span.End()

	usageReport, err := uss.GetUsageReport(ctxTracer)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get usage report", err)
	}

	return response.JSON(http.StatusOK, usageReport)
}
