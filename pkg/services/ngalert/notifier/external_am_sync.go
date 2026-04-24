package notifier

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/open-feature/go-sdk/openfeature"
)

// mimirConfigResponse is the Mimir/Cortex alertmanager configuration API response.
type mimirConfigResponse struct {
	AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
}

// syncExternalAMs fetches the alertmanager configuration from an external Mimir/Cortex datasource
// for each org that has one configured and persists it to the database. The main sync loop then
// picks up the fresh config and applies it on the same tick. It is a no-op when the feature flag
// is disabled. Per-org errors are logged and do not abort other orgs.
func (moa *MultiOrgAlertmanager) syncExternalAMs(ctx context.Context, orgIDs []int64) {
	client := openfeature.NewDefaultClient()
	if !client.Boolean(ctx, featuremgmt.FlagAlertingSyncExternalAlertmanager, false, openfeature.TransactionContext(ctx)) {
		return
	}

	adminCfgs, err := moa.adminConfigStore.GetAdminConfigurations()
	if err != nil {
		moa.logger.Warn("Failed to fetch admin configurations for external AM sync", "error", err)
		return
	}

	adminCfgsByOrg := make(map[int64]*models.AdminConfiguration, len(adminCfgs))
	for _, cfg := range adminCfgs {
		adminCfgsByOrg[cfg.OrgID] = cfg
	}

	for _, orgID := range orgIDs {
		uid := moa.resolveExternalAMUID(orgID, adminCfgsByOrg)
		if uid == "" {
			continue
		}

		start := time.Now()

		ec, err := moa.fetchExtraConfig(ctx, orgID, uid)
		if err != nil {
			moa.logger.Warn("Failed to fetch external AM configuration", "org_id", orgID, "error", err)
			moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues(fmt.Sprintf("%d", orgID), "error").Inc()
			moa.metrics.ExternalAMConfigSyncDuration.Observe(time.Since(start).Seconds())
			continue
		}

		if err = moa.SaveExtraConfiguration(ctx, orgID, *ec); err != nil {
			moa.logger.Warn("Failed to save external AM configuration", "org_id", orgID, "error", err)
			moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues(fmt.Sprintf("%d", orgID), "error").Inc()
			moa.metrics.ExternalAMConfigSyncDuration.Observe(time.Since(start).Seconds())
			continue
		}

		moa.logger.Info("Synced external AM configuration", "org_id", orgID, "duration_ms", time.Since(start).Milliseconds())
		moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues(fmt.Sprintf("%d", orgID), "success").Inc()
		moa.metrics.ExternalAMConfigSyncDuration.Observe(time.Since(start).Seconds())
	}
}

// resolveExternalAMUID returns the datasource UID to use for external AM sync for the given org.
// The operator-level ExternalAlertmanagerUID setting takes precedence over the per-org DB value.
// Returns "" when neither is set, signalling that sync should be skipped for this org.
func (moa *MultiOrgAlertmanager) resolveExternalAMUID(orgID int64, adminCfgsByOrg map[int64]*models.AdminConfiguration) string {
	if uid := moa.settings.UnifiedAlerting.ExternalAlertmanagerUID; uid != "" {
		return uid
	}
	if cfg, ok := adminCfgsByOrg[orgID]; ok && cfg.ExternalAlertmanagerUID != nil {
		return *cfg.ExternalAlertmanagerUID
	}
	return ""
}

// fetchExtraConfig retrieves the Mimir/Cortex alertmanager configuration for a single org
// and returns it as an ExtraConfiguration. Uses a 10-second per-org timeout.
func (moa *MultiOrgAlertmanager) fetchExtraConfig(ctx context.Context, orgID int64, datasourceUID string) (*apimodels.ExtraConfiguration, error) {
	fetchCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	ds, err := moa.datasourceService.GetDataSource(fetchCtx, &datasources.GetDataSourceQuery{
		UID:   datasourceUID,
		OrgID: orgID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get datasource: %w", err)
	}

	cfg, err := moa.fetchMimirConfig(fetchCtx, ds)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Mimir config: %w", err)
	}

	return &apimodels.ExtraConfiguration{
		Identifier:         datasourceUID,
		AlertmanagerConfig: cfg.AlertmanagerConfig,
		TemplateFiles:      cfg.TemplateFiles,
	}, nil
}

// fetchMimirConfig fetches the alertmanager configuration from a Mimir/Cortex datasource.
func (moa *MultiOrgAlertmanager) fetchMimirConfig(ctx context.Context, ds *datasources.DataSource) (*mimirConfigResponse, error) {
	configURL, err := moa.buildMimirConfigURL(ds)
	if err != nil {
		return nil, fmt.Errorf("failed to build config URL: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, configURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	if ds.BasicAuth {
		password := moa.decryptFn(ctx, ds.SecureJsonData, "basicAuthPassword", "")
		req.SetBasicAuth(ds.BasicAuthUser, password)
	}

	headers, err := moa.datasourceService.CustomHeaders(ctx, ds)
	if err != nil {
		return nil, fmt.Errorf("failed to get custom headers: %w", err)
	}
	for key, values := range headers {
		for _, v := range values {
			req.Header.Add(key, v)
		}
	}

	resp, err := moa.httpClient.Do(req)
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
	decoder := yaml.NewDecoder(bytes.NewReader(body))
	if err := decoder.Decode(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &cfg, nil
}

// buildMimirConfigURL constructs the Mimir alertmanager configuration API URL.
// The config endpoint is /api/v1/alerts directly on the datasource URL.
func (moa *MultiOrgAlertmanager) buildMimirConfigURL(ds *datasources.DataSource) (string, error) {
	parsed, err := url.Parse(ds.URL)
	if err != nil {
		return "", fmt.Errorf("failed to parse datasource URL: %w", err)
	}

	return parsed.JoinPath("/api/v1/alerts").String(), nil
}
