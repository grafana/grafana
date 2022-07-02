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
	"github.com/grafana/grafana/pkg/models"
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

func GetSharingOptions(c *models.ReqContext) {
	c.JSON(http.StatusOK, util.DynMap{
		"externalSnapshotURL":  setting.ExternalSnapshotUrl,
		"externalSnapshotName": setting.ExternalSnapshotName,
		"externalEnabled":      setting.ExternalEnabled,
	})
}

type CreateExternalSnapshotResponse struct {
	Key       string `json:"key"`
	DeleteKey string `json:"deleteKey"`
	Url       string `json:"url"`
	DeleteUrl string `json:"deleteUrl"`
}

func createExternalDashboardSnapshot(cmd dashboardsnapshots.CreateDashboardSnapshotCommand) (*CreateExternalSnapshotResponse, error) {
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

	response, err := client.Post(setting.ExternalSnapshotUrl+"/api/snapshots", "application/json", bytes.NewBuffer(messageBytes))
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			plog.Warn("Failed to close response body", "err", err)
		}
	}()

	if response.StatusCode != 200 {
		return nil, fmt.Errorf("create external snapshot response status code %d", response.StatusCode)
	}

	if err := json.NewDecoder(response.Body).Decode(&createSnapshotResponse); err != nil {
		return nil, err
	}

	return &createSnapshotResponse, nil
}

// POST /api/snapshots
func (hs *HTTPServer) CreateDashboardSnapshot(c *models.ReqContext) response.Response {
	cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if cmd.Name == "" {
		cmd.Name = "Unnamed snapshot"
	}

	var url string
	cmd.ExternalUrl = ""
	cmd.OrgId = c.OrgId
	cmd.UserId = c.UserId

	if cmd.External {
		if !setting.ExternalEnabled {
			c.JsonApiErr(403, "External dashboard creation is disabled", nil)
			return nil
		}

		response, err := createExternalDashboardSnapshot(cmd)
		if err != nil {
			c.JsonApiErr(500, "Failed to create external snapshot", err)
			return nil
		}

		url = response.Url
		cmd.Key = response.Key
		cmd.DeleteKey = response.DeleteKey
		cmd.ExternalUrl = response.Url
		cmd.ExternalDeleteUrl = response.DeleteUrl
		cmd.Dashboard = simplejson.New()

		metrics.MApiDashboardSnapshotExternal.Inc()
	} else {
		if cmd.Key == "" {
			var err error
			cmd.Key, err = util.GetRandomString(32)
			if err != nil {
				c.JsonApiErr(500, "Could not generate random string", err)
				return nil
			}
		}

		if cmd.DeleteKey == "" {
			var err error
			cmd.DeleteKey, err = util.GetRandomString(32)
			if err != nil {
				c.JsonApiErr(500, "Could not generate random string", err)
				return nil
			}
		}

		url = setting.ToAbsUrl("dashboard/snapshot/" + cmd.Key)

		metrics.MApiDashboardSnapshotCreate.Inc()
	}

	if err := hs.dashboardsnapshotsService.CreateDashboardSnapshot(c.Req.Context(), &cmd); err != nil {
		c.JsonApiErr(500, "Failed to create snapshot", err)
		return nil
	}

	c.JSON(http.StatusOK, util.DynMap{
		"key":       cmd.Key,
		"deleteKey": cmd.DeleteKey,
		"url":       url,
		"deleteUrl": setting.ToAbsUrl("api/snapshots-delete/" + cmd.DeleteKey),
		"id":        cmd.Result.Id,
	})
	return nil
}

// GET /api/snapshots/:key
func (hs *HTTPServer) GetDashboardSnapshot(c *models.ReqContext) response.Response {
	key := web.Params(c.Req)[":key"]
	if len(key) == 0 {
		return response.Error(404, "Snapshot not found", nil)
	}

	query := &dashboardsnapshots.GetDashboardSnapshotQuery{Key: key}

	err := hs.dashboardsnapshotsService.GetDashboardSnapshot(c.Req.Context(), query)
	if err != nil {
		return response.Error(500, "Failed to get dashboard snapshot", err)
	}

	snapshot := query.Result

	// expired snapshots should also be removed from db
	if snapshot.Expires.Before(time.Now()) {
		return response.Error(404, "Dashboard snapshot not found", err)
	}

	dto := dtos.DashboardFullWithMeta{
		Dashboard: snapshot.Dashboard,
		Meta: dtos.DashboardMeta{
			Type:       models.DashTypeSnapshot,
			IsSnapshot: true,
			Created:    snapshot.Created,
			Expires:    snapshot.Expires,
		},
	}

	metrics.MApiDashboardSnapshotGet.Inc()

	return response.JSON(http.StatusOK, dto).SetHeader("Cache-Control", "public, max-age=3600")
}

func deleteExternalDashboardSnapshot(externalUrl string) error {
	response, err := client.Get(externalUrl)
	if err != nil {
		return err
	}

	defer func() {
		if err := response.Body.Close(); err != nil {
			plog.Warn("Failed to close response body", "err", err)
		}
	}()

	if response.StatusCode == 200 {
		return nil
	}

	// Gracefully ignore "snapshot not found" errors as they could have already
	// been removed either via the cleanup script or by request.
	if response.StatusCode == 500 {
		var respJson map[string]interface{}
		if err := json.NewDecoder(response.Body).Decode(&respJson); err != nil {
			return err
		}

		if respJson["message"] == "Failed to get dashboard snapshot" {
			return nil
		}
	}

	return fmt.Errorf("unexpected response when deleting external snapshot, status code: %d", response.StatusCode)
}

// GET /api/snapshots-delete/:deleteKey
func (hs *HTTPServer) DeleteDashboardSnapshotByDeleteKey(c *models.ReqContext) response.Response {
	key := web.Params(c.Req)[":deleteKey"]
	if len(key) == 0 {
		return response.Error(404, "Snapshot not found", nil)
	}

	query := &dashboardsnapshots.GetDashboardSnapshotQuery{DeleteKey: key}
	err := hs.dashboardsnapshotsService.GetDashboardSnapshot(c.Req.Context(), query)
	if err != nil {
		return response.Error(500, "Failed to get dashboard snapshot", err)
	}

	if query.Result.External {
		err := deleteExternalDashboardSnapshot(query.Result.ExternalDeleteUrl)
		if err != nil {
			return response.Error(500, "Failed to delete external dashboard", err)
		}
	}

	cmd := &dashboardsnapshots.DeleteDashboardSnapshotCommand{DeleteKey: query.Result.DeleteKey}

	if err := hs.dashboardsnapshotsService.DeleteDashboardSnapshot(c.Req.Context(), cmd); err != nil {
		return response.Error(500, "Failed to delete dashboard snapshot", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches.",
		"id":      query.Result.Id,
	})
}

// DELETE /api/snapshots/:key
func (hs *HTTPServer) DeleteDashboardSnapshot(c *models.ReqContext) response.Response {
	key := web.Params(c.Req)[":key"]
	if len(key) == 0 {
		return response.Error(404, "Snapshot not found", nil)
	}

	query := &dashboardsnapshots.GetDashboardSnapshotQuery{Key: key}

	err := hs.dashboardsnapshotsService.GetDashboardSnapshot(c.Req.Context(), query)
	if err != nil {
		return response.Error(500, "Failed to get dashboard snapshot", err)
	}
	if query.Result == nil {
		return response.Error(404, "Failed to get dashboard snapshot", nil)
	}

	dashboardID := query.Result.Dashboard.Get("id").MustInt64()

	guardian := guardian.New(c.Req.Context(), dashboardID, c.OrgId, c.SignedInUser)
	canEdit, err := guardian.CanEdit()
	// check for permissions only if the dahboard is found
	if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
		return response.Error(500, "Error while checking permissions for snapshot", err)
	}

	if !canEdit && query.Result.UserId != c.SignedInUser.UserId && !errors.Is(err, dashboards.ErrDashboardNotFound) {
		return response.Error(403, "Access denied to this snapshot", nil)
	}

	if query.Result.External {
		err := deleteExternalDashboardSnapshot(query.Result.ExternalDeleteUrl)
		if err != nil {
			return response.Error(500, "Failed to delete external dashboard", err)
		}
	}

	cmd := &dashboardsnapshots.DeleteDashboardSnapshotCommand{DeleteKey: query.Result.DeleteKey}

	if err := hs.dashboardsnapshotsService.DeleteDashboardSnapshot(c.Req.Context(), cmd); err != nil {
		return response.Error(500, "Failed to delete dashboard snapshot", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches.",
		"id":      query.Result.Id,
	})
}

// GET /api/dashboard/snapshots
func (hs *HTTPServer) SearchDashboardSnapshots(c *models.ReqContext) response.Response {
	query := c.Query("query")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 1000
	}

	searchQuery := dashboardsnapshots.GetDashboardSnapshotsQuery{
		Name:         query,
		Limit:        limit,
		OrgId:        c.OrgId,
		SignedInUser: c.SignedInUser,
	}

	err := hs.dashboardsnapshotsService.SearchDashboardSnapshots(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(500, "Search failed", err)
	}

	dtos := make([]*dashboardsnapshots.DashboardSnapshotDTO, len(searchQuery.Result))
	for i, snapshot := range searchQuery.Result {
		dtos[i] = &dashboardsnapshots.DashboardSnapshotDTO{
			Id:          snapshot.Id,
			Name:        snapshot.Name,
			Key:         snapshot.Key,
			OrgId:       snapshot.OrgId,
			UserId:      snapshot.UserId,
			External:    snapshot.External,
			ExternalUrl: snapshot.ExternalUrl,
			Expires:     snapshot.Expires,
			Created:     snapshot.Created,
			Updated:     snapshot.Updated,
		}
	}

	return response.JSON(http.StatusOK, dtos)
}
