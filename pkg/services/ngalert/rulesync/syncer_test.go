package rulesync

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/setting"
)

// --- fakes ---

type fakeConfigStore struct {
	uid       string
	targetUID string
	uidErr    error
	lastWrite *alertingrulesv0alpha1.ConfigStatus
}

func (f *fakeConfigStore) GetSyncSpec(context.Context, int64) (syncSpec, error) {
	return syncSpec{DatasourceUID: f.uid, TargetDatasourceUID: f.targetUID}, f.uidErr
}
func (f *fakeConfigStore) WriteStatus(_ context.Context, _ int64, compute func(prev *alertingrulesv0alpha1.ConfigStatus) alertingrulesv0alpha1.ConfigStatus) error {
	st := compute(f.lastWrite)
	f.lastWrite = &st
	return nil
}

type fakeFetcher struct {
	cfg  RulerConfig
	hash uint64
	err  error
}

func (f *fakeFetcher) Fetch(context.Context, *datasources.DataSource) (RulerConfig, uint64, error) {
	return f.cfg, f.hash, f.err
}

type fakeRuleService struct {
	replaced []*models.AlertRuleGroup
	existing []models.AlertRuleGroupWithFolderFullpath
	deleted  []provisioning.FilterOptions
}

func (f *fakeRuleService) ReplaceRuleGroups(_ context.Context, _ identity.Requester, groups []*models.AlertRuleGroup, _ models.Provenance, _ string) error {
	f.replaced = groups
	return nil
}
func (f *fakeRuleService) DeleteRuleGroups(_ context.Context, _ identity.Requester, _ models.Provenance, filterOpts *provisioning.FilterOptions) error {
	f.deleted = append(f.deleted, *filterOpts)
	return nil
}
func (f *fakeRuleService) GetAlertGroupsWithFolderFullpath(_ context.Context, _ identity.Requester, filterOpts *provisioning.FilterOptions) ([]models.AlertRuleGroupWithFolderFullpath, error) {
	// Emulate the store's SourceIdentifier filter so the fake is faithful to the
	// real query the syncer now relies on for prune scoping.
	if filterOpts == nil || filterOpts.SourceIdentifier == nil {
		return f.existing, nil
	}
	var out []models.AlertRuleGroupWithFolderFullpath
	for _, g := range f.existing {
		if len(g.Rules) > 0 && g.Rules[0].PrometheusRuleSourceIdentifier() == *filterOpts.SourceIdentifier {
			out = append(out, g)
		}
	}
	return out, nil
}

// fakeNamespaceStore returns a folder whose UID is the title prefixed, so root
// and namespace folders get distinct, deterministic UIDs.
type fakeNamespaceStore struct{}

func (fakeNamespaceStore) GetOrCreateNamespaceByTitle(_ context.Context, title string, _ int64, _ identity.Requester, _ string) (*folder.FolderReference, bool, error) {
	return &folder.FolderReference{UID: "folder-" + title, Title: title}, false, nil
}

type fakeDatasourceGetter struct {
	ds        *datasources.DataSource
	requested *[]string
}

func (f fakeDatasourceGetter) GetDataSource(_ context.Context, q *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	if f.requested != nil {
		*f.requested = append(*f.requested, q.UID)
	}
	// Return a datasource carrying the requested UID so callers that resolve a
	// distinct target datasource see the right UID.
	return &datasources.DataSource{UID: q.UID, OrgID: q.OrgID, Type: f.ds.Type, URL: f.ds.URL}, nil
}

func newTestSyncer(t *testing.T, cs *fakeConfigStore, fetch *fakeFetcher, rs *fakeRuleService) *ExternalRulerSyncer {
	t.Helper()
	return &ExternalRulerSyncer{
		settings:       &setting.UnifiedAlertingSettings{DefaultRuleEvaluationInterval: time.Minute},
		logger:         log.NewNopLogger(),
		metrics:        NewMetrics(nil),
		datasources:    fakeDatasourceGetter{ds: &datasources.DataSource{UID: "ds1", OrgID: 1, Type: datasources.DS_PROMETHEUS, URL: "http://mimir/prometheus"}},
		fetcher:        fetch,
		ruleService:    rs,
		namespaceStore: fakeNamespaceStore{},
		configStore:    cs,
		featureEnabled: func(context.Context) bool { return true },
		lastSyncHash:   make(map[int64]uint64),
	}
}

func upstreamGroup(name, alert string) RulerConfig {
	return RulerConfig{
		"ns1": {{Name: name, Rules: []apimodels.PrometheusRule{{Alert: alert, Expr: "up == 0"}}}},
	}
}

// ownedGroup builds an existing converted rule group owned by sourceID.
func ownedGroup(folderUID, group, sourceID string) models.AlertRuleGroupWithFolderFullpath {
	return models.AlertRuleGroupWithFolderFullpath{
		AlertRuleGroup: &models.AlertRuleGroup{
			Title:     group,
			FolderUID: folderUID,
			Rules: []models.AlertRule{{
				Title:    "r",
				Metadata: models.AlertRuleMetadata{PrometheusStyleRule: &models.PrometheusStyleRule{SourceIdentifier: sourceID}},
			}},
		},
	}
}

func TestSyncOrg_HappyPath(t *testing.T) {
	cs := &fakeConfigStore{uid: "ds1"}
	rs := &fakeRuleService{}
	s := newTestSyncer(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 111}, rs)

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1, "one group replaced")
	require.Len(t, rs.replaced[0].Rules, 1)
	// SourceIdentifier stamped on the converted rule.
	require.NotNil(t, rs.replaced[0].Rules[0].Metadata.PrometheusStyleRule)
	assert.Equal(t, "ds1", rs.replaced[0].Rules[0].Metadata.PrometheusStyleRule.SourceIdentifier)
	// Success status written True.
	require.NotNil(t, cs.lastWrite)
	cond := findSyncedCondition(t, *cs.lastWrite)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusTrue, cond.Status)
}

func TestSyncOrg_NotConfigured(t *testing.T) {
	cs := &fakeConfigStore{uid: ""}
	rs := &fakeRuleService{}
	s := newTestSyncer(t, cs, &fakeFetcher{}, rs)

	s.SyncOrg(context.Background(), 1)
	assert.Nil(t, rs.replaced, "nothing synced when not configured")
	assert.Nil(t, cs.lastWrite, "no status written when not configured")
}

func TestSyncOrg_Dedup(t *testing.T) {
	cs := &fakeConfigStore{uid: "ds1"}
	rs := &fakeRuleService{}
	s := newTestSyncer(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 42}, rs)

	s.SyncOrg(context.Background(), 1)
	require.Len(t, rs.replaced, 1)

	// Second tick, same hash → skipped (replaced reset to confirm not called again).
	rs.replaced = nil
	s.SyncOrg(context.Background(), 1)
	assert.Nil(t, rs.replaced, "unchanged hash is deduped")
}

func TestSyncOrg_NotARuler(t *testing.T) {
	cs := &fakeConfigStore{uid: "ds1"}
	rs := &fakeRuleService{}
	s := newTestSyncer(t, cs, &fakeFetcher{err: ErrNotARuler}, rs)

	s.SyncOrg(context.Background(), 1)

	assert.Nil(t, rs.replaced)
	require.NotNil(t, cs.lastWrite)
	cond := findSyncedCondition(t, *cs.lastWrite)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusFalse, cond.Status)
	assert.Equal(t, "NotARuler", cond.Reason)
}

func TestSyncOrg_PruneScopedBySourceIdentifier(t *testing.T) {
	cs := &fakeConfigStore{uid: "ds1"}
	rs := &fakeRuleService{
		existing: []models.AlertRuleGroupWithFolderFullpath{
			// Owned by ds1 but NOT in upstream (ns1/g1 is upstream) → must be pruned.
			ownedGroup("folder-ns1", "stale-group", "ds1"),
			// Owned by a different datasource → must NOT be pruned.
			ownedGroup("folder-other", "other-group", "ds2"),
			// Manually imported (no SourceIdentifier) → must NOT be pruned.
			ownedGroup("folder-manual", "manual-group", ""),
			// Still present upstream (ns1/g1) → must NOT be pruned.
			ownedGroup("folder-ns1", "g1", "ds1"),
		},
	}
	s := newTestSyncer(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 7}, rs)

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.deleted, 1, "exactly one stale, owned group pruned")
	assert.Equal(t, []string{"folder-ns1"}, rs.deleted[0].NamespaceUIDs)
	assert.Equal(t, []string{"stale-group"}, rs.deleted[0].RuleGroups)
	// Delete is scoped to our source identifier so it can't touch other owners.
	require.NotNil(t, rs.deleted[0].SourceIdentifier)
	assert.Equal(t, "ds1", *rs.deleted[0].SourceIdentifier)
}

func TestSyncOrg_TargetDatasourceResolved(t *testing.T) {
	cs := &fakeConfigStore{uid: "ds1", targetUID: "tds1"}
	rs := &fakeRuleService{}
	s := newTestSyncer(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 9}, rs)
	var requested []string
	s.datasources = fakeDatasourceGetter{ds: &datasources.DataSource{Type: datasources.DS_PROMETHEUS, URL: "http://mimir/prometheus"}, requested: &requested}

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1)
	// Both the query and the distinct target datasource are resolved.
	assert.Contains(t, requested, "ds1")
	assert.Contains(t, requested, "tds1")
}

func TestSyncOrg_TargetDatasourceDefaultsToQuery(t *testing.T) {
	cs := &fakeConfigStore{uid: "ds1"} // no targetUID
	rs := &fakeRuleService{}
	s := newTestSyncer(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 9}, rs)
	var requested []string
	s.datasources = fakeDatasourceGetter{ds: &datasources.DataSource{Type: datasources.DS_PROMETHEUS, URL: "http://mimir/prometheus"}, requested: &requested}

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1)
	// Target defaults to the query datasource: only ds1 is resolved (no 2nd lookup).
	assert.Equal(t, []string{"ds1"}, requested)
}

func TestSyncOrg_IniOverrideWins(t *testing.T) {
	cs := &fakeConfigStore{uid: "from-config"}
	rs := &fakeRuleService{}
	s := newTestSyncer(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)
	s.settings.ExternalRulerUID = "from-ini"

	s.SyncOrg(context.Background(), 1)

	require.NotNil(t, cs.lastWrite)
	require.NotNil(t, cs.lastWrite.ExternalRulerSync)
	assert.Equal(t, "from-ini", *cs.lastWrite.ExternalRulerSync.DatasourceUid)
	assert.Equal(t, originIni, *cs.lastWrite.ExternalRulerSync.Origin)
}

func TestSyncOrg_FeatureDisabled(t *testing.T) {
	cs := &fakeConfigStore{uid: "ds1"}
	rs := &fakeRuleService{}
	s := newTestSyncer(t, cs, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)
	s.featureEnabled = func(context.Context) bool { return false }

	s.SyncOrg(context.Background(), 1)
	assert.Nil(t, rs.replaced)
	assert.Nil(t, cs.lastWrite)
}
