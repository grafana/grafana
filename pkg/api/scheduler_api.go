package api

import (
	rbac "github.com/grafana/grafana/pkg/api/bmc/bhd_rbac"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
)

func (hs *HTTPServer) registerSchedulerRoutes() {
	reqSignedIn := middleware.ReqSignedIn
	reqGrafanaAdmin := middleware.ReqGrafanaAdmin

	r := hs.RouteRegister

	// authed api
	r.Group("/api", func(apiRoute routing.RouteRegister) {

		apiRoute.Group("/reports/:id", func(schedulerRoute routing.RouteRegister) {
			schedulerRoute.Get("/job", routing.Wrap(hs.GetReportHistory))
		}, rbac.CanAccessReports)

		apiRoute.Group("/reports/job", func(schedulerRoute routing.RouteRegister) {
			schedulerRoute.Get("/info", routing.Wrap(hs.GetReportListJobQueue))
			schedulerRoute.Get("/info/:id", routing.Wrap(hs.GetRSJobQueueByJobId))
		}, rbac.CanViewReportsHistory)

		// APIs for storing ftp configuration (org admin permission required)
		apiRoute.Group("/reports/config", func(schedulerRoute routing.RouteRegister) {
			schedulerRoute.Get("/ftp", rbac.CanAccessReports, routing.Wrap(hs.GetFTPConfig))
			schedulerRoute.Post("/ftp", rbac.CanWriteReportsSettings, routing.Wrap(hs.SetFTPConfig))
			schedulerRoute.Put("/ftp", rbac.CanWriteReportsSettings, routing.Wrap(hs.ModifyFTPConfig))
			schedulerRoute.Post("/ftp/default", rbac.CanWriteReportsSettings, routing.Wrap(hs.SetDefaultFTPConfig))
			schedulerRoute.Delete("/ftp/:id", rbac.CanWriteReportsSettings, routing.Wrap(hs.DeleteFTPConfig))
		})

		// Report Job Queue/Status (grafana admin permission required).
		// This endpoint will be responsible for creating/updating the executed job status
		apiRoute.Group("/reports/job", func(schedulerRoute routing.RouteRegister) {
			// Add a job in job_queue table as a report scheduler job whenever the process starts
			// And then update it whenever the process finish.
			schedulerRoute.Post("/new", routing.Wrap(hs.InsertRSJobQueue))
			schedulerRoute.Put("/edit", routing.Wrap(hs.UpdateRSJobQueue))
			// Add new status to the related job-queue whenever the job stat changes
			// This will let us know where the report scheduler process has reached
			// such as `started generating report`, `finished generating report`, `broadcasting mail`, etc...
			// also, it will also update if something fail to let us know the reason behind the failure...
			schedulerRoute.Post("/status/new", routing.Wrap(hs.InsertRSJobStatus))
		}, reqGrafanaAdmin)

		apiRoute.Group("/reports", func(schedulerRoute routing.RouteRegister) {
			schedulerRoute.Delete("/orgId/:orgId/isOffboarded/:isOffboarded", routing.Wrap(hs.RemoveOrDisableOrgSchedules))
		}, reqGrafanaAdmin)

		// ReportScheduler Schedulers	 (org admin permission required)
		// This API routing group is reachable with all the roles, it will
		// return the list of scheduled report of the related tenant.
		apiRoute.Group("/reports", func(schedulerRoute routing.RouteRegister) {
			schedulerRoute.Post("/mail", rbac.CanAccessReports, routing.Wrap(hs.ReportSendMail))
			schedulerRoute.Post("/execute", rbac.CanAccessReports, routing.Wrap(hs.ReportExecuteOnce))
			schedulerRoute.Get("/tenant/users", rbac.CanAccessReports, routing.Wrap(hs.GetTenantUsers))

			schedulerRoute.Post("/delete/dashboard", routing.Wrap(hs.DeleteRSByDashIds))
			schedulerRoute.Post("/enable", rbac.CanAccessReports, routing.Wrap(hs.EnableRS))
			schedulerRoute.Post("/disable", rbac.CanAccessReports, routing.Wrap(hs.DisableRS))
		})

		apiRoute.Group("/reports/settings/branding", func(branding routing.RouteRegister) {
			branding.Get("/", rbac.CanViewReportsSettings, routing.Wrap(hs.GetReportBrandingSettings))
			branding.Post("/", rbac.CanWriteReportsSettings, routing.Wrap(hs.SetReportBrandingSettings))
			branding.Delete("/", rbac.CanWriteReportsSettings, routing.Wrap(hs.DeleteReportBrandingSettings))
		})

		apiRoute.Group("/reports/settings/inline_branding_logo", func(branding routing.RouteRegister) {
			branding.Get("/", rbac.CanViewReportsSettings, hs.GetImageLogo)
		})

		apiRoute.Group("/reports/tenant_details", func(branding routing.RouteRegister) {
			branding.Post("/", routing.Wrap(hs.CreateOrUpdateReportTenantDetails))
			branding.Delete("/", routing.Wrap(hs.DeleteReportTenantDetails))
		}, reqGrafanaAdmin)

		apiRoute.Group("/reports", func(schedulerRoute routing.RouteRegister) {
			schedulerRoute.Post("/preview", routing.Wrap(hs.ReportPDFPreview))
		}, rbac.CanDownloadReports)

	}, reqSignedIn)
}
