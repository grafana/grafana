package api

import (
	rbac "github.com/grafana/grafana/pkg/api/bmc/bhd_rbac"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
)

// Todo: Will be migrating all related report scheduler files to one single package
func (hs *HTTPServer) registerReportSchedulerPlugin() {
	reqSignedIn := middleware.ReqSignedIn
	reqGrafanaAdmin := middleware.ReqGrafanaAdmin

	r := hs.RouteRegister

	// Plugin UI Path
	r.Group("/a/reports", func(route routing.RouteRegister) {
		r.Get("/history", rbac.CanViewReportsHistory, hs.Index)
		r.Get("/settings", rbac.CanViewReportsSettings, hs.Index)
	}, rbac.CanAccessReports, reqSignedIn)

	// authed api
	r.Group("/api/v2", func(apiRoute routing.RouteRegister) {
		apiRoute.Group("/reports", func(schedulerRoute routing.RouteRegister) {
			schedulerRoute.Get("/", rbac.CanAccessReports, routing.Wrap(hs.GetAllReports))
			schedulerRoute.Get("/:id", rbac.CanAccessReports, routing.Wrap(hs.GetReportByID))
			schedulerRoute.Get("/:id/history", rbac.CanViewReportsHistory, routing.Wrap(hs.GetReportHistory))
			schedulerRoute.Get("/:id/download", rbac.CanDownloadHistoryReports, routing.Wrap(hs.GetReportJobByID))

			schedulerRoute.Post("/", rbac.CanAccessReports, routing.Wrap(hs.CreateReport))
			schedulerRoute.Put("/:id", rbac.CanAccessReports, routing.Wrap(hs.UpdateReport))
			schedulerRoute.Delete("/", rbac.CanAccessReports, routing.Wrap(hs.DeleteReport))
			schedulerRoute.Get("/users", rbac.CanManageReports, routing.Wrap(hs.GetReportUsers))
			schedulerRoute.Get("/owners", rbac.CanManageReports, routing.Wrap(hs.GetReportOwners))
			schedulerRoute.Get("/owner/:id", rbac.CanManageReports, routing.Wrap(hs.GetReportsByOwnerID))
			schedulerRoute.Post("/owner/:id", rbac.CanManageReports, routing.Wrap(hs.UpdateReportsOwner))
		})
		apiRoute.Group("/reports", func(adminRoutes routing.RouteRegister) {
			adminRoutes.Delete("/user", rbac.CanAccessReports, routing.Wrap(hs.DeleteUserFromReports))
		}, reqGrafanaAdmin)
	}, reqSignedIn)
}
