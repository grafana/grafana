package notifier

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
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
	syncReasonDatasourceLookup   = "datasource_lookup"
	syncReasonMimirFetch         = "mimir_fetch"
	syncReasonSave               = "save"
	syncReasonIdentifierMismatch = "identifier_mismatch"
)

// ExternalAMSyncer fetches the alertmanager configuration from an org's external
// Mimir/Cortex datasource. It does not own persistence — callers (MultiOrgAlertmanager
// per-org sync loop) take the returned ExtraConfiguration and persist via
// SaveAndApplyExtraConfiguration, then call MarkSaved to confirm the hash so future
// ticks can dedup.
//
// Per-tick dedup hashes the raw response body and compares against the previous
// successful save's hash, held in memory. The map is per-process: each org pays one
// save per restart before dedup engages, accepted as the cost of avoiding sidecar
// persistence for the hash.
type ExternalAMSyncer struct {
	adminConfigStore   store.AdminConfigurationStore
	datasourceService  datasources.DataSourceService
	httpClientProvider httpclient.Provider
	requestValidator   validations.DataSourceRequestValidator
	settings           *setting.Cfg
	metrics            *metrics.MultiOrgAlertmanager
	logger             log.Logger

	lastSyncHashMu sync.RWMutex
	lastSyncHash   map[int64]uint64
}

// NewExternalAMSyncer constructs an ExternalAMSyncer. requestValidator may not be
// nil; pass &validations.OSSDataSourceRequestValidator{} for the no-op default.
func NewExternalAMSyncer(
	adminConfigStore store.AdminConfigurationStore,
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	requestValidator validations.DataSourceRequestValidator,
	settings *setting.Cfg,
	m *metrics.MultiOrgAlertmanager,
	logger log.Logger,
) *ExternalAMSyncer {
	return &ExternalAMSyncer{
		adminConfigStore:   adminConfigStore,
		datasourceService:  datasourceService,
		httpClientProvider: httpClientProvider,
		requestValidator:   requestValidator,
		settings:           settings,
		metrics:            m,
		logger:             logger,
		lastSyncHash:       make(map[int64]uint64),
	}
}

// FetchExtraConfig fetches the external Alertmanager configuration for the given
// org. Returns a non-nil ExtraConfiguration only when there's a new config to save:
//   - sync feature flag is on
//   - sync is configured for the org (operator-level ini OR per-org admin_config UID)
//   - the fetch succeeded
//   - the response body hash differs from the last successful save
//
// Returns (nil, 0) in all other cases — the caller should just continue with its
// normal per-org apply path. The returned hash is paired with the ExtraConfig:
// callers MUST pass it to MarkSaved after a successful persist, otherwise dedup
// never engages and every fetch will return a non-nil ExtraConfig.
//
// Per-org failures (datasource lookup, HTTP fetch, parse) are logged and emit the
// failure metric here; the caller does not need to handle the error specifically.
func (s *ExternalAMSyncer) FetchExtraConfig(ctx context.Context, orgID int64) (*apimodels.ExtraConfiguration, uint64) {
	client := openfeature.NewDefaultClient()
	if !client.Boolean(ctx, featuremgmt.FlagAlertingSyncExternalAlertmanager, false, openfeature.TransactionContext(ctx)) {
		return nil, 0
	}

	uid, err := s.resolveExternalAMUIDForOrg(orgID)
	if err != nil {
		s.logger.Warn("Failed to resolve external AM UID", "org_id", orgID, "error", err)
		return nil, 0
	}
	if uid == "" {
		return nil, 0
	}

	orgIDStr := fmt.Sprintf("%d", orgID)
	start := time.Now()

	ec, newHash, reason, fetchErr := s.fetchExtraConfig(ctx, orgID, uid)
	if fetchErr != nil {
		s.logger.Warn("Failed to fetch external AM configuration", "org_id", orgID, "reason", reason, "error", fetchErr)
		s.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, reason).Inc()
		s.metrics.ExternalAMConfigSyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds())
		return nil, 0
	}

	// Count every fetch that reaches upstream successfully. The hash gauge is
	// set on MarkSaved (after the caller has actually persisted), so it
	// always reflects the last persisted config, not the last fetched one.
	s.metrics.ExternalAMConfigSyncTotal.WithLabelValues(orgIDStr).Inc()
	s.metrics.ExternalAMConfigSyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds())

	// Cross-tick dedup. If the response body hashes the same as the last
	// successful save, return (nil, _) so the caller doesn't re-save.
	s.lastSyncHashMu.RLock()
	prevHash, hasPrev := s.lastSyncHash[orgID]
	s.lastSyncHashMu.RUnlock()
	if hasPrev && prevHash == newHash {
		s.logger.Debug("Skipping external AM config save: response unchanged since last sync", "org_id", orgID)
		return nil, 0
	}

	return &ec, newHash
}

// MarkSaved records that an ExtraConfig with the given hash has been successfully
// persisted for the given org. Callers MUST invoke this after the matching save
// returned by FetchExtraConfig has been persisted, otherwise dedup never engages
// and every tick will re-save the same config. Updates the hash gauge here (not
// inside FetchExtraConfig) so the metric value always reflects the last persisted
// config rather than the last fetched one.
func (s *ExternalAMSyncer) MarkSaved(orgID int64, hash uint64) {
	s.lastSyncHashMu.Lock()
	s.lastSyncHash[orgID] = hash
	s.lastSyncHashMu.Unlock()
	s.metrics.ExternalAMConfigSyncHash.WithLabelValues(fmt.Sprintf("%d", orgID)).Set(float64(hash & mask53))
}

// fetchExtraConfig looks up the org's external AM datasource and fetches the current
// alertmanager configuration from it. The 10s timeout caps a single fetch attempt;
// Mimir/Cortex returns the config straight from storage so a healthy GET completes
// well under a second, but a hung connection on a transient network blip should not
// block MAM's per-org sync loop indefinitely. The timeout is owned via defer here
// so an early return cannot leak the cancel — callers don't need to care about
// timeout management when adding new failure paths.
//
// Returns the FNV-1a hash of the raw response body so the caller can dedup across
// ticks. The returned reason matches the label on ExternalAMConfigSyncFailures so
// the caller can emit the metric without re-classifying.
func (s *ExternalAMSyncer) fetchExtraConfig(ctx context.Context, orgID int64, uid string) (apimodels.ExtraConfiguration, uint64, string, error) {
	fetchCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	ds, err := s.datasourceService.GetDataSource(fetchCtx, &datasources.GetDataSourceQuery{
		UID:   uid,
		OrgID: orgID,
	})
	if err != nil {
		return apimodels.ExtraConfiguration{}, 0, syncReasonDatasourceLookup, fmt.Errorf("look up datasource: %w", err)
	}

	mimirCfg, hash, err := s.fetchMimirConfig(fetchCtx, ds)
	if err != nil {
		return apimodels.ExtraConfiguration{}, 0, syncReasonMimirFetch, fmt.Errorf("fetch upstream config: %w", err)
	}

	return apimodels.ExtraConfiguration{
		Identifier:         uid,
		AlertmanagerConfig: mimirCfg.AlertmanagerConfig,
		TemplateFiles:      mimirCfg.TemplateFiles,
	}, hash, "", nil
}

// resolveExternalAMUIDForOrg returns the datasource UID to use for external AM
// sync for the given org. The operator-level ExternalAlertmanagerUID setting takes
// precedence over the per-org DB value. Returns "" when neither is set (sync
// should be skipped). Returns an error only on storage failure looking up the
// per-org config.
func (s *ExternalAMSyncer) resolveExternalAMUIDForOrg(orgID int64) (string, error) {
	if uid := s.settings.UnifiedAlerting.ExternalAlertmanagerUID; uid != "" {
		return uid, nil
	}
	cfg, err := s.adminConfigStore.GetAdminConfiguration(orgID)
	if err != nil {
		if errors.Is(err, store.ErrNoAdminConfiguration) {
			return "", nil
		}
		return "", err
	}
	if cfg.ExternalAlertmanagerUID == nil {
		return "", nil
	}
	return *cfg.ExternalAlertmanagerUID, nil
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
// are all honoured. Returns the FNV-1a hash of the raw response body alongside the
// parsed value; callers use the hash for cross-tick dedup without needing to keep
// the body bytes around.
func (s *ExternalAMSyncer) fetchMimirConfig(ctx context.Context, ds *datasources.DataSource) (*mimirConfigResponse, uint64, error) {
	configURL, err := s.buildMimirConfigURL(ds)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build config URL: %w", err)
	}

	transport, err := s.datasourceService.GetHTTPTransport(ctx, ds, s.httpClientProvider)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build datasource HTTP transport: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, configURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Apply allow/deny-list validation to the outbound request before sending.
	// The validator is the same one the user-driven datasource proxy runs
	// (datasourceproxy.go), so the sync worker honours whatever policy is
	// configured for the underlying datasource.
	if s.requestValidator != nil {
		if err := s.requestValidator.Validate(ds.URL, ds.JsonData, req); err != nil {
			return nil, 0, fmt.Errorf("datasource request validation failed: %w", err)
		}
	}

	resp, err := transport.RoundTrip(req)
	if err != nil {
		return nil, 0, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, 0, fmt.Errorf("unexpected HTTP status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read response body: %w", err)
	}

	var cfg mimirConfigResponse
	if err := yaml.Unmarshal(body, &cfg); err != nil {
		return nil, 0, fmt.Errorf("failed to parse response: %w", err)
	}

	h := fnv.New64a()
	_, _ = h.Write(body)
	return &cfg, h.Sum64(), nil
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
