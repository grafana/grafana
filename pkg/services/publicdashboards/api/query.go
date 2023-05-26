package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/web"
)

// ViewPublicDashboard Gets public dashboard
// GET /api/public/dashboards/:accessToken
func (api *Api) ViewPublicDashboard(c *contextmodel.ReqContext) response.Response {
	accessToken := web.Params(c.Req)[":accessToken"]
	if !validation.IsValidAccessToken(accessToken) {
		return response.Err(ErrInvalidAccessToken.Errorf("ViewPublicDashboard: invalid access token"))
	}

	pubdash, dash, err := api.PublicDashboardService.FindEnabledPublicDashboardAndDashboardByAccessToken(
		c.Req.Context(),
		accessToken,
	)
	if err != nil {
		return response.Err(err)
	}

	meta := dtos.DashboardMeta{
		Slug:                       dash.Slug,
		Type:                       dashboards.DashTypeDB,
		CanStar:                    false,
		CanSave:                    false,
		CanEdit:                    false,
		CanAdmin:                   false,
		CanDelete:                  false,
		Created:                    dash.Created,
		Updated:                    dash.Updated,
		Version:                    dash.Version,
		IsFolder:                   false,
		FolderId:                   dash.FolderID,
		PublicDashboardAccessToken: pubdash.AccessToken,
		PublicDashboardEnabled:     pubdash.IsEnabled,
	}
	dash.Data.Get("timepicker").Set("hidden", !pubdash.TimeSelectionEnabled)

	dto := dtos.DashboardFullWithMeta{Meta: meta, Dashboard: dash.Data}

	return response.JSON(http.StatusOK, dto)
}

// QueryPublicDashboard returns all results for a given panel on a public dashboard
// POST /api/public/dashboard/:accessToken/panels/:panelId/query
func (api *Api) QueryPublicDashboard(c *contextmodel.ReqContext) response.Response {
	accessToken := web.Params(c.Req)[":accessToken"]
	if !validation.IsValidAccessToken(accessToken) {
		return response.Err(ErrInvalidAccessToken.Errorf("QueryPublicDashboard: invalid access token"))
	}

	panelId, err := strconv.ParseInt(web.Params(c.Req)[":panelId"], 10, 64)
	if err != nil {
		return response.Err(ErrInvalidPanelId.Errorf("QueryPublicDashboard: error parsing panelId %v", err))
	}

	reqDTO := PublicDashboardQueryDTO{}
	if err = web.Bind(c.Req, &reqDTO); err != nil {
		return response.Err(ErrBadRequest.Errorf("QueryPublicDashboard: error parsing request: %v", err))
	}

	resp, err := api.PublicDashboardService.GetQueryDataResponse(c.Req.Context(), c.SkipDSCache, reqDTO, panelId, accessToken)
	if err != nil {
		return response.Err(err)
	}

	return toJsonStreamingResponse(api.Features, resp)
}

// GetAnnotations returns annotations for a public dashboard
// GET /api/public/dashboards/:accessToken/annotations
func (api *Api) GetAnnotations(c *contextmodel.ReqContext) response.Response {
	accessToken := web.Params(c.Req)[":accessToken"]
	if !validation.IsValidAccessToken(accessToken) {
		return response.Err(ErrInvalidAccessToken.Errorf("GetAnnotations: invalid access token"))
	}

	reqDTO := AnnotationsQueryDTO{
		From: c.QueryInt64("from"),
		To:   c.QueryInt64("to"),
	}

	annotations, err := api.PublicDashboardService.FindAnnotations(c.Req.Context(), reqDTO, accessToken)
	if err != nil {
		return response.Err(err)
	}

	return response.JSON(http.StatusOK, annotations)
}
