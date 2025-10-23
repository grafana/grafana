package api

import (
	"net/http"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type API struct {
	starService star.Service
	client      K8sClients
}

func ProvideApi(
	cfg *setting.Cfg, // for namespacer
	features featuremgmt.FeatureToggles,
	starService star.Service,
	configProvider apiserver.DirectRestConfigProvider,
) *API {
	//nolint:staticcheck // using deprecated FFS service for backward compatibility
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesStars) {
		starService = nil // don't use it
	}
	return &API{
		starService: starService,
		client: &k8sClients{
			namespacer:     request.GetNamespaceMapper(cfg),
			configProvider: configProvider,
		},
	}
}

func (api *API) GetStars(c *contextmodel.ReqContext) response.Response {
	if api.starService == nil {
		stars, err := api.client.GetStars(c)
		if err != nil {
			logging.FromContext(c.Req.Context()).With("logger", "star.api").Warn("error", "err", err)
		}
		return response.JSON(http.StatusOK, stars)
	}

	query := star.GetUserStarsQuery{
		UserID: c.UserID,
	}

	iuserstars, err := api.starService.GetByUser(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get user stars", err)
	}

	uids := []string{}
	for uid := range iuserstars.UserStars {
		uids = append(uids, uid)
	}

	return response.JSON(http.StatusOK, uids)
}

// swagger:route POST /user/stars/dashboard/uid/{dashboard_uid} signed_in_user starDashboardByUID
//
// Star a dashboard.
//
// Stars the given Dashboard for the actual user.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *API) StarDashboardByUID(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if uid == "" {
		return response.Error(http.StatusBadRequest, "Invalid dashboard UID", nil)
	}

	if api.starService == nil {
		err := api.client.AddStar(c, uid)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to star dashboard", err)
		}
		return response.Success("Dashboard starred!")
	}

	userID, err := identity.UserIdentifier(c.GetID())
	if err != nil {
		return response.Error(http.StatusBadRequest, "Only users and service accounts can star dashboards", nil)
	}

	dashboardID, rsp := api.client.GetDashboardID(c, uid)
	if rsp != nil {
		return rsp
	}

	cmd := star.StarDashboardCommand{UserID: userID, DashboardID: dashboardID, DashboardUID: uid, OrgID: c.GetOrgID(), Updated: time.Now()}

	if err := api.starService.Add(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to star dashboard", err)
	}

	return response.Success("Dashboard starred!")
}

// swagger:route DELETE /user/stars/dashboard/uid/{dashboard_uid} signed_in_user unstarDashboardByUID
//
// Unstar a dashboard.
//
// Deletes the starring of the given Dashboard for the actual user.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *API) UnstarDashboardByUID(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if uid == "" {
		return response.Error(http.StatusBadRequest, "Invalid dashboard UID", nil)
	}

	if api.starService == nil {
		err := api.client.RemoveStar(c, uid)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to unstar dashboard", err)
		}
		return response.Success("Dashboard unstarred")
	}

	userID, err := identity.UserIdentifier(c.GetID())
	if err != nil {
		return response.Error(http.StatusBadRequest, "Only users and service accounts can star dashboards", nil)
	}

	cmd := star.UnstarDashboardCommand{UserID: userID, DashboardUID: uid, OrgID: c.GetOrgID()}

	if err := api.starService.Delete(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to unstar dashboard", err)
	}

	return response.Success("Dashboard unstarred")
}

// swagger:parameters starDashboard
type StarDashboardParams struct {
	// in:path
	// required:true
	DashboardID string `json:"dashboard_id"`
}

// swagger:parameters starDashboardByUID
type StarDashboardByUIDParams struct {
	// in:path
	// required:true
	DashboardUID string `json:"dashboard_uid"`
}

// swagger:parameters unstarDashboard
type UnstarDashboardParams struct {
	// in:path
	// required:true
	DashboardID string `json:"dashboard_id"`
}

// swagger:parameters unstarDashboardByUID
type UnstarDashboardByUIDParams struct {
	// in:path
	// required:true
	DashboardUID string `json:"dashboard_uid"`
}
