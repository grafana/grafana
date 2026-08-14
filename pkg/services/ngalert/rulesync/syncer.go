package rulesync

import (
	"context"
	"errors"
	"fmt"
	"runtime/debug"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

// rootFolderTitle is the title of the dedicated folder the syncer lands imported
// namespaces under, isolating them from user-managed folders. One folder per
// ruler datasource UID so distinct rulers never collide. prune and
// IsManagedFolder key on the folder UID, not this title, so a pre-existing user
// folder with the same title is harmless.
func rootFolderTitle(dsUID string) string {
	return fmt.Sprintf("[Alerting] External Ruler Sync (%s)", dsUID)
}

const versionMessage = "external ruler sync"

// convertedPrometheusManager marks the rules the syncer owns. Mirrors the manager
// the convert API assigns to converted-Prometheus imports.
var convertedPrometheusManager = utils.ManagerProperties{Kind: utils.ManagerKindClassicConvertedPrometheus} //nolint:staticcheck

// ruleService is the subset of provisioning.AlertRuleService the syncer needs.
type ruleService interface {
	ReplaceRuleGroups(ctx context.Context, user identity.Requester, groups []*models.AlertRuleGroup, manager utils.ManagerProperties, versionMessage string) error
	DeleteRuleGroups(ctx context.Context, user identity.Requester, manager utils.ManagerProperties, filterOpts *provisioning.FilterOptions) error
	GetAlertGroupsWithFolderFullpath(ctx context.Context, user identity.Requester, filterOpts *provisioning.FilterOptions) ([]models.AlertRuleGroupWithFolderFullpath, error)
}

// namespaceStore creates/looks up the folders the imported rules live in.
type namespaceStore interface {
	GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, bool, error)
	GetNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error)
	GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.FolderReference, error)
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

// ExternalRulerSyncer mirrors alert rules from a configured external Mimir
// ruler datasource into Grafana as converted-Prometheus rules. It is the rule
// analogue of ExternalAMSyncer. The loop driver (Run) is intentionally thin so
// the same SyncOrg core could later be hosted by an app runner instead.
type ExternalRulerSyncer struct {
	settings *setting.UnifiedAlertingSettings
	logger   log.Logger
	metrics  *Metrics

	datasources    datasourceGetter
	fetcher        rulerFetcher
	ruleService    ruleService
	namespaceStore namespaceStore
	orgStore       orgStore
	// folderPermissions restricts the sync folder to admin-only modification.
	folderPermissions accesscontrol.FolderPermissionsService

	lastSyncHashMu sync.RWMutex
	lastSyncHash   map[int64]uint64
}

// NewExternalRulerSyncer constructs an ExternalRulerSyncer. The ruler config GET
// is routed through the datasource proxy service (transport, auth and egress
// validation are handled there). The syncer runs from the external_ruler_uid
// ini setting alone.
func NewExternalRulerSyncer(
	settings *setting.UnifiedAlertingSettings,
	logger log.Logger,
	m *Metrics,
	datasourceService datasources.DataSourceService,
	proxy *datasourceproxy.DataSourceProxyService,
	ruleSvc ruleService,
	namespaceStore namespaceStore,
	orgStore orgStore,
	folderPermissions accesscontrol.FolderPermissionsService,
) *ExternalRulerSyncer {
	return &ExternalRulerSyncer{
		settings:          settings,
		logger:            logger,
		metrics:           m,
		datasources:       datasourceService,
		fetcher:           NewRulerFetcher(proxy, logger),
		ruleService:       ruleSvc,
		namespaceStore:    namespaceStore,
		orgStore:          orgStore,
		folderPermissions: folderPermissions,
		lastSyncHash:      make(map[int64]uint64),
	}
}

// Run polls all orgs at AdminConfigPollInterval until ctx is cancelled. It is a
// no-op unless the operator configured a ruler datasource via the
// external_ruler_uid setting — that setting is the enable signal (there is no
// separate feature flag).
func (s *ExternalRulerSyncer) Run(ctx context.Context) error {
	if s.settings.ExternalRulerUID == "" {
		s.logger.Debug("External ruler sync not configured (external_ruler_uid unset); not starting")
		return nil
	}
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
	orgIDs, err := s.orgStore.FetchOrgIds(ctx)
	if err != nil {
		s.logger.Error("Failed to fetch org IDs for external ruler sync", "error", err)
		return
	}
	for _, orgID := range orgIDs {
		if _, disabled := s.settings.DisabledOrgs[orgID]; disabled {
			continue
		}
		s.SyncOrg(ctx, orgID)
	}
}

// IsConfiguredForOrg reports whether external ruler sync is configured — i.e.
// the external_ruler_uid ini setting is set. Used by the convert API to reject
// manual rule imports while sync owns the org's rules.
func (s *ExternalRulerSyncer) IsConfiguredForOrg(_ context.Context, _ int64) (bool, error) {
	return s.settings.ExternalRulerUID != "", nil
}

// IsManagedFolder reports whether folderUID is inside the org's sync-managed
// folder subtree — the dedicated root folder (resolved by its deterministic
// title) or one of its namespace subfolders. The convert API uses it to fold the
// 409 gate down to just the folders the sync worker owns, so manual imports into
// unrelated folders are still allowed. If the root folder doesn't exist yet
// nothing is managed, so this returns false (allow).
func (s *ExternalRulerSyncer) IsManagedFolder(ctx context.Context, orgID int64, folderUID string) (bool, error) {
	uid := s.settings.ExternalRulerUID
	if uid == "" {
		return false, nil
	}
	svcCtx, user := identity.WithServiceIdentity(ctx, orgID)
	root, err := s.namespaceStore.GetNamespaceByTitle(svcCtx, rootFolderTitle(uid), orgID, user, "")
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return false, nil
		}
		return false, fmt.Errorf("look up sync root folder: %w", err)
	}
	if folderUID == root.UID {
		return true, nil
	}
	// Namespaces are the only subfolders and never nest, so direct children suffice.
	children, err := s.namespaceStore.GetNamespaceChildren(svcCtx, root.UID, orgID, user)
	if err != nil {
		return false, fmt.Errorf("list sync folder children: %w", err)
	}
	for _, child := range children {
		if child.UID == folderUID {
			return true, nil
		}
	}
	return false, nil
}

// SyncOrg runs one sync tick for a single org. It never returns an error;
// failures are logged and counted so a bad org can't break the others.
func (s *ExternalRulerSyncer) SyncOrg(ctx context.Context, orgID int64) {
	orgIDStr := strconv.FormatInt(orgID, 10)
	// A panic in a per-org tick (conversion, datasource proxy, upstream response)
	// must not crash the background syncer goroutine and the process; recover and
	// record it like any other per-org failure.
	defer func() {
		if r := recover(); r != nil {
			s.logger.Error("External ruler sync panicked", "org_id", orgID, "panic", r, "stack", string(debug.Stack()))
			s.metrics.SyncFailures.WithLabelValues(orgIDStr, ReasonPanic.Label()).Inc()
		}
	}()

	uid := s.settings.ExternalRulerUID
	if uid == "" {
		return
	}

	svcCtx, svcUser := identity.WithServiceIdentity(ctx, orgID)

	start := time.Now()
	defer func() { s.metrics.SyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds()) }()

	ds, err := s.datasources.GetDataSource(svcCtx, &datasources.GetDataSourceQuery{UID: uid, OrgID: orgID})
	if err != nil {
		s.recordFailure(orgID, orgIDStr, &SyncError{Reason: ReasonDatasourceLookup, Cause: err})
		return
	}
	// TODO: validate the datasource (prometheus-compatible + Mimir flavor) at the
	// rules-app Config-resource admission when it lands, mirroring the external
	// Alertmanager sync's input-time check. The operator-set ini datasource is
	// trusted here (as the AM ini path is).
	//
	// Recording rules write to the same datasource they are queried from.
	targetDS := ds

	cfg, hash, err := s.fetcher.Fetch(svcCtx, ds)
	if err != nil {
		reason := ReasonRulerFetch
		if errors.Is(err, ErrNotARuler) {
			reason = ReasonNotARuler
		}
		s.recordFailure(orgID, orgIDStr, &SyncError{Reason: reason, Cause: err})
		return
	}
	s.metrics.SyncTotal.WithLabelValues(orgIDStr).Inc()

	// Skip if the upstream is unchanged since the last successful apply.
	s.lastSyncHashMu.RLock()
	prev, has := s.lastSyncHash[orgID]
	s.lastSyncHashMu.RUnlock()
	if has && prev == hash {
		s.logger.Debug("External ruler config unchanged since last sync", "org_id", orgID)
		return
	}

	if applyErr := s.apply(svcCtx, svcUser, orgID, ds, targetDS, cfg); applyErr != nil {
		s.recordFailure(orgID, orgIDStr, applyErr)
		return
	}

	s.lastSyncHashMu.Lock()
	s.lastSyncHash[orgID] = hash
	s.lastSyncHashMu.Unlock()
	s.metrics.SyncHash.WithLabelValues(orgIDStr).Set(float64(hash & mask53))
	s.logger.Debug("External ruler sync applied", "org_id", orgID, "namespaces", len(cfg))
}

type groupKey struct {
	folderUID string
	group     string
}

// apply converts the fetched ruler config into Grafana rule groups, persists
// them, and prunes previously-synced groups that vanished upstream. Returns a
// classified *SyncError on failure.
func (s *ExternalRulerSyncer) apply(ctx context.Context, user identity.Requester, orgID int64, ds *datasources.DataSource, targetDS *datasources.DataSource, cfg RulerConfig) *SyncError {
	root, created, err := s.namespaceStore.GetOrCreateNamespaceByTitle(ctx, rootFolderTitle(ds.UID), orgID, user, "")
	if err != nil {
		return &SyncError{Reason: ReasonSave, Cause: fmt.Errorf("get-or-create root folder: %w", err)}
	}
	if created {
		s.restrictFolderToAdmins(ctx, orgID, root.UID)
	}

	groups := make([]*models.AlertRuleGroup, 0)
	desired := make(map[groupKey]struct{})
	for namespace, promGroups := range cfg {
		nsFolder, _, err := s.namespaceStore.GetOrCreateNamespaceByTitle(ctx, namespace, orgID, user, root.UID)
		if err != nil {
			return &SyncError{Reason: ReasonSave, Cause: fmt.Errorf("get-or-create namespace folder %q: %w", namespace, err)}
		}
		for _, promGroup := range promGroups {
			group, err := prom.ConvertRuleGroup(s.settings, ds, targetDS, orgID, nsFolder.UID, promGroup, prom.Options{
				KeepOriginalRuleDefinition: true,
			})
			if err != nil {
				// Best-effort: skip a group we can't convert (e.g. it has recording
				// rules but recording rules are disabled) rather than aborting the whole
				// org — one bad group must not block the rest.
				s.logger.Warn("Skipping external ruler group that failed to convert", "org_id", orgID, "namespace", namespace, "group", promGroup.Name, "error", err)
				continue
			}
			groups = append(groups, group)
			desired[groupKey{folderUID: nsFolder.UID, group: group.Title}] = struct{}{}
		}
	}

	if err := s.ruleService.ReplaceRuleGroups(ctx, user, groups, convertedPrometheusManager, versionMessage); err != nil {
		return &SyncError{Reason: ReasonSave, Cause: err}
	}

	orgIDStr := strconv.FormatInt(orgID, 10)
	ruleCount := 0
	for _, g := range groups {
		ruleCount += len(g.Rules)
	}
	s.metrics.SyncGroups.WithLabelValues(orgIDStr).Set(float64(len(groups)))
	s.metrics.SyncRules.WithLabelValues(orgIDStr).Set(float64(ruleCount))

	if err := s.prune(ctx, user, orgID, root.UID, desired); err != nil {
		return &SyncError{Reason: ReasonPrune, Cause: err}
	}
	return nil
}

// restrictFolderToAdmins locks a freshly-created sync folder to admin-only
// modification: editors and viewers get view-only, so operators can see the
// synced rules but not change what the sync owns. Admins keep full access, the
// sync itself runs as a service identity so it is unaffected, and namespace
// subfolders inherit these permissions. Best-effort: a permissions failure is
// logged, not fatal, so it never blocks the rule sync.
func (s *ExternalRulerSyncer) restrictFolderToAdmins(ctx context.Context, orgID int64, folderUID string) {
	if _, err := s.folderPermissions.SetPermissions(ctx, orgID, folderUID,
		accesscontrol.SetResourcePermissionCommand{BuiltinRole: string(org.RoleEditor), Permission: "View"},
		accesscontrol.SetResourcePermissionCommand{BuiltinRole: string(org.RoleViewer), Permission: "View"},
	); err != nil {
		s.logger.Warn("Failed to restrict external ruler sync folder to admin-only access", "org_id", orgID, "folder_uid", folderUID, "error", err)
	}
}

// prune deletes converted-Prometheus rule groups that live under the sync's
// dedicated folder subtree (the root folder and its namespace subfolders) but
// that are no longer present upstream. Scoping the store queries to those
// folders ensures we never enumerate or delete converted rules that live in
// user-managed folders.
func (s *ExternalRulerSyncer) prune(ctx context.Context, user identity.Requester, orgID int64, rootUID string, desired map[groupKey]struct{}) error {
	children, err := s.namespaceStore.GetNamespaceChildren(ctx, rootUID, orgID, user)
	if err != nil {
		return fmt.Errorf("list sync folder children: %w", err)
	}
	nsUIDs := make([]string, 0, len(children)+1)
	nsUIDs = append(nsUIDs, rootUID)
	for _, child := range children {
		nsUIDs = append(nsUIDs, child.UID)
	}

	existing, err := s.ruleService.GetAlertGroupsWithFolderFullpath(ctx, user, &provisioning.FilterOptions{
		NamespaceUIDs:               nsUIDs,
		HasPrometheusRuleDefinition: new(true),
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
		if err := s.ruleService.DeleteRuleGroups(ctx, user, convertedPrometheusManager, &provisioning.FilterOptions{
			NamespaceUIDs:               []string{g.FolderUID},
			RuleGroups:                  []string{g.Title},
			HasPrometheusRuleDefinition: new(true),
		}); err != nil {
			return fmt.Errorf("delete stale rule group %q in folder %q: %w", g.Title, g.FolderUID, err)
		}
		s.logger.Info("Pruned external ruler rule group no longer present upstream", "folder_uid", g.FolderUID, "group", g.Title)
	}
	// TODO: delete a namespace subfolder (and the root) once it has no rules
	// left, instead of leaving it empty. Deferred until we track a durable owner
	// marker on the folder, so we can be sure it is ours and truly empty (no
	// user-created dashboards or rules) before deleting.
	return nil
}

// recordFailure logs a classified failure and increments the failures metric.
func (s *ExternalRulerSyncer) recordFailure(orgID int64, orgIDStr string, syncErr *SyncError) {
	s.logger.Warn("External ruler sync failed", "org_id", orgID, "reason", syncErr.Reason.Label(), "error", syncErr)
	s.metrics.SyncFailures.WithLabelValues(orgIDStr, syncErr.Reason.Label()).Inc()
}
