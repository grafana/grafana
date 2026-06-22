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

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana-app-sdk/resource"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"

	alertingnotifv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
)

// externalSyncOrigin aliases the codegen-emitted enum for the auxiliary
// origin field on Config.status.externalAlertmanagerSync. The
// generated name is unwieldy in expressions; the alias keeps call sites
// readable without obscuring the underlying type.
type externalSyncOrigin = alertingnotifv0alpha1.ConfigV0alpha1StatusExternalAlertmanagerSyncOrigin

const (
	originAPI = alertingnotifv0alpha1.ConfigV0alpha1StatusExternalAlertmanagerSyncOriginApi
	originIni = alertingnotifv0alpha1.ConfigV0alpha1StatusExternalAlertmanagerSyncOriginIni
)

// mimirConfigResponse is the Mimir/Cortex alertmanager configuration API response.
type mimirConfigResponse struct {
	AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
}

// conditionTypeExternalAlertmanagerSynced is feature-qualified (not bare
// "Synced") so future feature condition types can coexist on the same
// status.conditions[] without collision.
const conditionTypeExternalAlertmanagerSynced = "ExternalAlertmanagerSynced"

// conditionReasonSyncSucceeded is the success-branch reason. Failure
// reasons come from SyncReason.ConditionReason().
const conditionReasonSyncSucceeded = "SyncSucceeded"

// conditionReasonMergeCommitted is the terminal reason once the config was
// imported as a managed route: sync stops and the admin owns it from here.
const conditionReasonMergeCommitted = "MergeCommitted"

const mergeCommittedMessage = "The external Alertmanager configuration has already been merged into Grafana; automatic sync from the datasource has stopped."

// SyncReason categorises a sync failure. snake_case constant → Prometheus
// `reason` label (ExternalAMConfigSyncFailures); PascalCase via
// ConditionReason() → k8s Condition reason. Single source of truth: wrap
// errors in *SyncError, extract via reasonOf.
type SyncReason string

const (
	ReasonDatasourceLookup   SyncReason = "datasource_lookup"
	ReasonMimirFetch         SyncReason = "mimir_fetch"
	ReasonValidate           SyncReason = "validate"
	ReasonSave               SyncReason = "save"
	ReasonIdentifierMismatch SyncReason = "identifier_mismatch"
	// ReasonNoUpstreamConfig: Mimir returned an empty alertmanager_config.
	// Distinct from ReasonSave — nothing was attempted to persist.
	ReasonNoUpstreamConfig SyncReason = "no_upstream_config"
	// ReasonConfigRead: couldn't read the org's config to check if it was already
	// merged; the tick is skipped rather than risk overwriting it.
	ReasonConfigRead SyncReason = "config_read"
	// ReasonUnclassified is the safety net for errors not tagged with
	// *SyncError. Keeps Prometheus label cardinality bounded.
	ReasonUnclassified SyncReason = "unclassified"
)

// errNoUpstreamConfig is returned by fetchMimirConfig when the upstream has no
// alertmanager configuration to import — whether Mimir responds with 404 (no
// record ever stored for the tenant) or 200 with an empty alertmanager_config
// field. fetchExtraConfig translates the sentinel into a SyncError tagged
// ReasonNoUpstreamConfig so both shapes share one classification path.
var errNoUpstreamConfig = errors.New("upstream Mimir has no alertmanager configuration to import")

func (r SyncReason) Label() string { return string(r) }

func (r SyncReason) ConditionReason() string {
	switch r {
	case ReasonDatasourceLookup:
		return "DatasourceLookupFailed"
	case ReasonMimirFetch:
		return "MimirFetchFailed"
	case ReasonValidate:
		return "ValidationFailed"
	case ReasonSave:
		return "SaveFailed"
	case ReasonIdentifierMismatch:
		return "IdentifierMismatch"
	case ReasonNoUpstreamConfig:
		return "NoUpstreamConfig"
	case ReasonConfigRead:
		return "ConfigReadFailed"
	default:
		return "SyncFailed"
	}
}

// SyncError tags an error with a SyncReason so callers can classify via
// errors.As without parsing messages.
type SyncError struct {
	Reason SyncReason
	Cause  error
}

func (e *SyncError) Error() string {
	if e.Cause == nil {
		return string(e.Reason)
	}
	return e.Cause.Error()
}

func (e *SyncError) Unwrap() error { return e.Cause }

// reasonOf extracts the SyncReason via errors.As. Returns
// ReasonUnclassified for un-tagged errors — keeps metric label cardinality
// bounded.
func reasonOf(err error) SyncReason {
	var se *SyncError
	if errors.As(err, &se) {
		return se.Reason
	}
	return ReasonUnclassified
}

// ClassifySaveError tags an error returned by SaveAndApplyExtraConfiguration.
// Called from MAM's save path. ErrAlertmanagerMultipleExtraConfigsUnsupported
// is split out so operators can distinguish it via dashboards.
func ClassifySaveError(err error) *SyncError {
	if err == nil {
		return nil
	}
	// Already classified — return as-is so we don't double-wrap.
	var existing *SyncError
	if errors.As(err, &existing) {
		return existing
	}
	if errors.Is(err, ErrAlertmanagerMultipleExtraConfigsUnsupported.Base) {
		return &SyncError{Reason: ReasonIdentifierMismatch, Cause: err}
	}
	return &SyncError{Reason: ReasonSave, Cause: err}
}

// amConfigReader reads an org's current Alertmanager configuration. Satisfied by
// the Alertmanager config store; used to detect whether the external config was
// already merged (a managed route keyed by the datasource UID).
type amConfigReader interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
}

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
	datasourceService  datasources.DataSourceService
	httpClientProvider httpclient.Provider
	requestValidator   validations.DataSourceRequestValidator
	settings           *setting.Cfg
	metrics            *metrics.MultiOrgAlertmanager
	logger             log.Logger

	lastSyncHashMu sync.RWMutex
	lastSyncHash   map[int64]uint64

	// k8s client constructed lazily, NOT in NewExternalAMSyncer. Eager
	// construction deadlocks during DI: eventualRestConfigProvider blocks on
	// the apiserver being ready, which can't happen while we hold the main
	// init goroutine. See resolveCfgClient.
	clientGenerator resource.ClientGenerator
	namespaceMapper request.NamespaceMapper

	// configReader reads the org's current Alertmanager config to detect whether
	// the external config was already merged.
	configReader amConfigReader

	cfgClientMu sync.Mutex
	cfgClient   *alertingnotifv0alpha1.ConfigClient
}

// NewExternalAMSyncer constructs an ExternalAMSyncer. requestValidator may
// not be nil — pass &validations.OSSDataSourceRequestValidator{} for the
// no-op default. Nil clientGenerator/namespaceMapper (test paths) skips status
// writes.
func NewExternalAMSyncer(
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	requestValidator validations.DataSourceRequestValidator,
	settings *setting.Cfg,
	m *metrics.MultiOrgAlertmanager,
	logger log.Logger,
	clientGenerator resource.ClientGenerator,
	namespaceMapper request.NamespaceMapper,
	configReader amConfigReader,
) *ExternalAMSyncer {
	return &ExternalAMSyncer{
		datasourceService:  datasourceService,
		httpClientProvider: httpClientProvider,
		requestValidator:   requestValidator,
		settings:           settings,
		metrics:            m,
		logger:             logger,
		lastSyncHash:       make(map[int64]uint64),
		clientGenerator:    clientGenerator,
		namespaceMapper:    namespaceMapper,
		configReader:       configReader,
	}
}

// resolveCfgClient lazily builds and caches the Config client. It is built
// lazily (not in NewExternalAMSyncer) because the ClientGenerator blocks until
// the apiserver is ready, which would deadlock during DI. The successful client
// is cached, but construction failures are NOT: the next call retries, so a
// transient apiserver-not-ready at the first tick doesn't disable sync until
// the process restarts.
func (s *ExternalAMSyncer) resolveCfgClient() (*alertingnotifv0alpha1.ConfigClient, error) {
	s.cfgClientMu.Lock()
	defer s.cfgClientMu.Unlock()
	if s.cfgClient != nil {
		return s.cfgClient, nil
	}
	if s.clientGenerator == nil {
		return nil, fmt.Errorf("no client generator configured")
	}
	c, err := alertingnotifv0alpha1.NewConfigClientFromGenerator(s.clientGenerator)
	if err != nil {
		return nil, fmt.Errorf("construct Config client: %w", err)
	}
	s.cfgClient = c
	return s.cfgClient, nil
}

// orgServiceContext wraps ctx with a service identity scoped to the org's
// namespace for in-process k8s calls. Returns (ctx, "") when namespaceMapper
// is nil (test paths).
func (s *ExternalAMSyncer) orgServiceContext(ctx context.Context, orgID int64) (context.Context, string) {
	if s.namespaceMapper == nil {
		return ctx, ""
	}
	ns := s.namespaceMapper(orgID)
	return identity.WithServiceIdentityForSingleNamespaceContext(ctx, ns), ns
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
func (s *ExternalAMSyncer) FetchExtraConfig(ctx context.Context, orgID int64) (*v1.ExtraConfiguration, uint64) {
	client := openfeature.NewDefaultClient()
	if !client.Boolean(ctx, featuremgmt.FlagAlertingSyncExternalAlertmanager, false, openfeature.TransactionContext(ctx)) {
		return nil, 0
	}

	uid, origin, err := s.resolveExternalAMUIDForOrg(ctx, orgID)
	if err != nil {
		s.logger.Warn("Failed to resolve external AM UID", "org_id", orgID, "error", err)
		return nil, 0
	}
	if uid == "" {
		// Flag on but sync isn't configured here (no ini override, no spec UID):
		// seed the singleton so it reliably exists without a manual create.
		s.ensureConfigSeeded(ctx, orgID)
		return nil, 0
	}

	orgIDStr := fmt.Sprintf("%d", orgID)

	// Stop once the merge is committed: the imported config becomes a managed
	// route keyed by the datasource UID. Record the terminal status and skip.
	// A read failure skips the tick but is still surfaced as a failure.
	committed, err := s.isMergeCommitted(ctx, orgID, uid)
	if err != nil {
		readErr := &SyncError{Reason: ReasonConfigRead, Cause: err}
		s.logger.Warn("Failed to check external AM merge state; skipping sync", "org_id", orgID, "error", err)
		s.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, ReasonConfigRead.Label()).Inc()
		s.recordSyncResult(ctx, orgID, uid, origin, readErr)
		return nil, 0
	}
	if committed {
		s.recordMergeCommitted(ctx, orgID, uid, origin)
		return nil, 0
	}

	start := time.Now()

	ec, newHash, fetchErr := s.fetchExtraConfig(ctx, orgID, uid)
	if fetchErr != nil {
		reason := reasonOf(fetchErr).Label()
		s.logger.Warn("Failed to fetch external AM configuration", "org_id", orgID, "reason", reason, "error", fetchErr)
		s.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, reason).Inc()
		s.metrics.ExternalAMConfigSyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds())
		s.recordSyncResult(ctx, orgID, uid, origin, fetchErr)
		return nil, 0
	}

	// Count every successful upstream fetch. The hash gauge moves on MarkSaved
	// so it tracks the last persisted config, not the last fetched one.
	s.metrics.ExternalAMConfigSyncTotal.WithLabelValues(orgIDStr).Inc()
	s.metrics.ExternalAMConfigSyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds())

	// Cross-tick dedup against the last successful save.
	s.lastSyncHashMu.RLock()
	prevHash, hasPrev := s.lastSyncHash[orgID]
	s.lastSyncHashMu.RUnlock()
	if hasPrev && prevHash == newHash {
		s.logger.Debug("Skipping external AM config save: response unchanged since last sync", "org_id", orgID)
		return nil, 0
	}

	// Validate post-dedup, so the cost is paid only when the upstream config
	// actually changed. A config that fetches and parses fine can still be
	// invalid for Grafana (e.g. references a filesystem path), so reject it
	// before saving and surface it as a distinct failure reason.
	if err := ec.Validate(); err != nil {
		validateErr := &SyncError{Reason: ReasonValidate, Cause: err}
		s.logger.Warn("Skipping external AM config save: fetched configuration is invalid", "org_id", orgID, "error", err)
		s.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, ReasonValidate.Label()).Inc()
		s.recordSyncResult(ctx, orgID, uid, origin, validateErr)
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
//
// Also writes a success state to Config.status. Status writes are
// best-effort and do not affect save-side bookkeeping.
func (s *ExternalAMSyncer) MarkSaved(ctx context.Context, orgID int64, hash uint64) {
	s.lastSyncHashMu.Lock()
	s.lastSyncHash[orgID] = hash
	s.lastSyncHashMu.Unlock()
	s.metrics.ExternalAMConfigSyncHash.WithLabelValues(fmt.Sprintf("%d", orgID)).Set(float64(hash & mask53))
	s.writeSyncStatusFor(ctx, orgID, nil)
}

// MarkFailed records a save-side failure to Config.status. Caller
// (MAM) passes an already-classified *SyncError (via ClassifySaveError) so
// the reason matches the metric label. Bare errors fall through to
// ReasonUnclassified.
func (s *ExternalAMSyncer) MarkFailed(ctx context.Context, orgID int64, syncErr error) {
	s.writeSyncStatusFor(ctx, orgID, syncErr)
}

// writeSyncStatusFor re-resolves (uid, origin) rather than threading it
// through the save path — cheap, avoids state coupling. syncErr == nil
// signals success.
func (s *ExternalAMSyncer) writeSyncStatusFor(ctx context.Context, orgID int64, syncErr error) {
	uid, origin, err := s.resolveExternalAMUIDForOrg(ctx, orgID)
	if err != nil {
		s.logger.Warn("Failed to re-resolve UID for status write", "org_id", orgID, "error", err)
		return
	}
	s.recordSyncResult(ctx, orgID, uid, origin, syncErr)
}

// recordSyncResult writes the latest sync outcome (nil = success) onto the org's
// Config.status.
func (s *ExternalAMSyncer) recordSyncResult(ctx context.Context, orgID int64, uid string, origin externalSyncOrigin, syncErr error) {
	now := time.Now()
	s.writeStatus(ctx, orgID, func(prev *alertingnotifv0alpha1.ConfigStatus) alertingnotifv0alpha1.ConfigStatus {
		return computeSyncStatus(prev, uid, origin, syncErr, now)
	})
}

// recordMergeCommitted writes the terminal MergeCommitted status once the
// external config has been merged into the org's Grafana config (sync stops).
func (s *ExternalAMSyncer) recordMergeCommitted(ctx context.Context, orgID int64, uid string, origin externalSyncOrigin) {
	now := time.Now()
	s.writeStatus(ctx, orgID, func(prev *alertingnotifv0alpha1.ConfigStatus) alertingnotifv0alpha1.ConfigStatus {
		return computeCommittedStatus(prev, uid, origin, now)
	})
}

// ensureConfigSeeded creates the org's Config singleton with an empty doc if it
// does not yet exist, so the resource reliably exists without a manual create.
// Called on the flag-on-but-unconfigured path. Best-effort: failures are logged
// and never block the sync loop — an empty doc is semantically identical to an
// absent one, so a missed seed is harmless and the next tick retries.
func (s *ExternalAMSyncer) ensureConfigSeeded(ctx context.Context, orgID int64) {
	c, err := s.resolveCfgClient()
	if err != nil {
		s.logger.Warn("Failed to resolve Config client for seeding", "org_id", orgID, "error", err)
		return
	}
	nsCtx, ns := s.orgServiceContext(ctx, orgID)
	if ns == "" {
		return
	}
	id := resource.Identifier{Namespace: ns, Name: alertingnotifv0alpha1.ConfigSingletonName}

	if _, getErr := c.Get(nsCtx, id); getErr == nil {
		return // already exists
	} else if !k8serrors.IsNotFound(getErr) {
		s.logger.Warn("Failed to check Config singleton for seeding", "org_id", orgID, "error", getErr)
		return
	}

	r := &alertingnotifv0alpha1.Config{
		ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: alertingnotifv0alpha1.ConfigSingletonName},
	}
	if _, createErr := c.Create(nsCtx, r, resource.CreateOptions{}); createErr != nil && !k8serrors.IsAlreadyExists(createErr) {
		s.logger.Warn("Failed to seed Config singleton", "org_id", orgID, "error", createErr)
	}
}

// writeStatus upserts the org's Config.status using compute(prev), creating the
// resource if absent. Optimistic via RetryOnConflict; best-effort (failures are
// logged). Unchanged status produces no physical write (unified storage dedup).
func (s *ExternalAMSyncer) writeStatus(ctx context.Context, orgID int64, compute func(prev *alertingnotifv0alpha1.ConfigStatus) alertingnotifv0alpha1.ConfigStatus) {
	c, err := s.resolveCfgClient()
	if err != nil {
		s.logger.Warn("Failed to resolve Config client for status write", "org_id", orgID, "error", err)
		return
	}
	nsCtx, ns := s.orgServiceContext(ctx, orgID)
	if ns == "" {
		return
	}
	id := resource.Identifier{Namespace: ns, Name: alertingnotifv0alpha1.ConfigSingletonName}

	err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
		existing, getErr := c.Get(nsCtx, id)
		if k8serrors.IsNotFound(getErr) {
			// Seed .Status on Create. Unified storage persists the whole object
			// on Create today; a future migration to a real /status subresource
			// would silently drop this — at that point swap to UpdateStatus.
			r := &alertingnotifv0alpha1.Config{
				ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: alertingnotifv0alpha1.ConfigSingletonName},
				Status:     compute(nil),
			}
			if _, createErr := c.Create(nsCtx, r, resource.CreateOptions{}); createErr != nil {
				// AlreadyExists → another writer raced us. Surface as a conflict
				// so RetryOnConflict re-enters and sees the existing object.
				if k8serrors.IsAlreadyExists(createErr) {
					return k8serrors.NewConflict(alertingnotifv0alpha1.ConfigKind().GroupVersionResource().GroupResource(), id.Name, createErr)
				}
				return createErr
			}
			return nil
		}
		if getErr != nil {
			return getErr
		}
		_, updateErr := c.UpdateStatus(nsCtx, id, compute(&existing.Status), resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
		return updateErr
	})
	if err != nil {
		s.logger.Warn("Failed to write Config status", "org_id", orgID, "error", err)
	}
}

// computeSyncStatus maps a sync outcome (nil = success) to the
// ExternalAlertmanagerSynced condition and folds it into prev.
func computeSyncStatus(prev *alertingnotifv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, syncErr error, now time.Time) alertingnotifv0alpha1.ConfigStatus {
	if syncErr == nil {
		return buildSyncStatus(prev, uid, origin, alertingnotifv0alpha1.ConfigConditionStatusTrue, conditionReasonSyncSucceeded, "", now)
	}
	return buildSyncStatus(prev, uid, origin, alertingnotifv0alpha1.ConfigConditionStatusFalse, reasonOf(syncErr).ConditionReason(), syncErr.Error(), now)
}

// computeCommittedStatus is the terminal status once the config was merged:
// stays True (so the synced-at timestamp is kept), reason flips to MergeCommitted.
func computeCommittedStatus(prev *alertingnotifv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, now time.Time) alertingnotifv0alpha1.ConfigStatus {
	return buildSyncStatus(prev, uid, origin, alertingnotifv0alpha1.ConfigConditionStatusTrue, conditionReasonMergeCommitted, mergeCommittedMessage, now)
}

// buildSyncStatus folds an ExternalAlertmanagerSynced condition into prev. k8s
// condition FSM: lastTransitionTime advances only on status flip. Preserves
// other condition types so future controllers aren't clobbered.
func buildSyncStatus(prev *alertingnotifv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, condStatus alertingnotifv0alpha1.ConfigConditionStatus, reason, message string, now time.Time) alertingnotifv0alpha1.ConfigStatus {
	uidCopy := uid
	originCopy := origin
	st := alertingnotifv0alpha1.ConfigStatus{
		ExternalAlertmanagerSync: &alertingnotifv0alpha1.ConfigV0alpha1StatusExternalAlertmanagerSync{
			DatasourceUid: &uidCopy,
			Origin:        &originCopy,
		},
	}

	// lastTransitionTime advances only when status flips.
	transitionTime := now.UTC().Format(time.RFC3339)
	for _, c := range prevConditions(prev) {
		if c.Type == conditionTypeExternalAlertmanagerSynced {
			if c.Status == condStatus {
				transitionTime = c.LastTransitionTime
			}
			break
		}
	}

	synced := alertingnotifv0alpha1.ConfigCondition{
		Type:               conditionTypeExternalAlertmanagerSynced,
		Status:             condStatus,
		LastTransitionTime: transitionTime,
		Reason:             reason,
	}
	if message != "" {
		synced.Message = &message
	}

	// Preserve other condition types, then upsert Synced.
	for _, c := range prevConditions(prev) {
		if c.Type != conditionTypeExternalAlertmanagerSynced {
			st.Conditions = append(st.Conditions, c)
		}
	}
	st.Conditions = append(st.Conditions, synced)

	return st
}

func prevConditions(prev *alertingnotifv0alpha1.ConfigStatus) []alertingnotifv0alpha1.ConfigCondition {
	if prev == nil {
		return nil
	}
	return prev.Conditions
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
// ticks. Failures are returned as *SyncError so callers can extract the reason
// category via reasonOf without re-classifying.
func (s *ExternalAMSyncer) fetchExtraConfig(ctx context.Context, orgID int64, uid string) (v1.ExtraConfiguration, uint64, error) {
	fetchCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	ds, err := s.datasourceService.GetDataSource(fetchCtx, &datasources.GetDataSourceQuery{
		UID:   uid,
		OrgID: orgID,
	})
	if err != nil {
		return v1.ExtraConfiguration{}, 0, &SyncError{Reason: ReasonDatasourceLookup, Cause: fmt.Errorf("look up datasource: %w", err)}
	}

	mimirCfg, hash, err := s.fetchMimirConfig(fetchCtx, ds)
	if errors.Is(err, errNoUpstreamConfig) {
		return v1.ExtraConfiguration{}, 0, &SyncError{Reason: ReasonNoUpstreamConfig, Cause: err}
	}
	if err != nil {
		return v1.ExtraConfiguration{}, 0, &SyncError{Reason: ReasonMimirFetch, Cause: fmt.Errorf("fetch upstream config: %w", err)}
	}

	return v1.ExtraConfiguration{
		Identifier:         uid,
		AlertmanagerConfig: mimirCfg.AlertmanagerConfig,
		TemplateFiles:      mimirCfg.TemplateFiles,
	}, hash, nil
}

// externalSyncDatasourceUIDFromConfig returns the configured UID or ""
// when any level in the nested optional chain is unset.
func externalSyncDatasourceUIDFromConfig(c *alertingnotifv0alpha1.Config) string {
	if c == nil ||
		c.Spec.ExternalAlertmanagerSync == nil ||
		c.Spec.ExternalAlertmanagerSync.DatasourceUid == nil {
		return ""
	}
	return *c.Spec.ExternalAlertmanagerSync.DatasourceUid
}

// isMergeCommitted reports whether the org's config already contains a managed
// route keyed by identifier — i.e. the external config was already imported.
func (s *ExternalAMSyncer) isMergeCommitted(ctx context.Context, orgID int64, identifier string) (bool, error) {
	raw, err := s.configReader.GetLatestAlertmanagerConfiguration(ctx, orgID)
	if err != nil {
		return false, err
	}
	cfg, err := Load([]byte(raw.AlertmanagerConfiguration))
	if err != nil {
		return false, fmt.Errorf("parse alertmanager configuration: %w", err)
	}
	_, ok := cfg.ManagedRoutes[identifier]
	return ok, nil
}

// resolveExternalAMUIDForOrg returns the datasource UID to use for external AM
// sync for the given org and where it came from. The operator-level
// ExternalAlertmanagerUID setting takes precedence over the per-org value.
// The per-org value is read from the Config k8s resource; if its client
// can't be constructed the sync fails for this tick rather than falling back to
// anything. Returns "" when no UID is set (sync should be skipped).
func (s *ExternalAMSyncer) resolveExternalAMUIDForOrg(ctx context.Context, orgID int64) (string, externalSyncOrigin, error) {
	if uid := s.settings.UnifiedAlerting.ExternalAlertmanagerUID; uid != "" {
		return uid, originIni, nil
	}

	c, err := s.resolveCfgClient()
	if err != nil {
		return "", "", err
	}
	nsCtx, ns := s.orgServiceContext(ctx, orgID)
	ac, err := c.Get(nsCtx, resource.Identifier{Namespace: ns, Name: alertingnotifv0alpha1.ConfigSingletonName})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return "", originAPI, nil
		}
		return "", "", err
	}
	return externalSyncDatasourceUIDFromConfig(ac), originAPI, nil
}

// IsConfiguredForOrg reports whether external Alertmanager sync is configured
// for the given org. True when the operator-level ini setting is non-empty
// (applies to all orgs) OR a non-empty datasource UID is set on the Config
// resource at .spec.externalAlertmanagerSync.datasourceUid.
func (s *ExternalAMSyncer) IsConfiguredForOrg(ctx context.Context, orgID int64) (bool, error) {
	if s.settings.UnifiedAlerting.ExternalAlertmanagerUID != "" {
		return true, nil
	}

	c, err := s.resolveCfgClient()
	if err != nil {
		return false, err
	}
	nsCtx, ns := s.orgServiceContext(ctx, orgID)
	ac, err := c.Get(nsCtx, resource.Identifier{Namespace: ns, Name: alertingnotifv0alpha1.ConfigSingletonName})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return false, nil
		}
		return false, err
	}
	return externalSyncDatasourceUIDFromConfig(ac) != "", nil
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
		if err := s.requestValidator.Validate(ds.URL, ds.JsonDataMap(), req); err != nil {
			return nil, 0, fmt.Errorf("datasource request validation failed: %w", err)
		}
	}

	resp, err := transport.RoundTrip(req)
	if err != nil {
		return nil, 0, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Mimir returns 404 when no alertmanager_config has ever been stored for
	// the tenant — semantically "nothing to import". Funnel into the same
	// errNoUpstreamConfig sentinel that the 200/empty-body branch below uses,
	// so both shapes get the same NoUpstreamConfig classification upstream.
	if resp.StatusCode == http.StatusNotFound {
		return nil, 0, errNoUpstreamConfig
	}

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

	if cfg.AlertmanagerConfig == "" {
		return nil, 0, errNoUpstreamConfig
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
