package dashboardsnapshots

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	snapshot "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

//go:generate mockery --name Service --structname MockService --inpackage --filename service_mock.go
type Service interface {
	CreateDashboardSnapshot(context.Context, *CreateDashboardSnapshotCommand) (*DashboardSnapshot, error)
	DeleteDashboardSnapshot(context.Context, *DeleteDashboardSnapshotCommand) error
	DeleteExpiredSnapshots(context.Context, *DeleteExpiredSnapshotsCommand) error
	GetDashboardSnapshot(context.Context, *GetDashboardSnapshotQuery) (*DashboardSnapshot, error)
	SearchDashboardSnapshots(context.Context, *GetDashboardSnapshotsQuery) (DashboardSnapshotsList, error)
	ValidateDashboardExists(context.Context, int64, string) error
}

var client = &http.Client{
	Timeout:   time.Second * 5,
	Transport: &http.Transport{Proxy: http.ProxyFromEnvironment},
}

// CreateDashboardSnapshot creates a snapshot when running Grafana in regular mode.
// It validates the user and dashboard exist before creating the snapshot.
// This mode supports both local and external snapshots.
func CreateDashboardSnapshot(c *contextmodel.ReqContext, cfg snapshot.SnapshotSharingOptions, cmd CreateDashboardSnapshotCommand, svc Service) {
	if !cfg.SnapshotsEnabled {
		c.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
		return
	}

	uid := cmd.Dashboard.GetNestedString("uid")

	user, err := identity.GetRequester(c.Req.Context())
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "missing user in context", nil)
		return
	}

	err = svc.ValidateDashboardExists(c.Req.Context(), user.GetOrgID(), uid)
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			c.JsonApiErr(http.StatusBadRequest, "Dashboard not found", err)
			return
		}
		c.JsonApiErr(http.StatusInternalServerError, "Failed to get dashboard", err)
		return
	}

	cmd.ExternalURL = ""
	cmd.OrgID = user.GetOrgID()
	cmd.UserID, _ = identity.UserIdentifier(user.GetID())

	if cmd.Name == "" {
		cmd.Name = "Unnamed snapshot"
	}

	var snapshotURL string

	if cmd.External {
		// Handle external snapshot creation
		if !cfg.ExternalEnabled {
			c.JsonApiErr(http.StatusForbidden, "External dashboard creation is disabled", nil)
			return
		}

		resp, err := createExternalDashboardSnapshot(cmd, cfg.ExternalSnapshotURL)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "Failed to create external snapshot", err)
			return
		}

		cmd.Key = resp.Key
		cmd.DeleteKey = resp.DeleteKey
		cmd.ExternalURL = resp.Url
		cmd.ExternalDeleteURL = resp.DeleteUrl
		cmd.Dashboard = &common.Unstructured{}
		snapshotURL = resp.Url

		metrics.MApiDashboardSnapshotExternal.Inc()
	} else {
		// Handle local snapshot creation
		originalDashboardURL, err := createOriginalDashboardURL(&cmd)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "Invalid app URL", err)
			return
		}

		snapshotURL, err = prepareLocalSnapshot(&cmd, originalDashboardURL)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "Could not generate random string", err)
			return
		}

		metrics.MApiDashboardSnapshotCreate.Inc()
	}

	saveAndRespond(c, svc, cmd, snapshotURL)
}

// CreateDashboardSnapshotPublic creates a snapshot when running Grafana in public mode.
// In public mode, there is no user or dashboard information to validate.
// Only local snapshots are supported (external snapshots are not available).
func CreateDashboardSnapshotPublic(c *contextmodel.ReqContext, cfg snapshot.SnapshotSharingOptions, cmd CreateDashboardSnapshotCommand, svc Service) {
	if !cfg.SnapshotsEnabled {
		c.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
		return
	}

	if cmd.Name == "" {
		cmd.Name = "Unnamed snapshot"
	}

	snapshotURL, err := prepareLocalSnapshot(&cmd, "")
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Could not generate random string", err)
		return
	}

	metrics.MApiDashboardSnapshotCreate.Inc()

	saveAndRespond(c, svc, cmd, snapshotURL)
}

// prepareLocalSnapshot prepares the command for a local snapshot and returns the snapshot URL.
func prepareLocalSnapshot(cmd *CreateDashboardSnapshotCommand, originalDashboardURL string) (string, error) {
	cmd.Dashboard.SetNestedField(originalDashboardURL, "snapshot", "originalUrl")

	if cmd.Key == "" {
		key, err := util.GetRandomString(32)
		if err != nil {
			return "", err
		}
		cmd.Key = key
	}

	if cmd.DeleteKey == "" {
		deleteKey, err := util.GetRandomString(32)
		if err != nil {
			return "", err
		}
		cmd.DeleteKey = deleteKey
	}

	return setting.ToAbsUrl("dashboard/snapshot/" + cmd.Key), nil
}

// saveAndRespond saves the snapshot and sends the response.
func saveAndRespond(c *contextmodel.ReqContext, svc Service, cmd CreateDashboardSnapshotCommand, snapshotURL string) {
	result, err := svc.CreateDashboardSnapshot(c.Req.Context(), &cmd)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Failed to create snapshot", err)
		return
	}

	c.JSON(http.StatusOK, snapshot.DashboardCreateResponse{
		Key:       result.Key,
		DeleteKey: result.DeleteKey,
		URL:       snapshotURL,
		DeleteURL: setting.ToAbsUrl("api/snapshots-delete/" + result.DeleteKey),
	})
}

var plog = log.New("external-snapshot")

func DeleteExternalDashboardSnapshot(externalUrl string) error {
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
		var respJson map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&respJson); err != nil {
			return err
		}

		if respJson["message"] == "Failed to get dashboard snapshot" {
			return nil
		}
	}

	return fmt.Errorf("unexpected response when deleting external snapshot, status code: %d", resp.StatusCode)
}

func createExternalDashboardSnapshot(cmd CreateDashboardSnapshotCommand, externalSnapshotUrl string) (*CreateExternalSnapshotResponse, error) {
	var createSnapshotResponse CreateExternalSnapshotResponse
	message := map[string]any{
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

func createOriginalDashboardURL(cmd *CreateDashboardSnapshotCommand) (string, error) {
	dashUID := cmd.Dashboard.GetNestedString("uid")
	if ok := util.IsValidShortUID(dashUID); !ok {
		return "", fmt.Errorf("invalid dashboard UID")
	}

	return fmt.Sprintf("/d/%v", dashUID), nil
}

func DeleteWithKey(ctx context.Context, key string, svc Service) error {
	query := &GetDashboardSnapshotQuery{DeleteKey: key}
	queryResult, err := svc.GetDashboardSnapshot(ctx, query)
	if err != nil {
		return err
	}

	if queryResult.External {
		err := DeleteExternalDashboardSnapshot(queryResult.ExternalDeleteURL)
		if err != nil {
			return err
		}
	}

	cmd := &DeleteDashboardSnapshotCommand{DeleteKey: queryResult.DeleteKey}

	return svc.DeleteDashboardSnapshot(ctx, cmd)
}
