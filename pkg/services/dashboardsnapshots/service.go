package dashboardsnapshots

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	snapshot "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"
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
	// perform all validations in the beginning
	if !cfg.SnapshotsEnabled {
		c.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
		return
	}
	if cmd.External && !cfg.ExternalEnabled {
		c.JsonApiErr(http.StatusForbidden, "External dashboard creation is disabled", nil)
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

	var snapshotURL string

	if cmd.External {
		resp, err := createExternalDashboardSnapshot(cmd, cfg.ExternalSnapshotURL, cfg.ExternalSnapshotToken)
		if err != nil {
			status := http.StatusInternalServerError
			message := "Failed to create external snapshot"
			var grafanaErr errutil.Error
			if errors.As(err, &grafanaErr) {
				status = grafanaErr.Reason.Status().HTTPStatus()
				message = grafanaErr.PublicMessage
			}
			c.JsonApiErr(status, message, err)
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
		originalDashboardURL, err := CreateOriginalDashboardURL(&cmd)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "Invalid app URL", err)
			return
		}

		snapshotURL, err = PrepareLocalSnapshot(&cmd, originalDashboardURL)
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

	snapshotURL, err := PrepareLocalSnapshot(&cmd, "")
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Could not generate random string", err)
		return
	}

	metrics.MApiDashboardSnapshotCreate.Inc()

	saveAndRespond(c, svc, cmd, snapshotURL)
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

var (
	ErrExternalSnapshotAuthFailed = errutil.BadGateway("dashboardsnapshots.externalAuthFailed",
		errutil.WithPublicMessage("External snapshot server rejected the request. Check external_snapshot_token configuration."),
	)
	ErrExternalSnapshotFailed = errutil.BadGateway("dashboardsnapshots.externalFailed",
		errutil.WithPublicMessage("External snapshot server returned an unexpected error."),
	)
)

func DeleteExternalDashboardSnapshot(externalUrl string) error {
	// If the stored URL is in the new K8s path format (e.g. created when the
	// kubernetesSnapshots toggle was on and now being deleted with it off), extract
	// the domain + deleteKey and rebuild as the legacy GET endpoint that this function
	// targets. Legacy-format URLs are passed through untouched.
	requestURL := externalUrl
	if !strings.Contains(externalUrl, "/api/snapshots-delete/") {
		parsed, err := url.Parse(externalUrl)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return fmt.Errorf("invalid external delete URL %q: %w", externalUrl, err)
		}
		deleteKey := path.Base(strings.TrimRight(parsed.Path, "/"))
		if deleteKey == "" || deleteKey == "." || deleteKey == "/" {
			return fmt.Errorf("could not extract delete key from URL %q", externalUrl)
		}
		requestURL = parsed.Scheme + "://" + parsed.Host + "/api/snapshots-delete/" + deleteKey
	}

	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
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

	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return ErrExternalSnapshotAuthFailed.Errorf("external snapshot server returned %d on delete", resp.StatusCode)
	}
	return ErrExternalSnapshotFailed.Errorf("unexpected response when deleting external snapshot, status code: %d", resp.StatusCode)
}

func createExternalDashboardSnapshot(cmd CreateDashboardSnapshotCommand, externalSnapshotUrl string, token string) (*CreateExternalSnapshotResponse, error) {
	var createSnapshotResponse CreateExternalSnapshotResponse

	name := cmd.Name
	if name == "" {
		name = "Unnamed snapshot"
	}

	message := map[string]any{
		"name":      name,
		"expires":   cmd.Expires,
		"dashboard": cmd.Dashboard,
		"key":       cmd.Key,
		"deleteKey": cmd.DeleteKey,
	}

	messageBytes, err := simplejson.NewFromAny(message).Encode()
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, externalSnapshotUrl+"/api/snapshots", bytes.NewBuffer(messageBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			plog.Warn("Failed to close response body", "err", err)
		}
	}()

	if resp.StatusCode != 200 {
		if resp.StatusCode == 401 || resp.StatusCode == 403 {
			return nil, ErrExternalSnapshotAuthFailed.Errorf("external snapshot server returned %d", resp.StatusCode)
		}
		return nil, ErrExternalSnapshotFailed.Errorf("external snapshot server returned status code %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(&createSnapshotResponse); err != nil {
		return nil, err
	}

	return &createSnapshotResponse, nil
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
