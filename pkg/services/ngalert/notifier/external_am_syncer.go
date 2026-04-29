package notifier

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"
	"time"

	"go.yaml.in/yaml/v3"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/utils/hash"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

// extraConfigHashMask matches the truncation applied by hashAsMetricValue
// (notifier/alertmanager.go) so the gauge value stays exact under Prometheus's
// float64 storage. Prometheus stores values as float64, which can exactly
// represent integers only up to 2^53-1.
const extraConfigHashMask uint64 = (1 << 53) - 1

// fingerprintExtraConfig returns a stable FNV-1a hash of the parsed unencrypted
// ExtraConfiguration. Mirrors the primitive used by alertingNotify.CalculateConfigFingerprint
// (notify/grafana_alertmanager.go) and remote/alertmanager.go's calculateUserGrafanaConfigHash.
// Hashing the parsed value (rather than serialized bytes) sidesteps map iteration
// order concerns in TemplateFiles and the encryption IV churn of the persisted form.
func fingerprintExtraConfig(ec apimodels.ExtraConfiguration) uint64 {
	h := fnv.New64a()
	hash.DeepHashObject(h, &ec)
	return h.Sum64()
}

// extraConfigHashAsMetricValue truncates an FNV-1a hash to 53 bits and converts
// to float64 for Prometheus gauge storage. We don't care about magnitudes or
// rates — only whether the value changes between scrapes.
func extraConfigHashAsMetricValue(h uint64) float64 {
	return float64(h & extraConfigHashMask)
}

// mimirConfigResponse is the Mimir/Cortex alertmanager configuration API response.
type mimirConfigResponse struct {
	AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
}

// External AM sync failure reasons used as the `reason` label on
// ExternalAMConfigSyncFailures.
const (
	syncReasonDatasourceLookup   = "datasource_lookup"
	syncReasonMimirFetch         = "mimir_fetch"
	syncReasonSave               = "save"
	syncReasonIdentifierMismatch = "identifier_mismatch"
)

// ConfigPersister is the subset of MultiOrgAlertmanager the syncer needs to
// commit a fetched ExtraConfig. MultiOrgAlertmanager satisfies it via
// SaveAndApplyExtraConfiguration, which is itself idempotent: a call with
// content byte-equivalent to what's already stored is a no-op (no
// alert_configuration_history row is written), so the syncer calls it on
// every tick without a separate dedup pre-check.
type ConfigPersister interface {
	SaveAndApplyExtraConfiguration(ctx context.Context, org int64, extraConfig apimodels.ExtraConfiguration, replace bool, dryRun bool) (definition.RenameResources, error)
}

// ExternalAMSyncer fetches Mimir/Cortex alertmanager configuration for each org
// that has it configured and applies it through the configured ConfigPersister.
// Per-tick dedup compares the incoming hash against ConfigPersister.StoredExtraConfigHash —
// survives restart without holding any in-memory hash map.
type ExternalAMSyncer struct {
	persister          ConfigPersister
	adminConfigStore   store.AdminConfigurationStore
	datasourceService  datasources.DataSourceService
	httpClientProvider httpclient.Provider
	requestValidator   validations.DataSourceRequestValidator
	settings           *setting.Cfg
	metrics            *metrics.MultiOrgAlertmanager
	logger             log.Logger
}

// NewExternalAMSyncer constructs an ExternalAMSyncer. requestValidator may not be
// nil; pass &validations.OSSDataSourceRequestValidator{} for the no-op default.
func NewExternalAMSyncer(
	persister ConfigPersister,
	adminConfigStore store.AdminConfigurationStore,
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	requestValidator validations.DataSourceRequestValidator,
	settings *setting.Cfg,
	m *metrics.MultiOrgAlertmanager,
	logger log.Logger,
) *ExternalAMSyncer {
	return &ExternalAMSyncer{
		persister:          persister,
		adminConfigStore:   adminConfigStore,
		datasourceService:  datasourceService,
		httpClientProvider: httpClientProvider,
		requestValidator:   requestValidator,
		settings:           settings,
		metrics:            m,
		logger:             logger,
	}
}

// Sync fetches the alertmanager configuration from each org's external Mimir/Cortex
// datasource and persists it via the ConfigPersister. It is a no-op when the feature
// flag is disabled. Per-org errors are logged and do not abort other orgs.
func (s *ExternalAMSyncer) Sync(ctx context.Context, orgIDs []int64) {
	client := openfeature.NewDefaultClient()
	if !client.Boolean(ctx, featuremgmt.FlagAlertingSyncExternalAlertmanager, false, openfeature.TransactionContext(ctx)) {
		return
	}

	adminCfgs, err := s.adminConfigStore.GetAdminConfigurations()
	if err != nil {
		s.logger.Warn("Failed to fetch admin configurations for external AM sync", "error", err)
		return
	}

	adminCfgsByOrg := make(map[int64]*models.AdminConfiguration, len(adminCfgs))
	for _, cfg := range adminCfgs {
		adminCfgsByOrg[cfg.OrgID] = cfg
	}

	for _, orgID := range orgIDs {
		// Skip orgs the operator has disabled via unified_alerting.disabled_orgs.
		// Mirrors the same filter SyncAlertmanagersForOrgs applies (multiorg_alertmanager.go)
		// — running sync for a disabled org would write to alert_configuration_history
		// and hit the upstream Mimir/Cortex endpoint for an org that has no Alertmanager
		// running, neither of which the admin asked for.
		if _, isDisabled := s.settings.UnifiedAlerting.DisabledOrgs[orgID]; isDisabled {
			s.logger.Debug("Skipping external AM config sync for disabled org", "org_id", orgID)
			continue
		}

		uid := s.resolveExternalAMUID(orgID, adminCfgsByOrg)
		if uid == "" {
			continue
		}

		orgIDStr := fmt.Sprintf("%d", orgID)
		start := time.Now()

		ec, reason, err := s.fetchExtraConfig(ctx, orgID, uid)
		if err != nil {
			s.logger.Warn("Failed to fetch external AM configuration", "org_id", orgID, "reason", reason, "error", err)
			s.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, reason).Inc()
			s.metrics.ExternalAMConfigSyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds())
			continue
		}
		// SaveAndApplyExtraConfiguration is the same entry point used by the convert
		// API and is idempotent: it short-circuits when the incoming ec matches what's
		// already stored, so calling it on every tick is safe — no alert_configuration_history
		// row is written for a no-op sync, even immediately after a process restart.
		// With replace=false, an existing ExtraConfig under a different identifier
		// returns ErrAlertmanagerMultipleExtraConfigsUnsupported, which we classify
		// separately so operators can see the collision in admin_config rather than
		// as a generic "save" failure.
		if _, err = s.persister.SaveAndApplyExtraConfiguration(ctx, orgID, ec, false /*replace*/, false /*dryRun*/); err != nil {
			reason := classifySyncError(err)
			s.logger.Warn("Failed to save external AM configuration", "org_id", orgID, "reason", reason, "error", err)
			s.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, reason).Inc()
			s.metrics.ExternalAMConfigSyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds())
			continue
		}

		// Always set the gauge to the hash of what's now stored — successful tick
		// either applied this hash or confirmed it was already in place. Setting on
		// every tick (rather than only when a save happened) ensures the gauge has
		// a value after restart even if the config hasn't changed since.
		s.logger.Info("Synced external AM configuration", "org_id", orgID, "duration_ms", time.Since(start).Milliseconds())
		s.metrics.ExternalAMConfigSyncTotal.WithLabelValues(orgIDStr).Inc()
		s.metrics.ExternalAMConfigSyncHash.WithLabelValues(orgIDStr).Set(extraConfigHashAsMetricValue(fingerprintExtraConfig(ec)))
		s.metrics.ExternalAMConfigSyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds())
	}
}

// fetchExtraConfig looks up the org's external AM datasource and fetches the current
// alertmanager configuration from it. The 10s timeout used for both calls is owned
// via defer here so an early return cannot leak the cancel — callers don't need to
// care about timeout management when adding new failure paths. The returned reason
// matches the label on ExternalAMConfigSyncFailures so the caller can emit the
// metric without re-classifying.
func (s *ExternalAMSyncer) fetchExtraConfig(ctx context.Context, orgID int64, uid string) (apimodels.ExtraConfiguration, string, error) {
	fetchCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	ds, err := s.datasourceService.GetDataSource(fetchCtx, &datasources.GetDataSourceQuery{
		UID:   uid,
		OrgID: orgID,
	})
	if err != nil {
		return apimodels.ExtraConfiguration{}, syncReasonDatasourceLookup, fmt.Errorf("look up datasource: %w", err)
	}

	mimirCfg, err := s.fetchMimirConfig(fetchCtx, ds)
	if err != nil {
		return apimodels.ExtraConfiguration{}, syncReasonMimirFetch, fmt.Errorf("fetch upstream config: %w", err)
	}

	return apimodels.ExtraConfiguration{
		Identifier:         uid,
		AlertmanagerConfig: mimirCfg.AlertmanagerConfig,
		TemplateFiles:      mimirCfg.TemplateFiles,
	}, "", nil
}

// resolveExternalAMUID returns the datasource UID to use for external AM sync for
// the given org. The operator-level ExternalAlertmanagerUID setting takes precedence
// over the per-org DB value. Returns "" when neither is set, signalling that sync
// should be skipped for this org.
func (s *ExternalAMSyncer) resolveExternalAMUID(orgID int64, adminCfgsByOrg map[int64]*models.AdminConfiguration) string {
	if uid := s.settings.UnifiedAlerting.ExternalAlertmanagerUID; uid != "" {
		return uid
	}
	if cfg, ok := adminCfgsByOrg[orgID]; ok && cfg.ExternalAlertmanagerUID != nil {
		return *cfg.ExternalAlertmanagerUID
	}
	return ""
}

// IsConfiguredForOrg reports whether external Alertmanager sync is configured for
// the given org. True when the operator-level ini setting is non-empty (applies to
// all orgs) OR the org's admin configuration has a non-empty ExternalAlertmanagerUID.
func (s *ExternalAMSyncer) IsConfiguredForOrg(orgID int64) (bool, error) {
	if s.settings.UnifiedAlerting.ExternalAlertmanagerUID != "" {
		return true, nil
	}
	cfg, err := s.adminConfigStore.GetAdminConfiguration(orgID)
	if err != nil && !errors.Is(err, store.ErrNoAdminConfiguration) {
		return false, err
	}
	return cfg != nil && cfg.ExternalAlertmanagerUID != nil && *cfg.ExternalAlertmanagerUID != "", nil
}

// classifySyncError maps a SaveAndApplyExtraConfiguration error to a stable reason
// label. ErrAlertmanagerMultipleExtraConfigsUnsupported is split out as
// "identifier_mismatch" so operators can distinguish it from generic save errors.
func classifySyncError(err error) string {
	if errors.Is(err, ErrAlertmanagerMultipleExtraConfigsUnsupported.Base) {
		return syncReasonIdentifierMismatch
	}
	return syncReasonSave
}

// fetchMimirConfig fetches the alertmanager configuration from a Mimir/Cortex
// datasource. Uses the datasource service's HTTP transport so TLS, basic auth,
// bearer tokens, custom headers and OAuth pass-through configured on the datasource
// are all honoured.
func (s *ExternalAMSyncer) fetchMimirConfig(ctx context.Context, ds *datasources.DataSource) (*mimirConfigResponse, error) {
	configURL, err := s.buildMimirConfigURL(ds)
	if err != nil {
		return nil, fmt.Errorf("failed to build config URL: %w", err)
	}

	transport, err := s.datasourceService.GetHTTPTransport(ctx, ds, s.httpClientProvider)
	if err != nil {
		return nil, fmt.Errorf("failed to build datasource HTTP transport: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, configURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Apply allow/deny-list validation to the outbound request before sending.
	// The validator is the same one the user-driven datasource proxy runs
	// (datasourceproxy.go), so the sync worker honours whatever policy is
	// configured for the underlying datasource.
	if s.requestValidator != nil {
		if err := s.requestValidator.Validate(ds.URL, ds.JsonData, req); err != nil {
			return nil, fmt.Errorf("datasource request validation failed: %w", err)
		}
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
	if err := yaml.Unmarshal(body, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &cfg, nil
}

// buildMimirConfigURL constructs the Mimir alertmanager configuration API URL.
// The config endpoint is /api/v1/alerts directly on the datasource URL.
func (s *ExternalAMSyncer) buildMimirConfigURL(ds *datasources.DataSource) (string, error) {
	parsed, err := url.Parse(ds.URL)
	if err != nil {
		return "", fmt.Errorf("failed to parse datasource URL: %w", err)
	}

	return parsed.JoinPath("/api/v1/alerts").String(), nil
}
