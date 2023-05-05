package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var client = &http.Client{
	Timeout:   time.Second * 5,
	Transport: &http.Transport{Proxy: http.ProxyFromEnvironment},
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

type CreateExternalSnapshotResponse struct {
	Key       string `json:"key"`
	DeleteKey string `json:"deleteKey"`
	Url       string `json:"url"`
	DeleteUrl string `json:"deleteUrl"`
}

func createExternalDashboardSnapshot(cmd dashboardsnapshots.CreateDashboardSnapshotCommand, externalSnapshotUrl string) (*CreateExternalSnapshotResponse, error) {
	var createSnapshotResponse CreateExternalSnapshotResponse
	message := map[string]interface{}{
		"name":      cmd.Name,
		"expires":   cmd.Expires,
		"dashboard": cmd.Dashboard,
		"key":       cmd.Key,
		"deleteKey": cmd.DeleteKey,
	}

	messageBytes, err := simplejson.NewFromAny(message).Encode()
	if err != nil {
		return nil, err
	}

	resp, err := client.Post(externalSnapshotUrl+"/api/snapshots", "application/json", bytes.NewBuffer(messageBytes))
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			plog.Warn("Failed to close response body", "err", err)
		}
	}()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("create external snapshot response status code %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(&createSnapshotResponse); err != nil {
		return nil, err
	}

	return &createSnapshotResponse, nil
}

func createOriginalDashboardURL(cmd *dashboardsnapshots.CreateDashboardSnapshotCommand) (string, error) {
	dashUID := cmd.Dashboard.Get("uid").MustString("")
	if ok := util.IsValidShortUID(dashUID); !ok {
		return "", fmt.Errorf("invalid dashboard UID")
	}

	return fmt.Sprintf("/d/%v", dashUID), nil
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
func (hs *HTTPServer) CreateDashboardSnapshot(c *contextmodel.ReqContext) response.Response {
	if !hs.Cfg.SnapshotEnabled {
		c.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
		return nil
	}

	cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if cmd.Name == "" {
		cmd.Name = "Unnamed snapshot"
	}

	var snapshotUrl string
	cmd.ExternalURL = ""
	cmd.OrgID = c.OrgID
	cmd.UserID = c.UserID
	originalDashboardURL, err := createOriginalDashboardURL(&cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Invalid app URL", err)
	}

	if cmd.External {
		if !hs.Cfg.ExternalEnabled {
			c.JsonApiErr(http.StatusForbidden, "External dashboard creation is disabled", nil)
			return nil
		}

		resp, err := createExternalDashboardSnapshot(cmd, hs.Cfg.ExternalSnapshotUrl)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "Failed to create external snapshot", err)
			return nil
		}

		snapshotUrl = resp.Url
		cmd.Key = resp.Key
		cmd.DeleteKey = resp.DeleteKey
		cmd.ExternalURL = resp.Url
		cmd.ExternalDeleteURL = resp.DeleteUrl
		cmd.Dashboard = simplejson.New()

		metrics.MApiDashboardSnapshotExternal.Inc()
	} else {
		cmd.Dashboard.SetPath([]string{"snapshot", "originalUrl"}, originalDashboardURL)

		if cmd.Key == "" {
			var err error
			cmd.Key, err = util.GetRandomString(32)
			if err != nil {
				c.JsonApiErr(http.StatusInternalServerError, "Could not generate random string", err)
				return nil
			}
		}

		if cmd.DeleteKey == "" {
			var err error
			cmd.DeleteKey, err = util.GetRandomString(32)
			if err != nil {
				c.JsonApiErr(http.StatusInternalServerError, "Could not generate random string", err)
				return nil
			}
		}

		snapshotUrl = setting.ToAbsUrl("dashboard/snapshot/" + cmd.Key)

		metrics.MApiDashboardSnapshotCreate.Inc()
	}

	result, err := hs.dashboardsnapshotsService.CreateDashboardSnapshot(c.Req.Context(), &cmd)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Failed to create snapshot", err)
		return nil
	}

	c.JSON(http.StatusOK, util.DynMap{
		"key":       cmd.Key,
		"deleteKey": cmd.DeleteKey,
		"url":       snapshotUrl,
		"deleteUrl": setting.ToAbsUrl("api/snapshots-delete/" + cmd.DeleteKey),
		"id":        result.ID,
	})
	return nil
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
		return response.Error(404, "Dashboard snapshot not found", err)
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

func deleteExternalDashboardSnapshot(externalUrl string) error {
	resp, err := client.Get(externalUrl)
	if err != nil {
		return err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			plog.Warn("Failed to close response body", "err", err)
		}
	}()

	if resp.StatusCode == 200 {
		return nil
	}

	// Gracefully ignore "snapshot not found" errors as they could have already
	// been removed either via the cleanup script or by request.
	if resp.StatusCode == 500 {
		var respJson map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&respJson); err != nil {
			return err
		}

		if respJson["message"] == "Failed to get dashboard snapshot" {
			return nil
		}
	}

	return fmt.Errorf("unexpected response when deleting external snapshot, status code: %d", resp.StatusCode)
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
		return response.Error(404, "Snapshot not found", nil)
	}

	query := &dashboardsnapshots.GetDashboardSnapshotQuery{DeleteKey: key}
	queryResult, err := hs.dashboardsnapshotsService.GetDashboardSnapshot(c.Req.Context(), query)
	if err != nil {
		return response.Err(err)
	}

	if queryResult.External {
		err := deleteExternalDashboardSnapshot(queryResult.ExternalDeleteURL)
		if err != nil {
			return response.Error(500, "Failed to delete external dashboard", err)
		}
	}

	cmd := &dashboardsnapshots.DeleteDashboardSnapshotCommand{DeleteKey: queryResult.DeleteKey}

	if err := hs.dashboardsnapshotsService.DeleteDashboardSnapshot(c.Req.Context(), cmd); err != nil {
		return response.Error(500, "Failed to delete dashboard snapshot", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches.",
		"id":      queryResult.ID,
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

	if queryResult.External {
		err := deleteExternalDashboardSnapshot(queryResult.ExternalDeleteURL)
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
		g, err := guardian.New(c.Req.Context(), dashboardID, c.OrgID, c.SignedInUser)
		if err != nil {
			if !errors.Is(err, dashboards.ErrDashboardNotFound) {
				return response.Err(err)
			}
		} else {
			canEdit, err := g.CanEdit()
			// check for permissions only if the dashboard is found
			if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
				return response.Error(http.StatusInternalServerError, "Error while checking permissions for snapshot", err)
			}

			if !canEdit && queryResult.UserID != c.SignedInUser.UserID && !errors.Is(err, dashboards.ErrDashboardNotFound) {
				return response.Error(http.StatusForbidden, "Access denied to this snapshot", nil)
			}
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
		OrgID:        c.OrgID,
		SignedInUser: c.SignedInUser,
	}

	searchQueryResult, err := hs.dashboardsnapshotsService.SearchDashboardSnapshots(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(500, "Search failed", err)
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
