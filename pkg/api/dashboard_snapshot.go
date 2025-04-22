package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	dashboardsnapshot "github.com/grafana/grafana/pkg/apis/dashboardsnapshot/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

// r.Post("/api/snapshots/"
func (hs *HTTPServer) getCreatedSnapshotHandler() web.Handler {
	if hs.Features.IsEnabledGlobally(featuremgmt.FlagKubernetesSnapshots) {
		namespaceMapper := request.GetNamespaceMapper(hs.Cfg)
		return func(w http.ResponseWriter, r *http.Request) {
			user, err := identity.GetRequester(r.Context())
			if err != nil || user == nil {
				errhttp.Write(r.Context(), fmt.Errorf("no user"), w)
				return
			}
			r.URL.Path = "/apis/dashboardsnapshot.grafana.app/v0alpha1/namespaces/" +
				namespaceMapper(user.GetOrgID()) + "/dashboardsnapshots/create"
			hs.clientConfigProvider.DirectlyServeHTTP(w, r)
		}
	}
	return hs.CreateDashboardSnapshot
}

// swagger:route GET /snapshot/shared-options snapshots getSharingOptions
//
// Get snapshot sharing settings.
//
// Responses:
// 200: getSharingOptionsResponse
// 401: unauthorisedError
func (hs *HTTPServer) GetSharingOptions(c *contextmodel.ReqContext) {
	c.JSON(http.StatusOK, util.DynMap{
		"snapshotEnabled":      hs.Cfg.SnapshotEnabled,
		"externalSnapshotURL":  hs.Cfg.ExternalSnapshotUrl,
		"externalSnapshotName": hs.Cfg.ExternalSnapshotName,
		"externalEnabled":      hs.Cfg.ExternalEnabled,
	})
}

// swagger:route POST /snapshots snapshots createDashboardSnapshot
//
// When creating a snapshot using the API, you have to provide the full dashboard payload including the snapshot data. This endpoint is designed for the Grafana UI.
//
// Snapshot public mode should be enabled or authentication is required.
//
// Responses:
// 200: createDashboardSnapshotResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) CreateDashboardSnapshot(c *contextmodel.ReqContext) {
	cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		c.JsonApiErr(http.StatusBadRequest, "bad request data", err)
		return
	}

	// Do not check permissions when the instance snapshot public mode is enabled
	if !hs.Cfg.SnapshotPublicMode {
		evaluator := ac.EvalAll(ac.EvalPermission(dashboards.ActionSnapshotsCreate), ac.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(cmd.Dashboard.GetNestedString("uid"))))
		if canSave, err := hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator); err != nil || !canSave {
			c.JsonApiErr(http.StatusForbidden, "forbidden", err)
			return
		}
	}

	dashboardsnapshots.CreateDashboardSnapshot(c, dashboardsnapshot.SnapshotSharingOptions{
		SnapshotsEnabled:     hs.Cfg.SnapshotEnabled,
		ExternalEnabled:      hs.Cfg.ExternalEnabled,
		ExternalSnapshotName: hs.Cfg.ExternalSnapshotName,
		ExternalSnapshotURL:  hs.Cfg.ExternalSnapshotUrl,
	}, cmd, hs.dashboardsnapshotsService)
}

// GET /api/snapshots/:key
// swagger:route GET /snapshots/{key} snapshots getDashboardSnapshot
//
// Get Snapshot by Key.
//
// Responses:
// 200: getDashboardSnapshotResponse
// 400: badRequestError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetDashboardSnapshot(c *contextmodel.ReqContext) response.Response {
	if !hs.Cfg.SnapshotEnabled {
		c.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
		return nil
	}

	key := web.Params(c.Req)[":key"]
	if len(key) == 0 {
		return response.Error(http.StatusBadRequest, "Empty snapshot key", nil)
	}

	query := &dashboardsnapshots.GetDashboardSnapshotQuery{Key: key}

	queryResult, err := hs.dashboardsnapshotsService.GetDashboardSnapshot(c.Req.Context(), query)
	if err != nil {
		return response.Err(err)
	}

	snapshot := queryResult

	// expired snapshots should also be removed from db
	if snapshot.Expires.Before(time.Now()) {
		return response.Error(http.StatusNotFound, "Dashboard snapshot not found", err)
	}

	dto := dtos.DashboardFullWithMeta{
		Dashboard: snapshot.Dashboard,
		Meta: dtos.DashboardMeta{
			Type:       dashboards.DashTypeSnapshot,
			IsSnapshot: true,
			Created:    snapshot.Created,
			Expires:    snapshot.Expires,
		},
	}

	metrics.MApiDashboardSnapshotGet.Inc()

	return response.JSON(http.StatusOK, dto).SetHeader("Cache-Control", "public, max-age=3600")
}

// swagger:route GET /snapshots-delete/{deleteKey} snapshots deleteDashboardSnapshotByDeleteKey
//
// Delete Snapshot by deleteKey.
//
// Snapshot public mode should be enabled or authentication is required.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteDashboardSnapshotByDeleteKey(c *contextmodel.ReqContext) response.Response {
	if !hs.Cfg.SnapshotEnabled {
		c.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
		return nil
	}

	key := web.Params(c.Req)[":deleteKey"]
	if len(key) == 0 {
		return response.Error(http.StatusNotFound, "Snapshot not found", nil)
	}

	err := dashboardsnapshots.DeleteWithKey(c.Req.Context(), key, hs.dashboardsnapshotsService)
	if err != nil {
		if errors.Is(err, dashboardsnapshots.ErrBaseNotFound) {
			return response.Error(http.StatusNotFound, "Snapshot not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete dashboard snapshot", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches.",
	})
}

// swagger:route DELETE /snapshots/{key} snapshots deleteDashboardSnapshot
//
// Delete Snapshot by Key.
//
// Responses:
// 200: okResponse
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteDashboardSnapshot(c *contextmodel.ReqContext) response.Response {
	if !hs.Cfg.SnapshotEnabled {
		c.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
		return nil
	}

	key := web.Params(c.Req)[":key"]
	if len(key) == 0 {
		return response.Error(http.StatusNotFound, "Snapshot not found", nil)
	}

	query := &dashboardsnapshots.GetDashboardSnapshotQuery{Key: key}

	queryResult, err := hs.dashboardsnapshotsService.GetDashboardSnapshot(c.Req.Context(), query)
	if err != nil {
		return response.Err(err)
	}
	if queryResult == nil {
		return response.Error(http.StatusNotFound, "Failed to get dashboard snapshot", nil)
	}

	if queryResult.OrgID != c.OrgID {
		return response.Error(http.StatusUnauthorized, "OrgID mismatch", nil)
	}

	if queryResult.External {
		err := dashboardsnapshots.DeleteExternalDashboardSnapshot(queryResult.ExternalDeleteURL)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to delete external dashboard", err)
		}
	}

	// Dashboard can be empty (creation error or external snapshot). This means that the mustInt here returns a 0,
	// which before RBAC would result in a dashboard which has no ACL. A dashboard without an ACL would fallback
	// to the user’s org role, which for editors and admins would essentially always be allowed here. With RBAC,
	// all permissions must be explicit, so the lack of a rule for dashboard 0 means the guardian will reject.
	dashboardID := queryResult.Dashboard.Get("id").MustInt64()

	if dashboardID != 0 {
		evaluator := ac.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScope(strconv.FormatInt(dashboardID, 10)))
		canEdit, err := hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator)
		// check for permissions only if the dashboard is found
		if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
			return response.Error(http.StatusInternalServerError, "Error while checking permissions for snapshot", err)
		}

		if !canEdit && queryResult.UserID != c.UserID && !errors.Is(err, dashboards.ErrDashboardNotFound) {
			return response.Error(http.StatusForbidden, "Access denied to this snapshot", nil)
		}
	}

	cmd := &dashboardsnapshots.DeleteDashboardSnapshotCommand{DeleteKey: queryResult.DeleteKey}

	if err := hs.dashboardsnapshotsService.DeleteDashboardSnapshot(c.Req.Context(), cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete dashboard snapshot", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches.",
		"id":      queryResult.ID,
	})
}

// swagger:route GET /dashboard/snapshots snapshots searchDashboardSnapshots
//
// List snapshots.
//
// Responses:
// 200: searchDashboardSnapshotsResponse
// 500: internalServerError
func (hs *HTTPServer) SearchDashboardSnapshots(c *contextmodel.ReqContext) response.Response {
	if !hs.Cfg.SnapshotEnabled {
		c.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
		return nil
	}

	query := c.Query("query")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 1000
	}

	searchQuery := dashboardsnapshots.GetDashboardSnapshotsQuery{
		Name:         query,
		Limit:        limit,
		OrgID:        c.GetOrgID(),
		SignedInUser: c.SignedInUser,
	}

	searchQueryResult, err := hs.dashboardsnapshotsService.SearchDashboardSnapshots(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Search failed", err)
	}

	dto := make([]*dashboardsnapshots.DashboardSnapshotDTO, len(searchQueryResult))
	for i, snapshot := range searchQueryResult {
		dto[i] = &dashboardsnapshots.DashboardSnapshotDTO{
			ID:          snapshot.ID,
			Name:        snapshot.Name,
			Key:         snapshot.Key,
			OrgID:       snapshot.OrgID,
			UserID:      snapshot.UserID,
			External:    snapshot.External,
			ExternalURL: snapshot.ExternalURL,
			Expires:     snapshot.Expires,
			Created:     snapshot.Created,
			Updated:     snapshot.Updated,
		}
	}

	return response.JSON(http.StatusOK, dto)
}

// swagger:parameters createDashboardSnapshot
type CreateSnapshotParams struct {
	// in:body
	// required:true
	Body dashboardsnapshots.CreateDashboardSnapshotCommand `json:"body"`
}

// swagger:parameters searchDashboardSnapshots
type GetSnapshotsParams struct {
	// Search Query
	// in:query
	Query string `json:"query"`
	// Limit the number of returned results
	// in:query
	// default:1000
	Limit int64 `json:"limit"`
}

// swagger:parameters getDashboardSnapshot
type GetDashboardSnapshotParams struct {
	// in:path
	Key string `json:"key"`
}

// swagger:parameters deleteDashboardSnapshot
type DeleteDashboardSnapshotParams struct {
	// in:path
	Key string `json:"key"`
}

// swagger:parameters deleteDashboardSnapshotByDeleteKey
type DeleteSnapshotByDeleteKeyParams struct {
	// in:path
	DeleteKey string `json:"deleteKey"`
}

// swagger:response createDashboardSnapshotResponse
type CreateSnapshotResponse struct {
	// in:body
	Body struct {
		// Unique key
		Key string `json:"key"`
		// Unique key used to delete the snapshot. It is different from the key so that only the creator can delete the snapshot.
		DeleteKey string `json:"deleteKey"`
		URL       string `json:"url"`
		DeleteUrl string `json:"deleteUrl"`
		// Snapshot id
		ID int64 `json:"id"`
	} `json:"body"`
}

// swagger:response searchDashboardSnapshotsResponse
type SearchDashboardSnapshotsResponse struct {
	// in:body
	Body []*dashboardsnapshots.DashboardSnapshotDTO `json:"body"`
}

// swagger:response getDashboardSnapshotResponse
type GetDashboardSnapshotResponse DashboardResponse

// swagger:response getSharingOptionsResponse
type GetSharingOptionsResponse struct {
	// in:body
	Body struct {
		ExternalSnapshotURL  string `json:"externalSnapshotURL"`
		ExternalSnapshotName string `json:"externalSnapshotName"`
		ExternalEnabled      bool   `json:"externalEnabled"`
	} `json:"body"`
}
