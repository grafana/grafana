package rulesync

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/promconvert"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
)

// rootFolderTitle is the folder the syncer lands imported namespaces under, so
// they are isolated from user-managed folders. One ruler datasource per org, so
// a single fixed title is used.
//
// NOTE: a user folder with the same title would be reused. This is
// non-destructive because prune only ever deletes rules whose
// SourceIdentifier matches this datasource; the exact naming convention (and
// whether to key it by datasource) is to be confirmed on tito-dev.
const rootFolderTitle = "External Ruler Sync"

const versionMessage = "external ruler sync"

const promoteVersionMessage = "external ruler sync: promote to native rules"

// ruleService is the subset of provisioning.AlertRuleService the syncer needs.
type ruleService interface {
	ReplaceRuleGroups(ctx context.Context, user identity.Requester, groups []*models.AlertRuleGroup, provenance models.Provenance, versionMessage string) error
	DeleteRuleGroups(ctx context.Context, user identity.Requester, provenance models.Provenance, filterOpts *provisioning.FilterOptions) error
	GetAlertGroupsWithFolderFullpath(ctx context.Context, user identity.Requester, filterOpts *provisioning.FilterOptions) ([]models.AlertRuleGroupWithFolderFullpath, error)
}

// namespaceStore creates/looks up the folders the imported rules live in.
type namespaceStore interface {
	GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, bool, error)
}

// rulerFetcher fetches the upstream ruler config. Satisfied by *RulerFetcher.
type rulerFetcher interface {
	Fetch(ctx context.Context, ds *datasources.DataSource) (RulerConfig, uint64, error)
}

type datasourceGetter interface {
	GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error)
}

type orgStore interface {
	FetchOrgIds(ctx context.Context) ([]int64, error)
}

// ExternalRulerSyncer mirrors alert rules from a configured external Mimir/Cortex
// ruler datasource into Grafana as converted-Prometheus rules. It is the rule
// analogue of ExternalAMSyncer. The loop driver (Run) is intentionally thin so
// the same SyncOrg core could later be hosted by an app runner instead.
//
// Promotion (the one-way exit): when spec.externalRulerSync.promote is set, the
// worker converts the rules it synced into native Grafana rules the org owns by
// clearing their provenance (converted_prometheus -> none, which makes them
// editable) and their SourceIdentifier (so prune stops owning them), then stops
// syncing and records the terminal PromotionCommitted status. This is the
// rule-side analogue of the Alertmanager sync's merge-commit.
type ExternalRulerSyncer struct {
	settings *setting.UnifiedAlertingSettings
	logger   log.Logger
	metrics  *Metrics

	datasources    datasourceGetter
	fetcher        rulerFetcher
	ruleService    ruleService
	namespaceStore namespaceStore
	orgStore       orgStore
	configStore    rulesConfigStore

	// featureEnabled reports whether the ruler sync feature flag is on. Injected
	// so tests don't need OpenFeature plumbing.
	featureEnabled func(ctx context.Context) bool

	lastSyncHashMu sync.RWMutex
	lastSyncHash   map[int64]uint64
}

// NewExternalRulerSyncer constructs an ExternalRulerSyncer. requestValidator may
// not be nil — pass &validations.OSSDataSourceRequestValidator{} for the no-op
// default. Nil clientGenerator/namespaceMapper (test paths that bypass the real
// config store) skip status writes.
func NewExternalRulerSyncer(
	settings *setting.UnifiedAlertingSettings,
	logger log.Logger,
	m *Metrics,
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	requestValidator validations.DataSourceRequestValidator,
	ruleSvc ruleService,
	namespaceStore namespaceStore,
	orgStore orgStore,
	clientGenerator resource.ClientGenerator,
	namespaceMapper request.NamespaceMapper,
) *ExternalRulerSyncer {
	return &ExternalRulerSyncer{
		settings:       settings,
		logger:         logger,
		metrics:        m,
		datasources:    datasourceService,
		fetcher:        NewRulerFetcher(datasourceService, httpClientProvider, requestValidator),
		ruleService:    ruleSvc,
		namespaceStore: namespaceStore,
		orgStore:       orgStore,
		configStore:    newK8sConfigStore(logger, clientGenerator, namespaceMapper),
		featureEnabled: func(ctx context.Context) bool {
			return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAlertingSyncExternalRuler, false, openfeature.TransactionContext(ctx))
		},
		lastSyncHash: make(map[int64]uint64),
	}
}

// Run polls all orgs at AdminConfigPollInterval until ctx is cancelled.
func (s *ExternalRulerSyncer) Run(ctx context.Context) error {
	s.logger.Info("Starting external ruler syncer", "poll_interval", s.settings.AdminConfigPollInterval)
	ticker := time.NewTicker(s.settings.AdminConfigPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			s.syncAllOrgs(ctx)
		}
	}
}

func (s *ExternalRulerSyncer) syncAllOrgs(ctx context.Context) {
	if !s.featureEnabled(ctx) {
		return
	}
	orgIDs, err := s.orgStore.FetchOrgIds(ctx)
	if err != nil {
		s.logger.Error("Failed to fetch org IDs for external ruler sync", "error", err)
		return
	}
	for _, orgID := range orgIDs {
		if _, disabled := s.settings.DisabledOrgs[orgID]; disabled {
			continue
		}
		// SyncOrg isolates per-org failures (logs + metrics internally).
		s.SyncOrg(ctx, orgID)
	}
}

// IsConfiguredForOrg reports whether external ruler sync is configured for the
// org — the operator ini override is set, or a non-empty datasource UID is set
// on the org's Config resource. Used by the convert API to reject manual rule
// imports while sync owns the org's rules.
func (s *ExternalRulerSyncer) IsConfiguredForOrg(ctx context.Context, orgID int64) (bool, error) {
	if s.settings.ExternalRulerUID != "" {
		return true, nil
	}
	spec, err := s.configStore.GetSyncSpec(ctx, orgID)
	if err != nil {
		return false, err
	}
	return spec.DatasourceUID != "", nil
}

// SyncOrg runs one sync tick for a single org. It never returns an error;
// failures are logged, counted, and reflected in the Config status so a bad org
// can't break the others.
func (s *ExternalRulerSyncer) SyncOrg(ctx context.Context, orgID int64) {
	if !s.featureEnabled(ctx) {
		return
	}

	orgIDStr := strconv.FormatInt(orgID, 10)

	rc, err := s.resolveExternalRulerConfig(ctx, orgID)
	if err != nil {
		s.recordFailure(ctx, orgID, orgIDStr, rc.queryUID, rc.origin, &SyncError{Reason: ReasonConfigRead, Cause: err})
		return
	}
	if rc.queryUID == "" {
		return // not configured for this org
	}

	svcCtx, svcUser := identity.WithServiceIdentity(ctx, orgID)

	// Promotion is the terminal exit: convert the synced rules to native rules
	// the org owns and stop syncing. Idempotent — once promoted there are no
	// owned rules left, so subsequent ticks are cheap no-ops that just re-assert
	// the terminal status.
	if rc.promote {
		if err := s.promote(svcCtx, svcUser, rc.queryUID); err != nil {
			s.recordFailure(ctx, orgID, orgIDStr, rc.queryUID, rc.origin, &SyncError{Reason: ReasonPromote, Cause: err})
			return
		}
		s.recordPromotionCommitted(ctx, orgID, rc.queryUID, rc.origin)
		return
	}

	start := time.Now()
	defer func() { s.metrics.SyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds()) }()

	ds, err := s.datasources.GetDataSource(svcCtx, &datasources.GetDataSourceQuery{UID: rc.queryUID, OrgID: orgID})
	if err != nil {
		s.recordFailure(ctx, orgID, orgIDStr, rc.queryUID, rc.origin, &SyncError{Reason: ReasonDatasourceLookup, Cause: err})
		return
	}

	// Recording rules write to the target datasource; it defaults to the query
	// datasource. Only resolve a distinct target when one is configured.
	targetDS := ds
	if rc.targetUID != "" && rc.targetUID != rc.queryUID {
		targetDS, err = s.datasources.GetDataSource(svcCtx, &datasources.GetDataSourceQuery{UID: rc.targetUID, OrgID: orgID})
		if err != nil {
			s.recordFailure(ctx, orgID, orgIDStr, rc.queryUID, rc.origin, &SyncError{Reason: ReasonDatasourceLookup, Cause: fmt.Errorf("target datasource %q: %w", rc.targetUID, err)})
			return
		}
	}

	cfg, hash, err := s.fetcher.Fetch(svcCtx, ds)
	if err != nil {
		reason := ReasonRulerFetch
		if errors.Is(err, ErrNotARuler) {
			reason = ReasonNotARuler
		}
		s.recordFailure(ctx, orgID, orgIDStr, rc.queryUID, rc.origin, &SyncError{Reason: reason, Cause: err})
		return
	}
	s.metrics.SyncTotal.WithLabelValues(orgIDStr).Inc()

	// Cross-tick dedup against the last successful save. Updated only after a
	// successful apply, so a failed tick is retried next time.
	s.lastSyncHashMu.RLock()
	prev, has := s.lastSyncHash[orgID]
	s.lastSyncHashMu.RUnlock()
	if has && prev == hash {
		s.logger.Debug("External ruler config unchanged since last sync", "org_id", orgID)
		return
	}

	if applyErr := s.apply(svcCtx, svcUser, orgID, rc.queryUID, ds, targetDS, cfg); applyErr != nil {
		s.recordFailure(ctx, orgID, orgIDStr, rc.queryUID, rc.origin, applyErr)
		return
	}

	s.lastSyncHashMu.Lock()
	s.lastSyncHash[orgID] = hash
	s.lastSyncHashMu.Unlock()
	s.metrics.SyncHash.WithLabelValues(orgIDStr).Set(float64(hash & mask53))
	s.recordSyncResult(ctx, orgID, rc.queryUID, rc.origin, nil)
	s.logger.Debug("External ruler sync applied", "org_id", orgID, "namespaces", len(cfg))
}

type groupKey struct {
	folderUID string
	group     string
}

// apply converts the fetched ruler config into Grafana rule groups, persists
// them, and prunes previously-synced groups that vanished upstream. Returns a
// classified *SyncError on failure.
func (s *ExternalRulerSyncer) apply(ctx context.Context, user identity.Requester, orgID int64, uid string, ds *datasources.DataSource, targetDS *datasources.DataSource, cfg RulerConfig) *SyncError {
	root, _, err := s.namespaceStore.GetOrCreateNamespaceByTitle(ctx, rootFolderTitle, orgID, user, "")
	if err != nil {
		return &SyncError{Reason: ReasonSave, Cause: fmt.Errorf("get-or-create root folder: %w", err)}
	}

	groups := make([]*models.AlertRuleGroup, 0)
	desired := make(map[groupKey]struct{})
	for namespace, promGroups := range cfg {
		nsFolder, _, err := s.namespaceStore.GetOrCreateNamespaceByTitle(ctx, namespace, orgID, user, root.UID)
		if err != nil {
			return &SyncError{Reason: ReasonSave, Cause: fmt.Errorf("get-or-create namespace folder %q: %w", namespace, err)}
		}
		for _, promGroup := range promGroups {
			group, err := promconvert.ConvertRuleGroup(s.settings, ds, targetDS, orgID, nsFolder.UID, promGroup, promconvert.Options{
				KeepOriginalRuleDefinition: true,
				SourceIdentifier:           uid,
			})
			if err != nil {
				return &SyncError{Reason: ReasonConvert, Cause: fmt.Errorf("convert group %q in namespace %q: %w", promGroup.Name, namespace, err)}
			}
			groups = append(groups, group)
			desired[groupKey{folderUID: nsFolder.UID, group: group.Title}] = struct{}{}
		}
	}

	if err := s.ruleService.ReplaceRuleGroups(ctx, user, groups, models.ProvenanceConvertedPrometheus, versionMessage); err != nil {
		return &SyncError{Reason: ReasonSave, Cause: err}
	}

	if err := s.prune(ctx, user, uid, desired); err != nil {
		return &SyncError{Reason: ReasonPrune, Cause: err}
	}
	return nil
}

// prune deletes converted-Prometheus rule groups that this datasource owns
// (SourceIdentifier == uid) but that are no longer present upstream. Scoping the
// store queries by SourceIdentifier ensures we never enumerate or delete
// manually-imported converted rules or rules synced from a different datasource.
func (s *ExternalRulerSyncer) prune(ctx context.Context, user identity.Requester, uid string, desired map[groupKey]struct{}) error {
	existing, err := s.ruleService.GetAlertGroupsWithFolderFullpath(ctx, user, &provisioning.FilterOptions{
		SourceIdentifier: &uid,
	})
	if err != nil {
		return fmt.Errorf("list converted rule groups: %w", err)
	}

	for _, g := range existing {
		if g.AlertRuleGroup == nil || len(g.Rules) == 0 {
			continue
		}
		if _, ok := desired[groupKey{folderUID: g.FolderUID, group: g.Title}]; ok {
			continue // still present upstream
		}
		if err := s.ruleService.DeleteRuleGroups(ctx, user, models.ProvenanceConvertedPrometheus, &provisioning.FilterOptions{
			NamespaceUIDs:    []string{g.FolderUID},
			RuleGroups:       []string{g.Title},
			SourceIdentifier: &uid,
		}); err != nil {
			return fmt.Errorf("delete stale rule group %q in folder %q: %w", g.Title, g.FolderUID, err)
		}
		s.logger.Info("Pruned external ruler rule group no longer present upstream", "folder_uid", g.FolderUID, "group", g.Title)
	}
	return nil
}

// promote converts the rules this datasource synced into native Grafana rules
// the org owns. For every converted rule the worker still owns (SourceIdentifier
// == uid) it clears the SourceIdentifier and rewrites the group with
// provenance=none, which the provisioning service permits for a
// converted_prometheus -> none transition. Clearing the SourceIdentifier both
// makes the rule editable and removes it from the prune scope, so if sync is
// later re-enabled these now-native rules are never touched. Idempotent: once
// promoted there are no owned rules left and this is a no-op.
func (s *ExternalRulerSyncer) promote(ctx context.Context, user identity.Requester, uid string) error {
	owned, err := s.ruleService.GetAlertGroupsWithFolderFullpath(ctx, user, &provisioning.FilterOptions{
		SourceIdentifier: &uid,
	})
	if err != nil {
		return fmt.Errorf("list owned rule groups: %w", err)
	}
	if len(owned) == 0 {
		return nil // already promoted / nothing synced
	}

	groups := make([]*models.AlertRuleGroup, 0, len(owned))
	for _, g := range owned {
		if g.AlertRuleGroup == nil {
			continue
		}
		group := *g.AlertRuleGroup
		rules := make([]models.AlertRule, len(group.Rules))
		for i, r := range group.Rules {
			// Copy the PrometheusStyleRule before clearing SourceIdentifier so we
			// never mutate the store's returned objects in place.
			if r.Metadata.PrometheusStyleRule != nil {
				psr := *r.Metadata.PrometheusStyleRule
				psr.SourceIdentifier = ""
				r.Metadata.PrometheusStyleRule = &psr
			}
			rules[i] = r
		}
		group.Rules = rules
		groups = append(groups, &group)
	}

	// provenance=none flips the stored converted_prometheus rules to user-owned;
	// the cleared SourceIdentifier makes it register as an update so the
	// provenance change is actually applied.
	if err := s.ruleService.ReplaceRuleGroups(ctx, user, groups, models.ProvenanceNone, promoteVersionMessage); err != nil {
		return fmt.Errorf("promote rule groups: %w", err)
	}
	s.logger.Info("Promoted external ruler rules to native Grafana rules", "datasource_uid", uid, "groups", len(groups))
	return nil
}

// resolvedSync is the effective external-ruler-sync configuration for one org,
// after applying the ini override and target/promote defaults.
type resolvedSync struct {
	queryUID  string             // datasource to sync rules from
	targetUID string             // recording-rules write target (defaults to queryUID)
	origin    externalSyncOrigin // where queryUID came from (ini vs api)
	promote   bool               // one-way promote-to-native requested
}

// resolveExternalRulerConfig computes the effective sync config for the org.
// The operator-level ini override wins over the per-org Config value for the
// query datasource; the ini path deliberately does not read the Config resource
// (so ini-only deployments stay unaffected by apiserver availability), which
// means target/promote — both spec-only knobs — are not honoured while the ini
// override is set. Under ini, the target defaults to the query datasource and
// promotion is off.
func (s *ExternalRulerSyncer) resolveExternalRulerConfig(ctx context.Context, orgID int64) (resolvedSync, error) {
	if iniUID := s.settings.ExternalRulerUID; iniUID != "" {
		return resolvedSync{queryUID: iniUID, targetUID: iniUID, origin: originIni}, nil
	}
	spec, err := s.configStore.GetSyncSpec(ctx, orgID)
	if err != nil {
		return resolvedSync{origin: originAPI}, err
	}
	targetUID := spec.TargetDatasourceUID
	if targetUID == "" {
		targetUID = spec.DatasourceUID
	}
	return resolvedSync{queryUID: spec.DatasourceUID, targetUID: targetUID, origin: originAPI, promote: spec.Promote}, nil
}

// recordFailure logs, counts, and records a classified failure onto the org's
// Config status.
func (s *ExternalRulerSyncer) recordFailure(ctx context.Context, orgID int64, orgIDStr, uid string, origin externalSyncOrigin, syncErr *SyncError) {
	s.logger.Warn("External ruler sync failed", "org_id", orgID, "reason", syncErr.Reason.Label(), "error", syncErr)
	s.metrics.SyncFailures.WithLabelValues(orgIDStr, syncErr.Reason.Label()).Inc()
	s.recordSyncResult(ctx, orgID, uid, origin, syncErr)
}

// recordPromotionCommitted writes the terminal PromotionCommitted status once
// the org's synced rules have been promoted to native rules (sync stops).
func (s *ExternalRulerSyncer) recordPromotionCommitted(ctx context.Context, orgID int64, uid string, origin externalSyncOrigin) {
	now := time.Now()
	if err := s.configStore.WriteStatus(ctx, orgID, func(prev *configStatus) configStatus {
		return computePromotedStatus(prev, uid, origin, now)
	}); err != nil {
		s.logger.Warn("Failed to write external ruler promotion status", "org_id", orgID, "error", err)
	}
}

// recordSyncResult writes the latest outcome (nil = success) onto the org's
// Config status. Best-effort.
func (s *ExternalRulerSyncer) recordSyncResult(ctx context.Context, orgID int64, uid string, origin externalSyncOrigin, syncErr error) {
	now := time.Now()
	if err := s.configStore.WriteStatus(ctx, orgID, func(prev *configStatus) configStatus {
		return computeSyncStatus(prev, uid, origin, syncErr, now)
	}); err != nil {
		s.logger.Warn("Failed to write external ruler sync status", "org_id", orgID, "error", err)
	}
}
