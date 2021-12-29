package service

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
)

const rootUrl = "/api/admin"

func (uss *UsageStats) registerAPIEndpoints() {
	uss.RouteRegister.Group(rootUrl, func(subrouter routing.RouteRegister) {
		subrouter.Get("/usage-report-preview", middleware.ReqGrafanaAdmin, routing.Wrap(uss.getUsageReportPreview))
	})
}

func (uss *UsageStats) getUsageReportPreview(ctx *models.ReqContext) response.Response {
	if !uss.Cfg.ReportingEnabled {
		return response.JSON(http.StatusUnauthorized, "Reporting is not enabled")
	}

	usageReport, err := uss.GetUsageReport(ctx.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get summary for dashboard", err)
	}

	return response.JSON(http.StatusOK, usageReport)
}
