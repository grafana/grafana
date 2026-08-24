package rulesync

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/setting"
)

// enableRulerSyncAPIFlag flips the global OpenFeature provider so
// rulerSyncAPIEnabled reports true for the duration of the test. Mirrors the
// external Alertmanager sync tests' own flag setup; restores the no-op
// provider on cleanup since this is process-global state.
func enableRulerSyncAPIFlag(t *testing.T) {
	t.Helper()
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagAlertingSyncExternalRuler: {
			DefaultVariant: "on",
			Variants:       map[string]any{"on": true},
		},
	})))
	t.Cleanup(func() { _ = openfeature.SetProvider(openfeature.NoopProvider{}) })
}

// --- fakes ---

type fakeFetcher struct {
	cfg      RulerConfig
	hash     uint64
	err      error
	calls    int
	panicMsg string
}

func (f *fakeFetcher) Fetch(context.Context, *datasources.DataSource) (RulerConfig, uint64, error) {
	f.calls++
	if f.panicMsg != "" {
		panic(f.panicMsg)
	}
	return f.cfg, f.hash, f.err
}

type fakeRuleService struct {
	replaced        []*models.AlertRuleGroup
	replacedManager utils.ManagerProperties
	replacedVersion string
	existing        []models.AlertRuleGroupWithFolderFullpath
	deleted         []provisioning.FilterOptions
}

func (f *fakeRuleService) ReplaceRuleGroups(_ context.Context, _ identity.Requester, groups []*models.AlertRuleGroup, manager utils.ManagerProperties, versionMessage string) error {
	f.replaced = groups
	f.replacedManager = manager
	f.replacedVersion = versionMessage
	return nil
}
func (f *fakeRuleService) DeleteRuleGroups(_ context.Context, _ identity.Requester, _ utils.ManagerProperties, filterOpts *provisioning.FilterOptions) error {
	f.deleted = append(f.deleted, *filterOpts)
	return nil
}
func (f *fakeRuleService) GetAlertGroupsWithFolderFullpath(_ context.Context, _ identity.Requester, filterOpts *provisioning.FilterOptions) ([]models.AlertRuleGroupWithFolderFullpath, error) {
	// Emulate the store's NamespaceUIDs filter so the fake is faithful to the
	// real query the syncer relies on for folder-scoped prune.
	if filterOpts == nil || len(filterOpts.NamespaceUIDs) == 0 {
		return f.existing, nil
	}
	allowed := make(map[string]struct{}, len(filterOpts.NamespaceUIDs))
	for _, uid := range filterOpts.NamespaceUIDs {
		allowed[uid] = struct{}{}
	}
	var out []models.AlertRuleGroupWithFolderFullpath
	for _, g := range f.existing {
		if g.AlertRuleGroup == nil {
			continue
		}
		if _, ok := allowed[g.FolderUID]; ok {
			out = append(out, g)
		}
	}
	return out, nil
}

// fakeNamespaceStore returns a folder whose UID is the title prefixed, so root
// and namespace folders get distinct, deterministic UIDs. children configures
// the folders returned by GetNamespaceChildren (the sync's namespace subfolders).
type fakeNamespaceStore struct {
	children []*folder.FolderReference
	// byTitle resolves GetNamespaceByTitle; a missing title yields ErrFolderNotFound.
	byTitle map[string]*folder.FolderReference
	// created is the "newly created" flag GetOrCreateNamespaceByTitle returns,
	// which drives the admin-only permission set on the sync root folder.
	created bool
}

func (f fakeNamespaceStore) GetOrCreateNamespaceByTitle(_ context.Context, title string, _ int64, _ identity.Requester, _ string) (*folder.FolderReference, bool, error) {
	return &folder.FolderReference{UID: "folder-" + title, Title: title}, f.created, nil
}

func (f fakeNamespaceStore) GetNamespaceByTitle(_ context.Context, title string, _ int64, _ identity.Requester, _ string) (*folder.FolderReference, error) {
	if fr, ok := f.byTitle[title]; ok {
		return fr, nil
	}
	return nil, dashboards.ErrFolderNotFound
}

func (f fakeNamespaceStore) GetNamespaceChildren(_ context.Context, _ string, _ int64, _ identity.Requester) ([]*folder.FolderReference, error) {
	return f.children, nil
}

type fakeDatasourceGetter struct {
	ds        *datasources.DataSource
	requested *[]string // optional: records every requested UID, in order
}

func (f fakeDatasourceGetter) GetDataSource(_ context.Context, q *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	if f.requested != nil {
		*f.requested = append(*f.requested, q.UID)
	}
	// Return a datasource carrying the requested UID.
	return &datasources.DataSource{UID: q.UID, OrgID: q.OrgID, Type: f.ds.Type, URL: f.ds.URL}, nil
}

// recordingFolderPermissions captures the SetPermissions calls the syncer makes
// to lock its folder to admin-only access. It embeds the interface so only the
// one method the syncer actually uses needs implementing.
type recordingFolderPermissions struct {
	accesscontrol.FolderPermissionsService
	got map[string][]accesscontrol.SetResourcePermissionCommand
}

func (f *recordingFolderPermissions) SetPermissions(_ context.Context, _ int64, resourceID string, cmds ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error) {
	if f.got == nil {
		f.got = map[string][]accesscontrol.SetResourcePermissionCommand{}
	}
	f.got[resourceID] = cmds
	return nil, nil
}

func newTestSyncer(t *testing.T, fetch *fakeFetcher, rs *fakeRuleService) *ExternalRulerSyncer {
	t.Helper()
	return &ExternalRulerSyncer{
		settings:          &setting.UnifiedAlertingSettings{DefaultRuleEvaluationInterval: time.Minute},
		logger:            log.NewNopLogger(),
		metrics:           NewMetrics(nil),
		datasources:       fakeDatasourceGetter{ds: &datasources.DataSource{UID: "ds1", OrgID: 1, Type: datasources.DS_PROMETHEUS, URL: "http://mimir/prometheus"}},
		fetcher:           fetch,
		ruleService:       rs,
		namespaceStore:    fakeNamespaceStore{},
		folderPermissions: &recordingFolderPermissions{},
		lastSyncHash:      make(map[int64]uint64),
	}
}

// newTestSyncerWithConfigClient is newTestSyncer plus a wired Config
// k8s-client (and namespace mapper), so the API path (resolveExternalRulerUIDForOrg's
// Config branch, writeStatus, recordNotConfigured) is reachable in tests.
func newTestSyncerWithConfigClient(t *testing.T, cs *fakeConfigClient, fetch *fakeFetcher, rs *fakeRuleService) *ExternalRulerSyncer {
	t.Helper()
	s := newTestSyncer(t, fetch, rs)
	s.clientGenerator = cs
	s.namespaceMapper = cs.nsMapper
	return s
}

func upstreamGroup(name, alert string) RulerConfig {
	return RulerConfig{
		"ns1": {{Name: name, Rules: []apimodels.PrometheusRule{{Alert: alert, Expr: "up == 0"}}}},
	}
}

// ownedGroup builds an existing converted rule group in folderUID. The rule
// carries a PrometheusStyleRule with a non-empty OriginalRuleDefinition so
// HasPrometheusRuleDefinition() reports true, matching the store's filter.
func ownedGroup(folderUID, group string) models.AlertRuleGroupWithFolderFullpath {
	return models.AlertRuleGroupWithFolderFullpath{
		AlertRuleGroup: &models.AlertRuleGroup{
			Title:     group,
			FolderUID: folderUID,
			Rules: []models.AlertRule{{
				Title:    "r",
				Metadata: models.AlertRuleMetadata{PrometheusStyleRule: &models.PrometheusStyleRule{OriginalRuleDefinition: "def"}},
			}},
		},
	}
}

func TestSyncOrg_HappyPath(t *testing.T) {
	rs := &fakeRuleService{}
	s := newTestSyncer(t, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 111}, rs)
	s.settings.ExternalRulerUID = "ds1"

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1, "one group replaced")
	require.Len(t, rs.replaced[0].Rules, 1)
}

func TestSyncOrg_NotConfigured(t *testing.T) {
	rs := &fakeRuleService{}
	s := newTestSyncer(t, &fakeFetcher{}, rs)
	// ExternalRulerUID unset → nothing synced.

	s.SyncOrg(context.Background(), 1)

	assert.Nil(t, rs.replaced, "nothing synced when not configured")
}

func TestSyncOrg_Dedup(t *testing.T) {
	rs := &fakeRuleService{}
	s := newTestSyncer(t, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 42}, rs)
	s.settings.ExternalRulerUID = "ds1"

	s.SyncOrg(context.Background(), 1)
	require.Len(t, rs.replaced, 1)

	// Second tick, same hash → skipped (replaced reset to confirm not called again).
	rs.replaced = nil
	s.SyncOrg(context.Background(), 1)
	assert.Nil(t, rs.replaced, "unchanged hash is deduped")
}

func TestSyncOrg_NotARuler(t *testing.T) {
	rs := &fakeRuleService{}
	s := newTestSyncer(t, &fakeFetcher{err: ErrNotARuler}, rs)
	s.settings.ExternalRulerUID = "ds1"

	s.SyncOrg(context.Background(), 1)

	assert.Nil(t, rs.replaced, "nothing synced when the datasource is not a ruler")
}

func TestSyncOrg_PruneScopedByFolder(t *testing.T) {
	rs := &fakeRuleService{
		existing: []models.AlertRuleGroupWithFolderFullpath{
			// Under a sync folder but NOT in upstream (ns1/g1 is upstream) → pruned.
			ownedGroup("folder-ns1", "stale-group"),
			// Under a folder outside the sync subtree → filtered out, NOT pruned.
			ownedGroup("folder-other", "other-group"),
			// Still present upstream (ns1/g1) → must NOT be pruned.
			ownedGroup("folder-ns1", "g1"),
		},
	}
	s := newTestSyncer(t, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 7}, rs)
	s.settings.ExternalRulerUID = "ds1"
	// The sync's namespace subfolders (children of the root sync folder).
	s.namespaceStore = fakeNamespaceStore{children: []*folder.FolderReference{{UID: "folder-ns1", Title: "ns1"}}}

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.deleted, 1, "exactly one stale, in-folder group pruned")
	assert.Equal(t, []string{"folder-ns1"}, rs.deleted[0].NamespaceUIDs)
	assert.Equal(t, []string{"stale-group"}, rs.deleted[0].RuleGroups)
	// Delete is scoped to converted-Prometheus rules only.
	require.NotNil(t, rs.deleted[0].HasPrometheusRuleDefinition)
	assert.True(t, *rs.deleted[0].HasPrometheusRuleDefinition)
}

func TestSyncOrg_SkipsUnconvertibleGroup(t *testing.T) {
	// Recording rules are disabled in the test settings, so the recording group
	// can't convert. It must be skipped (best-effort), not abort the whole org.
	cfg := RulerConfig{
		"ns1": {
			{Name: "alerts", Rules: []apimodels.PrometheusRule{{Alert: "A", Expr: "up == 0"}}},
			{Name: "recording", Rules: []apimodels.PrometheusRule{{Record: "r", Expr: "vector(1)"}}},
		},
	}
	rs := &fakeRuleService{}
	s := newTestSyncer(t, &fakeFetcher{cfg: cfg, hash: 1}, rs)
	s.settings.ExternalRulerUID = "ds1"

	s.SyncOrg(context.Background(), 1)

	// The alert group is applied; the recording group is skipped.
	require.Len(t, rs.replaced, 1)
	assert.Equal(t, "alerts", rs.replaced[0].Title)
}

func TestSyncOrg_RecoversPanic(t *testing.T) {
	s := newTestSyncer(t, &fakeFetcher{panicMsg: "boom"}, &fakeRuleService{})
	s.settings.ExternalRulerUID = "ds1"

	// A panic in a tick must be recovered so the background goroutine survives.
	require.NotPanics(t, func() { s.SyncOrg(context.Background(), 1) })
}

func TestIsManagedFolder(t *testing.T) {
	ctx := context.Background()
	root := &folder.FolderReference{UID: "root-uid", Title: rootFolderTitle("ds1")}
	child := &folder.FolderReference{UID: "child-uid", Title: "ns1", ParentUID: "root-uid"}

	newSyncer := func(ns fakeNamespaceStore, uid string) *ExternalRulerSyncer {
		return &ExternalRulerSyncer{
			settings:       &setting.UnifiedAlertingSettings{ExternalRulerUID: uid},
			logger:         log.NewNopLogger(),
			namespaceStore: ns,
		}
	}
	rootResolvable := fakeNamespaceStore{
		byTitle:  map[string]*folder.FolderReference{rootFolderTitle("ds1"): root},
		children: []*folder.FolderReference{child},
	}

	t.Run("unconfigured -> not managed", func(t *testing.T) {
		managed, err := newSyncer(rootResolvable, "").IsManagedFolder(ctx, 1, "root-uid")
		require.NoError(t, err)
		assert.False(t, managed)
	})

	t.Run("root folder does not exist yet -> not managed", func(t *testing.T) {
		managed, err := newSyncer(fakeNamespaceStore{}, "ds1").IsManagedFolder(ctx, 1, "root-uid")
		require.NoError(t, err)
		assert.False(t, managed)
	})

	t.Run("the root folder itself is managed", func(t *testing.T) {
		managed, err := newSyncer(rootResolvable, "ds1").IsManagedFolder(ctx, 1, "root-uid")
		require.NoError(t, err)
		assert.True(t, managed)
	})

	t.Run("a namespace subfolder is managed", func(t *testing.T) {
		managed, err := newSyncer(rootResolvable, "ds1").IsManagedFolder(ctx, 1, "child-uid")
		require.NoError(t, err)
		assert.True(t, managed)
	})

	t.Run("an unrelated folder is not managed", func(t *testing.T) {
		managed, err := newSyncer(rootResolvable, "ds1").IsManagedFolder(ctx, 1, "user-folder")
		require.NoError(t, err)
		assert.False(t, managed)
	})
}

func TestRun_StopsOnContextCancel(t *testing.T) {
	// Run always starts the poll loop now: sync can be enabled per-org via the
	// rules Config resource even when external_ruler_uid is unset, and only a
	// per-org tick (resolveExternalRulerUIDForOrg) can tell which. Run itself
	// must still exit cleanly on cancellation regardless.
	s := newTestSyncer(t, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, &fakeRuleService{})
	s.settings.AdminConfigPollInterval = time.Minute // long enough that ctx.Done() always wins the select first

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx) }()
	cancel()
	select {
	case err := <-done:
		require.NoError(t, err)
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after context cancellation")
	}
}

func TestSyncOrg_NoOpWhenUnconfigured(t *testing.T) {
	// Neither external_ruler_uid nor the Config-resource API path (no client
	// generator wired, matching the test fixtures) is configured: SyncOrg must
	// do nothing — no datasource lookup, no fetch, no rule changes.
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}
	rs := &fakeRuleService{}
	s := newTestSyncer(t, fetch, rs)
	require.Empty(t, s.settings.ExternalRulerUID)
	require.Nil(t, s.clientGenerator)

	s.SyncOrg(context.Background(), 1)

	assert.Zero(t, fetch.calls, "fetcher must not be called when sync isn't configured for the org")
	assert.Nil(t, rs.replaced, "no rule groups should be replaced when sync isn't configured for the org")
}

func TestSyncOrg_RestrictsNewFolderToAdmins(t *testing.T) {
	perms := &recordingFolderPermissions{}
	s := newTestSyncer(t, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, &fakeRuleService{})
	s.settings.ExternalRulerUID = "ds1"
	s.namespaceStore = fakeNamespaceStore{created: true}
	s.folderPermissions = perms

	s.SyncOrg(context.Background(), 1)

	root := "folder-" + rootFolderTitle("ds1")
	require.Contains(t, perms.got, root, "permissions set on the newly-created sync root folder")
	byRole := map[string]string{}
	for _, c := range perms.got[root] {
		byRole[c.BuiltinRole] = c.Permission
	}
	// Editors and viewers are view-only; admins keep full access implicitly.
	assert.Equal(t, "View", byRole["Editor"])
	assert.Equal(t, "View", byRole["Viewer"])
}

func TestSyncOrg_DoesNotResetPermissionsOnExistingFolder(t *testing.T) {
	perms := &recordingFolderPermissions{}
	s := newTestSyncer(t, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, &fakeRuleService{})
	s.settings.ExternalRulerUID = "ds1"
	s.namespaceStore = fakeNamespaceStore{} // created == false
	s.folderPermissions = perms

	s.SyncOrg(context.Background(), 1)

	assert.Empty(t, perms.got, "permissions are only set when the folder is first created")
}

func TestSyncOrg_FromConfigAPI(t *testing.T) {
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1", "")
	rs := &fakeRuleService{}
	s := newTestSyncerWithConfigClient(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1, "sync applies when the API path resolves a datasource UID")
	st := cs.statusFor(1)
	require.NotNil(t, st, "sync outcome is written to the Config resource")
	require.Len(t, st.Conditions, 1)
	assert.Equal(t, conditionTypeExternalRulerSynced, st.Conditions[0].Type)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusTrue, st.Conditions[0].Status)
	assert.Equal(t, conditionReasonSyncSucceeded, st.Conditions[0].Reason)
	require.NotNil(t, st.ExternalRulerSync)
	assert.Equal(t, alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSyncOriginApi, *st.ExternalRulerSync.Origin)
}

func TestSyncOrg_IniOverridesConfigAPI(t *testing.T) {
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpec(1, "from-config", "")
	rs := &fakeRuleService{}
	s := newTestSyncerWithConfigClient(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)
	s.settings.ExternalRulerUID = "from-ini"

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1)
	st := cs.statusFor(1)
	require.NotNil(t, st)
	require.NotNil(t, st.ExternalRulerSync)
	assert.Equal(t, "from-ini", *st.ExternalRulerSync.DatasourceUid, "the ini override wins over the Config spec value")
	assert.Equal(t, alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSyncOriginIni, *st.ExternalRulerSync.Origin)
}

func TestSyncOrg_NotConfiguredSeedsSingletonWhenFlagOn(t *testing.T) {
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient() // no spec seeded for org 1
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}
	rs := &fakeRuleService{}
	s := newTestSyncerWithConfigClient(t, cs, fetch, rs)

	s.SyncOrg(context.Background(), 1)

	assert.Zero(t, fetch.calls, "no ruler fetch when nothing is configured")
	st := cs.statusFor(1)
	require.NotNil(t, st, "the singleton is seeded so it reliably exists")
	require.Len(t, st.Conditions, 1)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusUnknown, st.Conditions[0].Status)
	assert.Equal(t, conditionReasonNotConfigured, st.Conditions[0].Reason)
}

func TestSyncOrg_APIPathUnreachableWithoutFlag(t *testing.T) {
	// Flag left off (no enableRulerSyncAPIFlag call): the API path must not be
	// touched at all, even though a client is wired.
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1", "")
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}
	rs := &fakeRuleService{}
	s := newTestSyncerWithConfigClient(t, cs, fetch, rs)

	s.SyncOrg(context.Background(), 1)

	assert.Zero(t, fetch.calls)
	assert.Zero(t, cs.getCallCount(1), "the Config resource is never even read when the flag is off")
}

func TestSyncOrg_TargetDatasourceFromConfig(t *testing.T) {
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1", "tds1")
	rs := &fakeRuleService{}
	var requested []string
	s := newTestSyncerWithConfigClient(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)
	s.datasources = fakeDatasourceGetter{ds: &datasources.DataSource{Type: datasources.DS_PROMETHEUS, URL: "http://mimir/prometheus"}, requested: &requested}

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1)
	assert.ElementsMatch(t, []string{"ds1", "tds1"}, requested, "both the query and the distinct target datasource are resolved")
}

func TestSyncOrg_TargetDatasourceDefaultsToQuery(t *testing.T) {
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1", "") // no targetDatasourceUid
	rs := &fakeRuleService{}
	var requested []string
	s := newTestSyncerWithConfigClient(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)
	s.datasources = fakeDatasourceGetter{ds: &datasources.DataSource{Type: datasources.DS_PROMETHEUS, URL: "http://mimir/prometheus"}, requested: &requested}

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1)
	assert.Equal(t, []string{"ds1"}, requested, "target defaults to the query datasource: only one lookup")
}

func TestSyncOrg_Promote(t *testing.T) {
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpecWithPromote(1, "ds1", "", true)
	rs := &fakeRuleService{
		existing: []models.AlertRuleGroupWithFolderFullpath{
			ownedGroup("folder-ns1", "g1"),
		},
	}
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 5}
	s := newTestSyncerWithConfigClient(t, cs, fetch, rs)
	s.namespaceStore = fakeNamespaceStore{
		byTitle:  map[string]*folder.FolderReference{rootFolderTitle("ds1"): {UID: "folder-" + rootFolderTitle("ds1"), Title: rootFolderTitle("ds1")}},
		children: []*folder.FolderReference{{UID: "folder-ns1", Title: "ns1"}},
	}

	s.SyncOrg(context.Background(), 1)

	// Promotion rewrites the owned group with no manager, and does NOT fetch
	// upstream or prune.
	assert.Zero(t, fetch.calls, "promotion skips the upstream fetch")
	assert.Empty(t, rs.deleted, "promotion does not prune")
	require.Len(t, rs.replaced, 1)
	assert.Equal(t, utils.ManagerProperties{}, rs.replacedManager, "rewritten with no manager: unmanaged/native")

	// Terminal PromotionCommitted status (condition stays True).
	st := cs.statusFor(1)
	require.NotNil(t, st)
	require.Len(t, st.Conditions, 1)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusTrue, st.Conditions[0].Status)
	assert.Equal(t, conditionReasonPromoted, st.Conditions[0].Reason)
}

func TestSyncOrg_PromoteIdempotentWhenNothingOwned(t *testing.T) {
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpecWithPromote(1, "ds1", "", true)
	rs := &fakeRuleService{} // no owned rules: already promoted, or never synced
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 5}
	s := newTestSyncerWithConfigClient(t, cs, fetch, rs)
	s.namespaceStore = fakeNamespaceStore{
		byTitle: map[string]*folder.FolderReference{rootFolderTitle("ds1"): {UID: "folder-" + rootFolderTitle("ds1"), Title: rootFolderTitle("ds1")}},
	}

	s.SyncOrg(context.Background(), 1)

	assert.Nil(t, rs.replaced, "nothing to promote")
	assert.Zero(t, fetch.calls, "still no fetch once promote is set")
	// Terminal status is still (re-)asserted each tick.
	st := cs.statusFor(1)
	require.NotNil(t, st)
	require.Len(t, st.Conditions, 1)
	assert.Equal(t, conditionReasonPromoted, st.Conditions[0].Reason)
}

func TestSyncOrg_PromoteNoOpWhenNeverSynced(t *testing.T) {
	// The sync root folder was never created (sync never actually ran for this
	// org): promote must be a clean no-op, not an error.
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpecWithPromote(1, "ds1", "", true)
	rs := &fakeRuleService{}
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 5}
	s := newTestSyncerWithConfigClient(t, cs, fetch, rs)
	s.namespaceStore = fakeNamespaceStore{} // GetNamespaceByTitle -> ErrFolderNotFound

	s.SyncOrg(context.Background(), 1)

	assert.Nil(t, rs.replaced)
	st := cs.statusFor(1)
	require.NotNil(t, st)
	assert.Equal(t, conditionReasonPromoted, st.Conditions[0].Reason)
}

func TestSyncOrg_IniPathNeverPromotes(t *testing.T) {
	// The ini path has no promote override (resolveExternalRulerConfig always
	// returns promote: false for it), even if the Config resource somehow has
	// promote set — the operator ini override takes precedence for the whole
	// resolved config, not just the datasource UID.
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpecWithPromote(1, "from-config", "", true)
	rs := &fakeRuleService{
		existing: []models.AlertRuleGroupWithFolderFullpath{ownedGroup("folder-ns1", "g1")},
	}
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 5}
	s := newTestSyncerWithConfigClient(t, cs, fetch, rs)
	s.settings.ExternalRulerUID = "from-ini"

	s.SyncOrg(context.Background(), 1)

	assert.Equal(t, 1, fetch.calls, "ini path syncs normally, never promotes")
	assert.NotEqual(t, utils.ManagerProperties{}, rs.replacedManager, "rules are still sync-managed, not promoted")
}

func TestSyncOrg_PersistedHashSkipsReapplyAcrossRestarts(t *testing.T) {
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1", "")
	rs := &fakeRuleService{}
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 42}
	s := newTestSyncerWithConfigClient(t, cs, fetch, rs)

	s.SyncOrg(context.Background(), 1)
	require.Len(t, rs.replaced, 1, "first tick applies")

	// Simulate a restart: a fresh syncer with an empty in-memory cache, reading
	// the same (now-persisted) Config status.
	rs2 := &fakeRuleService{}
	fetch2 := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 42}
	s2 := newTestSyncerWithConfigClient(t, cs, fetch2, rs2)
	require.Empty(t, s2.lastSyncHash, "fresh syncer has no in-memory cache")

	s2.SyncOrg(context.Background(), 1)

	assert.Equal(t, 1, fetch2.calls, "still fetches to compare the hash")
	assert.Nil(t, rs2.replaced, "unchanged upstream is not re-applied, thanks to the persisted hash")
}

func TestSyncOrg_PersistedHashSurvivesAFailedTick(t *testing.T) {
	enableRulerSyncAPIFlag(t)
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1", "")
	rs := &fakeRuleService{}
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 7}
	s := newTestSyncerWithConfigClient(t, cs, fetch, rs)
	s.SyncOrg(context.Background(), 1)
	require.Len(t, rs.replaced, 1)

	st := cs.statusFor(1)
	require.NotNil(t, st.ExternalRulerSync)
	require.NotNil(t, st.ExternalRulerSync.LastAppliedHash)
	assert.Equal(t, "7", *st.ExternalRulerSync.LastAppliedHash)

	// A later failed tick (e.g. a transient fetch error) must not clobber the
	// persisted hash, so a subsequent recovery still dedups correctly.
	fetch.err = errors.New("transient fetch failure")
	s.SyncOrg(context.Background(), 1)
	fetch.err = nil

	st = cs.statusFor(1)
	require.NotNil(t, st.ExternalRulerSync.LastAppliedHash)
	assert.Equal(t, "7", *st.ExternalRulerSync.LastAppliedHash, "failure must not clear the persisted dedup hash")
}
