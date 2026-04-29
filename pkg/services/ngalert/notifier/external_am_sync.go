package notifier

import (
	"bytes"
	"context"
	"errors"
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
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/open-feature/go-sdk/openfeature"
)

// mimirConfigResponse is the Mimir/Cortex alertmanager configuration API response.
type mimirConfigResponse struct {
	AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
}

// External AM sync failure reasons used as the `reason` label on
// ExternalAMConfigSyncFailures.
const (
	syncReasonDatasourceLookup = "datasource_lookup"
	syncReasonMimirFetch       = "mimir_fetch"
	syncReasonSave             = "save"
)

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

		orgIDStr := fmt.Sprintf("%d", orgID)
		start := time.Now()

		fetchCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		ds, err := moa.datasourceService.GetDataSource(fetchCtx, &datasources.GetDataSourceQuery{
			UID:   uid,
			OrgID: orgID,
		})
		if err != nil {
			cancel()
			moa.logger.Warn("Failed to look up external AM datasource", "org_id", orgID, "error", err)
			moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, syncReasonDatasourceLookup).Inc()
			moa.metrics.ExternalAMConfigSyncDuration.Observe(time.Since(start).Seconds())
			continue
		}

		mimirCfg, err := moa.fetchMimirConfig(fetchCtx, ds)
		cancel()
		if err != nil {
			moa.logger.Warn("Failed to fetch external AM configuration", "org_id", orgID, "error", err)
			moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, syncReasonMimirFetch).Inc()
			moa.metrics.ExternalAMConfigSyncDuration.Observe(time.Since(start).Seconds())
			continue
		}

		ec := apimodels.ExtraConfiguration{
			Identifier:         uid,
			AlertmanagerConfig: mimirCfg.AlertmanagerConfig,
			TemplateFiles:      mimirCfg.TemplateFiles,
		}
		// SaveAndApplyExtraConfiguration is the same entry point used by the convert
		// API, so a malformed Mimir/Cortex config is rejected before it lands in the
		// database. Calling with replace=false also enforces single-identifier ownership:
		// when an existing ExtraConfig has a different identifier, it returns
		// ErrAlertmanagerMultipleExtraConfigsUnsupported and the sync surfaces a
		// failure instead of silently overwriting.
		if _, err = moa.SaveAndApplyExtraConfiguration(ctx, orgID, ec, false /*replace*/, false /*dryRun*/); err != nil {
			moa.logger.Warn("Failed to save external AM configuration", "org_id", orgID, "error", err)
			moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, syncReasonSave).Inc()
			moa.metrics.ExternalAMConfigSyncDuration.Observe(time.Since(start).Seconds())
			continue
		}

		moa.logger.Info("Synced external AM configuration", "org_id", orgID, "duration_ms", time.Since(start).Milliseconds())
		moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues(orgIDStr).Inc()
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

// IsExternalAMSyncConfiguredForOrg reports whether external Alertmanager sync
// configuration exists for the given org. It returns true when the operator-level
// ini setting is non-empty (applies to all orgs) OR the org's admin configuration
// has a non-empty ExternalAlertmanagerUID. Mirrors the precedence in
// resolveExternalAMUID. It does not consider whether the sync feature flag is on —
// gating on configuration alone is intentional so the convert API stays consistent
// with the persisted admin_config regardless of feature-flag state.
func (moa *MultiOrgAlertmanager) IsExternalAMSyncConfiguredForOrg(_ context.Context, orgID int64) (bool, error) {
	if moa.settings.UnifiedAlerting.ExternalAlertmanagerUID != "" {
		return true, nil
	}
	cfg, err := moa.adminConfigStore.GetAdminConfiguration(orgID)
	if err != nil && !errors.Is(err, store.ErrNoAdminConfiguration) {
		return false, err
	}
	return cfg != nil && cfg.ExternalAlertmanagerUID != nil && *cfg.ExternalAlertmanagerUID != "", nil
}

// fetchMimirConfig fetches the alertmanager configuration from a Mimir/Cortex datasource.
// It builds an HTTP client off the datasource service's HTTP transport so TLS, basic auth,
// bearer tokens, custom headers, OAuth pass-through and other middlewares are applied
// transparently from the datasource's stored configuration.
func (moa *MultiOrgAlertmanager) fetchMimirConfig(ctx context.Context, ds *datasources.DataSource) (*mimirConfigResponse, error) {
	configURL, err := moa.buildMimirConfigURL(ds)
	if err != nil {
		return nil, fmt.Errorf("failed to build config URL: %w", err)
	}

	transport, err := moa.datasourceService.GetHTTPTransport(ctx, ds, moa.httpClientProvider)
	if err != nil {
		return nil, fmt.Errorf("failed to build datasource HTTP transport: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, configURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	resp, err := transport.RoundTrip(req)
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
