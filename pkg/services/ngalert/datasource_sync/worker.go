// Package datasource_sync provides a background worker that periodically fetches
// Mimir Alertmanager configuration from configured datasources and mirrors it
// as ExtraConfiguration in Grafana.
package datasource_sync

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"time"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
)

// ExtraConfigApplier applies an ExtraConfiguration to an org's alertmanager.
type ExtraConfigApplier interface {
	SaveAndApplyExtraConfiguration(ctx context.Context, org int64, extraConfig apimodels.ExtraConfiguration, replace bool, dryRun bool) (definition.RenameResources, error)
}

// Worker polls configured Mimir Alertmanager datasources and syncs their
// configuration as ExtraConfiguration in Grafana.
type Worker struct {
	store             store.DatasourceSyncStore
	applier           ExtraConfigApplier
	datasourceService datasources.DataSourceService
	secretService     secrets.Service
	featureManager    featuremgmt.FeatureToggles
	pollInterval      time.Duration
	logger            log.Logger
	httpClient        *http.Client
}

// New creates a new datasource sync Worker.
func New(
	syncStore store.DatasourceSyncStore,
	applier ExtraConfigApplier,
	datasourceService datasources.DataSourceService,
	secretService secrets.Service,
	featureManager featuremgmt.FeatureToggles,
	pollInterval time.Duration,
) *Worker {
	return &Worker{
		store:             syncStore,
		applier:           applier,
		datasourceService: datasourceService,
		secretService:     secretService,
		featureManager:    featureManager,
		pollInterval:      pollInterval,
		logger:            log.New("ngalert.datasource_sync"),
		httpClient:        &http.Client{Timeout: 30 * time.Second},
	}
}

// Run starts the polling loop. It blocks until ctx is cancelled.
func (w *Worker) Run(ctx context.Context) error {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !w.featureManager.IsEnabledGlobally(featuremgmt.FlagAlertingDatasourceSync) {
		w.logger.Debug("Datasource sync feature flag disabled, worker not running")
		return nil
	}

	w.logger.Info("Starting datasource sync worker", "poll_interval", w.pollInterval)
	for {
		select {
		case <-time.After(w.pollInterval):
			if err := w.SyncAll(ctx); err != nil {
				w.logger.Error("Failed to sync datasource configurations", "error", err)
			}
		case <-ctx.Done():
			return nil
		}
	}
}

// SyncAll fetches all enabled datasource sync configurations and syncs each one.
func (w *Worker) SyncAll(ctx context.Context) error {
	syncs, err := w.store.GetAllDatasourceSyncs(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch datasource sync configurations: %w", err)
	}

	for _, s := range syncs {
		if !s.Enabled {
			continue
		}
		if err := w.syncOne(ctx, s); err != nil {
			w.logger.Error("Failed to sync datasource configuration", "org_id", s.OrgID, "datasource_uid", s.DatasourceUID, "error", err)
		}
	}
	return nil
}

// syncOne fetches and applies the Mimir AM configuration for a single org.
func (w *Worker) syncOne(ctx context.Context, s *ngmodels.DatasourceSync) error {
	ds, err := w.datasourceService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		UID:   s.DatasourceUID,
		OrgID: s.OrgID,
	})
	if err != nil {
		syncErr := fmt.Sprintf("failed to get datasource: %s", err)
		_ = w.store.UpdateDatasourceSyncStatus(ctx, s.OrgID, time.Now(), syncErr)
		return fmt.Errorf("org %d: %s", s.OrgID, syncErr)
	}

	cfg, err := w.fetchMimirConfig(ctx, ds)
	if err != nil {
		syncErr := fmt.Sprintf("failed to fetch Mimir config: %s", err)
		_ = w.store.UpdateDatasourceSyncStatus(ctx, s.OrgID, time.Now(), syncErr)
		return fmt.Errorf("org %d datasource %s: %s", s.OrgID, s.DatasourceUID, syncErr)
	}

	ec := apimodels.ExtraConfiguration{
		Identifier:         s.DatasourceUID,
		AlertmanagerConfig: cfg.AlertmanagerConfig,
		TemplateFiles:      cfg.TemplateFiles,
	}

	if _, err := w.applier.SaveAndApplyExtraConfiguration(ctx, s.OrgID, ec, true, false); err != nil {
		syncErr := fmt.Sprintf("failed to apply config: %s", err)
		_ = w.store.UpdateDatasourceSyncStatus(ctx, s.OrgID, time.Now(), syncErr)
		return fmt.Errorf("org %d datasource %s: %s", s.OrgID, s.DatasourceUID, syncErr)
	}

	w.logger.Info("Synced datasource configuration", "org_id", s.OrgID, "datasource_uid", s.DatasourceUID)
	return w.store.UpdateDatasourceSyncStatus(ctx, s.OrgID, time.Now(), "")
}

// mimirConfigResponse is the Mimir alertmanager configuration API response.
type mimirConfigResponse struct {
	AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
}

// fetchMimirConfig fetches the alertmanager configuration from a Mimir datasource.
// It calls GET /alertmanager/api/v1/alerts on the Mimir instance.
func (w *Worker) fetchMimirConfig(ctx context.Context, ds *datasources.DataSource) (*mimirConfigResponse, error) {
	configURL, err := w.buildConfigURL(ds)
	if err != nil {
		return nil, fmt.Errorf("failed to build config URL: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, configURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Add basic auth if enabled.
	if ds.BasicAuth {
		password := w.secretService.GetDecryptedValue(ctx, ds.SecureJsonData, "basicAuthPassword", "")
		req.SetBasicAuth(ds.BasicAuthUser, password)
	}

	// Add custom headers (e.g. X-Scope-OrgID for Mimir multi-tenancy).
	headers, err := w.datasourceService.CustomHeaders(ctx, ds)
	if err != nil {
		return nil, fmt.Errorf("failed to get custom headers: %w", err)
	}
	for key, values := range headers {
		for _, v := range values {
			req.Header.Add(key, v)
		}
	}

	req.Header.Set("Accept", "application/json")

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("unexpected HTTP status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var cfg mimirConfigResponse
	if err := json.Unmarshal(body, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &cfg, nil
}

// buildConfigURL constructs the Mimir alertmanager configuration API URL.
// For Mimir/Cortex datasources the config endpoint is /api/v1/alerts relative
// to the alertmanager base path.
func (w *Worker) buildConfigURL(ds *datasources.DataSource) (string, error) {
	parsed, err := datasource.ValidateURL(datasources.DS_ALERTMANAGER, ds.URL)
	if err != nil {
		return "", fmt.Errorf("failed to parse datasource URL: %w", err)
	}

	// For Mimir/Cortex, the alertmanager is under /alertmanager.
	if ds.JsonData != nil {
		impl := ds.JsonData.Get("implementation").MustString("")
		switch impl {
		case "mimir", "cortex":
			if parsed.Path == "" {
				parsed.Path = "/"
			}
			lastSegment := path.Base(parsed.Path)
			if lastSegment != "alertmanager" {
				parsed = parsed.JoinPath("/alertmanager")
			}
		}
	}

	return parsed.JoinPath("/api/v1/alerts").String(), nil
}
