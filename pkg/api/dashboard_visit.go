package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) VisitDashboard(c *models.ReqContext) Response {
	dashboardId := c.ParamsInt64(":dashboardId")
	visitDashboardCommand := &models.VisitDashboardCommand{
		UserId:      c.UserId,
		OrgId:       c.OrgId,
		DashboardId: dashboardId,
	}

	if err := bus.Dispatch(visitDashboardCommand); err != nil {
		hs.log.Warn("Failed to mark dashboard as visited", "userId", c.UserId, "orgId", c.OrgId, "dashboardId", dashboardId, "err", err)
	}

	return Success("")
}
