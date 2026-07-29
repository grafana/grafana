package rulesync

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/setting"
)

// --- fakes ---

type fakeFetcher struct {
	cfg   RulerConfig
	hash  uint64
	err   error
	calls int
}

func (f *fakeFetcher) Fetch(context.Context, *datasources.DataSource) (RulerConfig, uint64, error) {
	f.calls++
	return f.cfg, f.hash, f.err
}

type fakeRuleService struct {
	replaced []*models.AlertRuleGroup
	existing []models.AlertRuleGroupWithFolderFullpath
	deleted  []provisioning.FilterOptions
}

func (f *fakeRuleService) ReplaceRuleGroups(_ context.Context, _ identity.Requester, groups []*models.AlertRuleGroup, _ utils.ManagerProperties, _ string) error {
	f.replaced = groups
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
}

func (fakeNamespaceStore) GetOrCreateNamespaceByTitle(_ context.Context, title string, _ int64, _ identity.Requester, _ string) (*folder.FolderReference, bool, error) {
	return &folder.FolderReference{UID: "folder-" + title, Title: title}, false, nil
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
	ds *datasources.DataSource
}

func (f fakeDatasourceGetter) GetDataSource(_ context.Context, q *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	// Return a datasource carrying the requested UID.
	return &datasources.DataSource{UID: q.UID, OrgID: q.OrgID, Type: f.ds.Type, URL: f.ds.URL}, nil
}

func newTestSyncer(t *testing.T, fetch *fakeFetcher, rs *fakeRuleService) *ExternalRulerSyncer {
	t.Helper()
	return &ExternalRulerSyncer{
		settings:       &setting.UnifiedAlertingSettings{DefaultRuleEvaluationInterval: time.Minute},
		logger:         log.NewNopLogger(),
		metrics:        NewMetrics(nil),
		datasources:    fakeDatasourceGetter{ds: &datasources.DataSource{UID: "ds1", OrgID: 1, Type: datasources.DS_PROMETHEUS, URL: "http://mimir/prometheus"}},
		fetcher:        fetch,
		ruleService:    rs,
		namespaceStore: fakeNamespaceStore{},
		lastSyncHash:   make(map[int64]uint64),
	}
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

func TestRun_NoOpWhenUnconfigured(t *testing.T) {
	// external_ruler_uid unset is the disable signal: Run must not start the poll
	// loop (there is no separate feature flag).
	s := newTestSyncer(t, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, &fakeRuleService{})
	s.settings.AdminConfigPollInterval = time.Minute // avoid a ticker panic if the gate regresses

	done := make(chan error, 1)
	go func() { done <- s.Run(context.Background()) }()
	select {
	case err := <-done:
		require.NoError(t, err)
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return; missing gate on external_ruler_uid")
	}
}
