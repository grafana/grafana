package dashboardsnapshots

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	dashboardsnapshot "github.com/grafana/grafana/pkg/apis/dashboardsnapshot/v0alpha1"
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

func CreateDashboardSnapshot(c *contextmodel.ReqContext, cfg dashboardsnapshot.SnapshotSharingOptions, cmd CreateDashboardSnapshotCommand, svc Service) {
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

	if cmd.Name == "" {
		cmd.Name = "Unnamed snapshot"
	}

	var snapshotUrl string
	cmd.ExternalURL = ""
	cmd.OrgID = user.GetOrgID()
	cmd.UserID, _ = identity.UserIdentifier(user.GetID())
	originalDashboardURL, err := createOriginalDashboardURL(&cmd)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Invalid app URL", err)
		return
	}

	if cmd.External {
		if !cfg.ExternalEnabled {
			c.JsonApiErr(http.StatusForbidden, "External dashboard creation is disabled", nil)
			return
		}

		resp, err := createExternalDashboardSnapshot(cmd, cfg.ExternalSnapshotURL)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "Failed to create external snapshot", err)
			return
		}

		snapshotUrl = resp.Url
		cmd.Key = resp.Key
		cmd.DeleteKey = resp.DeleteKey
		cmd.ExternalURL = resp.Url
		cmd.ExternalDeleteURL = resp.DeleteUrl
		cmd.Dashboard = &common.Unstructured{}

		metrics.MApiDashboardSnapshotExternal.Inc()
	} else {
		cmd.Dashboard.SetNestedField(originalDashboardURL, "snapshot", "originalUrl")

		if cmd.Key == "" {
			var err error
			cmd.Key, err = util.GetRandomString(32)
			if err != nil {
				c.JsonApiErr(http.StatusInternalServerError, "Could not generate random string", err)
				return
			}
		}

		if cmd.DeleteKey == "" {
			var err error
			cmd.DeleteKey, err = util.GetRandomString(32)
			if err != nil {
				c.JsonApiErr(http.StatusInternalServerError, "Could not generate random string", err)
				return
			}
		}

		snapshotUrl = setting.ToAbsUrl("dashboard/snapshot/" + cmd.Key)

		metrics.MApiDashboardSnapshotCreate.Inc()
	}

	result, err := svc.CreateDashboardSnapshot(c.Req.Context(), &cmd)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Failed to create snapshot", err)
		return
	}

	c.JSON(http.StatusOK, dashboardsnapshot.DashboardCreateResponse{
		Key:       result.Key,
		DeleteKey: result.DeleteKey,
		URL:       snapshotUrl,
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
