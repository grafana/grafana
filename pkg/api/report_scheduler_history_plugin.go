package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bmc"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetReportHistory(c *contextmodel.ReqContext) response.Response {
	id, err := util.ParamsInt64(web.Params(c.Req)[":id"])
	if err != nil {
		return hs.FailResponse(models.ErrInvalidId)
	}

	query := &bmc.GetReportHistory{
		OrgID:    c.OrgID,
		UserID:   c.UserID,
		ReportID: id,
		IsAdmin:  c.HasRole(org.RoleAdmin),
	}
	if err := hs.sqlStore.GetReportHistory(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}

	return hs.SuccessResponse(query.Results)
}
