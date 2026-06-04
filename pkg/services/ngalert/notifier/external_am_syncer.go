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

	alertingadminv0alpha1 "github.com/grafana/grafana/apps/alerting/admin/pkg/apis/alertingadmin/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
)

// AlertingConfig is singleton-per-org. Per-org namespacing means each org
// has exactly one resource at this fixed name.
const configSingletonName = "default"

// externalSyncOrigin aliases the codegen-emitted enum for the auxiliary
// origin field on AlertingConfig.status.externalAlertmanagerSync. The
// generated name is unwieldy in expressions; the alias keeps call sites
// readable without obscuring the underlying type.
type externalSyncOrigin = alertingadminv0alpha1.AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOrigin

const (
	originAPI = alertingadminv0alpha1.AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOriginApi
	originIni = alertingadminv0alpha1.AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOriginIni
)

// mimirConfigResponse is the Mimir/Cortex alertmanager configuration API response.
type mimirConfigResponse struct {
	AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
}

// conditionTypeExternalAlertmanagerSynced is the condition Type carried on
// AlertingConfig.status.conditions[] reporting whether the external
// Alertmanager configuration sync is currently working. Feature-qualified
// so it can coexist with future feature condition types on the same
// .conditions[] array unambiguously (e.g. SimplifiedRoutingApplied).
const conditionTypeExternalAlertmanagerSynced = "ExternalAlertmanagerSynced"

// conditionReasonSyncSucceeded is the PascalCase reason used on the
// ExternalAlertmanagerSynced condition when sync succeeds. Failure reasons
// come from SyncReason values (see ConditionReason() below).
const conditionReasonSyncSucceeded = "SyncSucceeded"

// SyncReason categorises a sync failure. The constant value is the snake_case
// form used as the `reason` label on ExternalAMConfigSyncFailures (matching
// the upstream Prometheus + local ngalert convention for enum-like label
// values). The ConditionReason() method returns the PascalCase form used on
// the Synced k8s condition.
//
// Single source of truth: failure sites wrap their error in *SyncError with
// the appropriate SyncReason; consumers extract it via reasonOf(err) and
// project to whichever form they need.
type SyncReason string

const (
	ReasonDatasourceLookup   SyncReason = "datasource_lookup"
	ReasonMimirFetch         SyncReason = "mimir_fetch"
	ReasonValidate           SyncReason = "validate"
	ReasonSave               SyncReason = "save"
	ReasonIdentifierMismatch SyncReason = "identifier_mismatch"
	// ReasonNoUpstreamConfig is for the case where Mimir/Cortex returned a
	// response but its alertmanager_config field is empty. Distinct from
	// ReasonSave: we didn't try to persist anything; there was nothing valid
	// to persist. Surfacing this separately lets clients (and operators)
	// distinguish "Grafana persistence broke" from "upstream has no config".
	ReasonNoUpstreamConfig SyncReason = "no_upstream_config"

	// ReasonUnclassified is the sentinel returned by reasonOf when err is not
	// a *SyncError. Keeps Prometheus label cardinality bounded — raw error
	// messages never become label values.
	ReasonUnclassified SyncReason = "unclassified"
)

// Label returns the snake_case form for Prometheus metric labels. Matches the
// upstream Prometheus convention and the existing values emitted on
// ExternalAMConfigSyncFailures — dashboards built against the previous
// `datasource_lookup`/`mimir_fetch`/`save`/`identifier_mismatch` values
// continue to work.
func (r SyncReason) Label() string { return string(r) }

// ConditionReason returns the PascalCase form for k8s Condition.reason. K8s
// tooling expects this shape; it's the strong convention across the standard
// kinds (Pod, Deployment, Repository, …).
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
	default:
		return "SyncFailed"
	}
}

// SyncError tags an error with a SyncReason. Failure sites in the sync path
// return a *SyncError so callers can classify with errors.As without parsing
// error messages. Both metric emission and status writes use reasonOf(err)
// to extract the reason — single source of truth, no manual mapping.
type SyncError struct {
	Reason SyncReason
	Cause  error
}

// Error returns the underlying cause's message. The SyncReason is conveyed
// via errors.As, not via the formatted message.
func (e *SyncError) Error() string {
	if e.Cause == nil {
		return string(e.Reason)
	}
	return e.Cause.Error()
}

// Unwrap allows errors.Is / errors.As to walk through to the underlying cause.
func (e *SyncError) Unwrap() error { return e.Cause }

// reasonOf returns the SyncReason for err, walking the error chain via
// errors.As. Returns ReasonUnclassified for any error that isn't tagged with
// a *SyncError — this is the safety net that keeps Prometheus label
// cardinality bounded.
func reasonOf(err error) SyncReason {
	var se *SyncError
	if errors.As(err, &se) {
		return se.Reason
	}
	return ReasonUnclassified
}

// ClassifySaveError tags a SaveAndApplyExtraConfiguration error with the
// appropriate SyncReason. Called from MAM's save path at the boundary where
// the raw error first becomes a sync-categorised error.
// ErrAlertmanagerMultipleExtraConfigsUnsupported is split out so operators
// can distinguish it from generic save errors via dashboards.
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

	// k8s API integration. The syncer both reads
	// spec.alertmanager.externalSync.datasourceUid from the AlertingConfig
	// resource and writes the sync observation back onto
	// AlertingConfig.status (status fields nested under
	// status.alertmanager.externalSync, condition under status.conditions
	// with type=Synced).
	//
	// The client is constructed lazily on first use, NOT in
	// NewExternalAMSyncer — eager construction would deadlock during DI
	// because the syncer is built on the main init goroutine, and the REST
	// config provider (eventualRestConfigProvider) blocks until the
	// apiserver is up. The apiserver can't come up while we hold the init
	// goroutine, so we'd deadlock. See resolveCfgClient.
	clientGenerator resource.ClientGenerator
	namespaceMapper request.NamespaceMapper

	cfgClientOnce sync.Once
	cfgClient     *alertingadminv0alpha1.AlertingConfigClient
}

// NewExternalAMSyncer constructs an ExternalAMSyncer. requestValidator may not be
// nil; pass &validations.OSSDataSourceRequestValidator{} for the no-op default.
//
// When clientGenerator is non-nil, the syncer lazily builds typed clients to
// the admin app's Config and ExternalAlertmanagerSync resources on first use
// (see the resolveCfgClient / resolveExtAMSyncClient helpers). UID resolution
// reads Config.spec; status writes go to ExternalAlertmanagerSync.status.
// Construction is deferred because eager wiring during DI deadlocks against
// the apiserver bring-up — see the field comment above.
//
// clientGenerator and namespaceMapper are nil in test paths that don't
// exercise the k8s clients; the syncer falls back to the legacy admin_config
// store for UID resolution and skips status writes.
func NewExternalAMSyncer(
	adminConfigStore store.AdminConfigurationStore,
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	requestValidator validations.DataSourceRequestValidator,
	settings *setting.Cfg,
	m *metrics.MultiOrgAlertmanager,
	logger log.Logger,
	clientGenerator resource.ClientGenerator,
	namespaceMapper request.NamespaceMapper,
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
		clientGenerator:    clientGenerator,
		namespaceMapper:    namespaceMapper,
	}
}

// resolveCfgClient lazily builds the admin Config k8s client. Returns nil
// when no ClientGenerator was wired (test paths) or when construction has
// previously failed. Caches the (success or failure) outcome via sync.Once so
// the apiserver-not-ready failure mode doesn't get retried on every sync tick.
func (s *ExternalAMSyncer) resolveCfgClient() *alertingadminv0alpha1.AlertingConfigClient {
	if s.clientGenerator == nil {
		return nil
	}
	s.cfgClientOnce.Do(func() {
		c, err := alertingadminv0alpha1.NewAlertingConfigClientFromGenerator(s.clientGenerator)
		if err != nil {
			s.logger.Warn("Failed to construct admin Config client, falling back to legacy admin_config", "error", err)
			return
		}
		s.cfgClient = c
	})
	return s.cfgClient
}

// orgServiceContext returns ctx wrapped with a service identity scoped to the
// org's namespace, suitable for in-process k8s client calls on behalf of the
// sync worker. Returns the unmodified ctx and an empty namespace when
// namespaceMapper is nil.
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
		return nil, 0
	}

	orgIDStr := fmt.Sprintf("%d", orgID)
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
// Also writes a success entry to the ExternalAlertmanagerSync resource's .status
// when the experimental flag is on. Status writes are best-effort and do not
// affect the save-side bookkeeping.
func (s *ExternalAMSyncer) MarkSaved(ctx context.Context, orgID int64, hash uint64) {
	s.lastSyncHashMu.Lock()
	s.lastSyncHash[orgID] = hash
	s.lastSyncHashMu.Unlock()
	s.metrics.ExternalAMConfigSyncHash.WithLabelValues(fmt.Sprintf("%d", orgID)).Set(float64(hash & mask53))
	s.writeSyncStatusFor(ctx, orgID, nil)
}

// MarkFailed records a save-side failure for the given org. Caller (MAM) invokes
// this with an already-classified *SyncError (via ClassifySaveError) so the
// reason category flows from the same source as the metric label. Passing a
// bare error still works — reasonOf will fall back to ReasonUnclassified.
func (s *ExternalAMSyncer) MarkFailed(ctx context.Context, orgID int64, syncErr error) {
	s.writeSyncStatusFor(ctx, orgID, syncErr)
}

// writeSyncStatusFor re-resolves the (uid, origin) tuple for the org and writes
// the corresponding status. Callers (MarkSaved, MarkFailed) use this rather
// than threading the resolved values through the save path. The extra resolve
// call is cheap and avoids state coupling.
//
// syncErr == nil signals success; otherwise the failure category is extracted
// via reasonOf inside computeSyncStatus.
func (s *ExternalAMSyncer) writeSyncStatusFor(ctx context.Context, orgID int64, syncErr error) {
	if s.resolveCfgClient() == nil {
		return
	}
	uid, origin, err := s.resolveExternalAMUIDForOrg(ctx, orgID)
	if err != nil {
		s.logger.Warn("Failed to re-resolve UID for status write", "org_id", orgID, "error", err)
		return
	}
	s.recordSyncResult(ctx, orgID, uid, origin, syncErr)
}

// recordSyncResult writes the latest sync outcome onto the org's
// AlertingConfig.status. Best-effort: on error we log and move on. Status
// writes happen after each meaningful sync event (success, save failure,
// fetch failure); the unified-storage byte-equality dedup at
// apistore/store.go:712 drops physical writes when the serialised resource
// is unchanged, so steady-state-healthy sync produces no history rows.
//
// Upsert semantics: when no AlertingConfig exists for the org yet (first
// sync before any admin has touched the API), we create an empty-spec
// AlertingConfig and seed it with the computed status. The auto-created
// resource carries the operator-level UID context (origin=ini) on its
// status, which lets clients see "sync is running on operator config" even
// without an admin-driven AlertingConfig.spec.
//
// Concurrency: optimistic concurrency on resourceVersion via client-go's
// RetryOnConflict. Concurrent edits to spec or other parts of status are
// preserved because each retry re-reads the resource and mutates only the
// status fields we own (datasourceUid/origin under
// status.alertmanager.externalSync, plus the Synced condition in
// status.conditions). Future controllers writing their own areas should
// also use UpdateStatus + per-sub-tree mutation so we coexist cleanly on
// one resource.
func (s *ExternalAMSyncer) recordSyncResult(ctx context.Context, orgID int64, uid string, origin externalSyncOrigin, syncErr error) {
	c := s.resolveCfgClient()
	if c == nil {
		return
	}
	nsCtx, ns := s.orgServiceContext(ctx, orgID)
	if ns == "" {
		return
	}
	id := resource.Identifier{Namespace: ns, Name: configSingletonName}
	now := time.Now()

	err := retry.RetryOnConflict(retry.DefaultRetry, func() error {
		existing, getErr := c.Get(nsCtx, id)
		if k8serrors.IsNotFound(getErr) {
			// We populate .Status on Create because unified storage persists the
			// whole object on Create (no /status subresource separation today).
			// A future migration to a standard k8s apiserver shape would silently
			// drop this seed; the right fix then is a follow-up UpdateStatus call.
			newStatus := computeSyncStatus(nil, uid, origin, syncErr, now)
			r := &alertingadminv0alpha1.AlertingConfig{
				ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: configSingletonName},
				Status:     newStatus,
			}
			if _, createErr := c.Create(nsCtx, r, resource.CreateOptions{}); createErr != nil {
				// AlreadyExists means another writer raced us between Get-404 and Create;
				// surface it as a conflict so RetryOnConflict re-enters and the next
				// iteration sees the existing object.
				if k8serrors.IsAlreadyExists(createErr) {
					return k8serrors.NewConflict(alertingadminv0alpha1.AlertingConfigKind().GroupVersionResource().GroupResource(), id.Name, createErr)
				}
				return createErr
			}
			return nil
		}
		if getErr != nil {
			return getErr
		}
		newStatus := computeSyncStatus(&existing.Status, uid, origin, syncErr, now)
		_, updateErr := c.UpdateStatus(nsCtx, id, newStatus, resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
		return updateErr
	})
	if err != nil {
		s.logger.Warn("Failed to write AlertingConfig status", "org_id", orgID, "error", err)
	}
}

// computeSyncStatus folds the outcome of the current sync attempt into the
// previous AlertingConfig.status, producing a k8s-conventional Synced
// condition.
//
// Rules:
//   - On success (syncErr == nil): Synced=True, reason=SyncSucceeded, message="".
//   - On failure: Synced=False, reason=reasonOf(syncErr).ConditionReason() (so
//     classification flows from the same *SyncError that drives the metric
//     label), message=syncErr.Error().
//   - Synced.lastTransitionTime advances only when Synced.status flips (or
//     on first-ever write). Unchanged status preserves the previous time.
//     This is the standard k8s condition FSM, replicated here because the
//     codegen-emitted AlertingConfigCondition type isn't metav1.Condition,
//     so we can't use meta.SetStatusCondition directly.
//   - Auxiliary fields (datasourceUid, origin) live under
//     status.alertmanager.externalSync — nested by concern to mirror the
//     spec shape one-to-one.
//   - Other conditions in prev.Conditions are preserved as-is so future
//     controllers writing other condition types don't get clobbered.
//   - lastSuccessAt is intentionally NOT carried on the resource — heartbeat
//     data lives on metrics (ExternalAMConfigSyncTotal /
//     ExternalAMConfigSyncDuration) which have arbitrarily fine granularity
//     and don't fight for history budget. The resource only records state
//     transitions.
func computeSyncStatus(prev *alertingadminv0alpha1.AlertingConfigStatus, uid string, origin externalSyncOrigin, syncErr error, now time.Time) alertingadminv0alpha1.AlertingConfigStatus {
	uidCopy := uid
	originCopy := origin
	st := alertingadminv0alpha1.AlertingConfigStatus{
		ExternalAlertmanagerSync: &alertingadminv0alpha1.AlertingConfigV0alpha1StatusExternalAlertmanagerSync{
			DatasourceUid: &uidCopy,
			Origin:        &originCopy,
		},
	}

	var newStatus alertingadminv0alpha1.AlertingConfigConditionStatus
	var newReason, newMessage string
	if syncErr == nil {
		newStatus = alertingadminv0alpha1.AlertingConfigConditionStatusTrue
		newReason = conditionReasonSyncSucceeded
	} else {
		newStatus = alertingadminv0alpha1.AlertingConfigConditionStatusFalse
		newReason = reasonOf(syncErr).ConditionReason()
		newMessage = syncErr.Error()
	}

	// lastTransitionTime advances iff Synced.status changes. First-ever write
	// (no prior Synced condition) sets it to `now`.
	transitionTime := now.UTC().Format(time.RFC3339)
	for _, c := range prevConditions(prev) {
		if c.Type == conditionTypeExternalAlertmanagerSynced {
			if c.Status == newStatus {
				transitionTime = c.LastTransitionTime
			}
			break
		}
	}

	synced := alertingadminv0alpha1.AlertingConfigCondition{
		Type:               conditionTypeExternalAlertmanagerSynced,
		Status:             newStatus,
		LastTransitionTime: transitionTime,
		Reason:             newReason,
	}
	if newMessage != "" {
		synced.Message = &newMessage
	}

	// Preserve other condition types from prev, then upsert Synced. Future
	// controllers writing their own condition types on this resource see
	// their conditions left untouched here.
	for _, c := range prevConditions(prev) {
		if c.Type != conditionTypeExternalAlertmanagerSynced {
			st.Conditions = append(st.Conditions, c)
		}
	}
	st.Conditions = append(st.Conditions, synced)

	return st
}

// prevConditions returns the conditions list from prev, or nil. Helper so
// the caller doesn't need to nil-check both prev and prev.Conditions inline.
func prevConditions(prev *alertingadminv0alpha1.AlertingConfigStatus) []alertingadminv0alpha1.AlertingConfigCondition {
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
	if err != nil {
		return v1.ExtraConfiguration{}, 0, &SyncError{Reason: ReasonMimirFetch, Cause: fmt.Errorf("fetch upstream config: %w", err)}
	}

	if mimirCfg.AlertmanagerConfig == "" {
		return v1.ExtraConfiguration{}, 0, &SyncError{Reason: ReasonNoUpstreamConfig, Cause: fmt.Errorf("upstream Mimir has no alertmanager configuration to import")}
	}

	return v1.ExtraConfiguration{
		Identifier:         uid,
		AlertmanagerConfig: mimirCfg.AlertmanagerConfig,
		TemplateFiles:      mimirCfg.TemplateFiles,
	}, hash, nil
}

// externalSyncDatasourceUIDFromConfig walks the nested Config spec path
// (alertmanager → externalSync → datasourceUid) and returns the configured
// UID. Returns "" when any level in the chain is unset.
func externalSyncDatasourceUIDFromConfig(c *alertingadminv0alpha1.AlertingConfig) string {
	if c == nil ||
		c.Spec.ExternalAlertmanagerSync == nil ||
		c.Spec.ExternalAlertmanagerSync.DatasourceUid == nil {
		return ""
	}
	return *c.Spec.ExternalAlertmanagerSync.DatasourceUid
}

// resolveExternalAMUIDForOrg returns the datasource UID to use for external AM
// sync for the given org and where it came from. The operator-level
// ExternalAlertmanagerUID ini setting takes precedence over per-org config.
// Per-org config comes from the AdminConfig k8s resource when the AdminConfig
// API feature flag is enabled; otherwise it falls back to the legacy
// admin_config table. Returns "" when neither is set (sync should be skipped).
// Returns an error only on storage failure looking up the per-org config.
func (s *ExternalAMSyncer) resolveExternalAMUIDForOrg(ctx context.Context, orgID int64) (string, externalSyncOrigin, error) {
	if uid := s.settings.UnifiedAlerting.ExternalAlertmanagerUID; uid != "" {
		return uid, originIni, nil
	}

	if c := s.resolveCfgClient(); c != nil {
		nsCtx, ns := s.orgServiceContext(ctx, orgID)
		ac, err := c.Get(nsCtx, resource.Identifier{Namespace: ns, Name: configSingletonName})
		if err != nil {
			if k8serrors.IsNotFound(err) {
				return "", originAPI, nil
			}
			return "", "", err
		}
		return externalSyncDatasourceUIDFromConfig(ac), originAPI, nil
	}

	cfg, err := s.adminConfigStore.GetAdminConfiguration(orgID)
	if err != nil {
		if errors.Is(err, store.ErrNoAdminConfiguration) {
			return "", originAPI, nil
		}
		return "", "", err
	}
	if cfg.ExternalAlertmanagerUID == nil {
		return "", originAPI, nil
	}
	return *cfg.ExternalAlertmanagerUID, originAPI, nil
}

// IsConfiguredForOrg reports whether external Alertmanager sync is configured
// for the given org. True when the operator-level ini setting is non-empty
// (applies to all orgs) OR a non-empty datasource UID is set on the AdminConfig
// resource at .spec.alertmanager.externalSync.datasourceUid (or legacy
// admin_config table when the API flag is off).
func (s *ExternalAMSyncer) IsConfiguredForOrg(ctx context.Context, orgID int64) (bool, error) {
	if s.settings.UnifiedAlerting.ExternalAlertmanagerUID != "" {
		return true, nil
	}

	if c := s.resolveCfgClient(); c != nil {
		nsCtx, ns := s.orgServiceContext(ctx, orgID)
		ac, err := c.Get(nsCtx, resource.Identifier{Namespace: ns, Name: configSingletonName})
		if err != nil {
			if k8serrors.IsNotFound(err) {
				return false, nil
			}
			return false, err
		}
		return externalSyncDatasourceUIDFromConfig(ac) != "", nil
	}

	cfg, err := s.adminConfigStore.GetAdminConfiguration(orgID)
	if err != nil && !errors.Is(err, store.ErrNoAdminConfiguration) {
		return false, err
	}
	return cfg != nil && cfg.ExternalAlertmanagerUID != nil && *cfg.ExternalAlertmanagerUID != "", nil
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
