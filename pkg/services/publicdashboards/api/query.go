package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /public/dashboards/{accessToken} dashboards dashboard_public viewPublicDashboard
//
//	Get public dashboard for view
//
// Responses:
// 200: viewPublicDashboardResponse
// 400: badRequestPublicError
// 401: unauthorisedPublicError
// 403: forbiddenPublicError
// 404: notFoundPublicError
// 500: internalServerPublicError
func (api *Api) ViewPublicDashboard(c *contextmodel.ReqContext) response.Response {
	accessToken := web.Params(c.Req)[":accessToken"]
	if !validation.IsValidAccessToken(accessToken) {
		return response.Err(ErrInvalidAccessToken.Errorf("ViewPublicDashboard: invalid access token"))
	}

	dto, err := api.PublicDashboardService.GetPublicDashboardForView(c.Req.Context(), accessToken)
	if err != nil {
		return response.Err(err)
	}

	return response.JSON(http.StatusOK, dto)
}

// swagger:route POST /public/dashboards/{accessToken}/panels/{panelId}/query dashboards dashboard_public queryPublicDashboard
//
//	Get results for a given panel on a public dashboard
//
// Responses:
// 200: queryPublicDashboardResponse
// 400: badRequestPublicError
// 401: unauthorisedPublicError
// 404: panelNotFoundPublicError
// 404: notFoundPublicError
// 403: forbiddenPublicError
// 500: internalServerPublicError
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

	return toJsonStreamingResponse(c.Req.Context(), api.features, resp)
}

// swagger:route GET /public/dashboards/{accessToken}/annotations dashboards annotations dashboard_public getPublicAnnotations
//
//	Get annotations for a public dashboard
//
// Responses:
// 200: getPublicAnnotationsResponse
// 400: badRequestPublicError
// 404: notFoundPublicError
// 401: unauthorisedPublicError
// 403: forbiddenPublicError
// 500: internalServerPublicError
func (api *Api) GetPublicAnnotations(c *contextmodel.ReqContext) response.Response {
	accessToken := web.Params(c.Req)[":accessToken"]
	if !validation.IsValidAccessToken(accessToken) {
		return response.Err(ErrInvalidAccessToken.Errorf("GetPublicAnnotations: invalid access token"))
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

// swagger:response viewPublicDashboardResponse
type ViewPublicDashboardResponse struct {
	// in: body
	Body dtos.DashboardFullWithMeta `json:"body"`
}

// swagger:parameters viewPublicDashboard
type ViewPublicDashboardParams struct {
	// in: path
	AccessToken string `json:"accessToken"`
}

// swagger:response queryPublicDashboardResponse
type QueryPublicDashboardResponse struct {
	// in: body
	Body backend.QueryDataResponse `json:"body"`
}

// swagger:parameters queryPublicDashboard
type QueryPublicDashboardParams struct {
	// in: path
	AccessToken string `json:"accessToken"`
	// in: path
	PanelId int64 `json:"panelId"`
}

// swagger:response getPublicAnnotationsResponse
type GetPublicAnnotationsResponse struct {
	// in: body
	Body []AnnotationEvent `json:"body"`
}

// swagger:parameters getPublicAnnotations
type GetPublicAnnotationsParams struct {
	// in: path
	AccessToken string `json:"accessToken"`
}
