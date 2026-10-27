package server

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
	"testing"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/memory"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/setting"
)

type snapshotDatastore struct {
	storage.OpenFGADatastore
	mu            sync.Mutex
	reads         map[string]int
	delay         time.Duration
	failRead      error
	failIterator  error
	modelOverride *openfgav1.AuthorizationModel
}

func (s *snapshotDatastore) before(ctx context.Context, operation string) error {
	s.mu.Lock()
	s.reads[operation]++
	delay, failure := s.delay, s.failRead
	s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return err
	}
	if failure != nil && operation != "model" {
		return failure
	}
	if delay > 0 {
		timer := time.NewTimer(delay)
		defer timer.Stop()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
		}
	}
	return nil
}

func (s *snapshotDatastore) reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reads = make(map[string]int)
}

func (s *snapshotDatastore) counts() (map[string]int, int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	counts := make(map[string]int, len(s.reads))
	total := 0
	for operation, count := range s.reads {
		counts[operation] = count
		total += count
	}
	return counts, total
}

func (s *snapshotDatastore) Read(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadOptions) (storage.TupleIterator, error) {
	if err := s.before(ctx, "read"); err != nil {
		return nil, err
	}
	iterator, err := s.OpenFGADatastore.Read(ctx, store, filter, options)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	failure := s.failIterator
	s.mu.Unlock()
	if failure != nil {
		return &snapshotFailingIterator{TupleIterator: iterator, failure: failure}, nil
	}
	return iterator, nil
}

type snapshotFailingIterator struct {
	storage.TupleIterator
	failure  error
	returned bool
}

func (i *snapshotFailingIterator) Next(ctx context.Context) (*openfgav1.Tuple, error) {
	if i.returned {
		return nil, i.failure
	}
	i.returned = true
	return i.TupleIterator.Next(ctx)
}

func (s *snapshotDatastore) ReadPage(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadPageOptions) ([]*openfgav1.Tuple, string, error) {
	if err := s.before(ctx, "page"); err != nil {
		return nil, "", err
	}
	return s.OpenFGADatastore.ReadPage(ctx, store, filter, options)
}

func (s *snapshotDatastore) ReadUserTuple(ctx context.Context, store string, filter storage.ReadUserTupleFilter, options storage.ReadUserTupleOptions) (*openfgav1.Tuple, error) {
	if err := s.before(ctx, "user_tuple"); err != nil {
		return nil, err
	}
	return s.OpenFGADatastore.ReadUserTuple(ctx, store, filter, options)
}

func (s *snapshotDatastore) ReadUsersetTuples(ctx context.Context, store string, filter storage.ReadUsersetTuplesFilter, options storage.ReadUsersetTuplesOptions) (storage.TupleIterator, error) {
	if err := s.before(ctx, "usersets"); err != nil {
		return nil, err
	}
	return s.OpenFGADatastore.ReadUsersetTuples(ctx, store, filter, options)
}

func (s *snapshotDatastore) ReadStartingWithUser(ctx context.Context, store string, filter storage.ReadStartingWithUserFilter, options storage.ReadStartingWithUserOptions) (storage.TupleIterator, error) {
	if err := s.before(ctx, "reverse"); err != nil {
		return nil, err
	}
	return s.OpenFGADatastore.ReadStartingWithUser(ctx, store, filter, options)
}

func (s *snapshotDatastore) ReadAuthorizationModel(ctx context.Context, store, modelID string) (*openfgav1.AuthorizationModel, error) {
	if err := s.before(ctx, "model"); err != nil {
		return nil, err
	}
	s.mu.Lock()
	override := s.modelOverride
	s.mu.Unlock()
	if override != nil {
		return proto.Clone(override).(*openfgav1.AuthorizationModel), nil
	}
	return s.OpenFGADatastore.ReadAuthorizationModel(ctx, store, modelID)
}

func newSnapshotTestServer(t testing.TB, tuples []*openfgav1.TupleKey) (*Server, *snapshotDatastore, *zanzana.StoreInfo) {
	t.Helper()
	ds := &snapshotDatastore{
		OpenFGADatastore: memory.New(memory.WithMaxTuplesPerWrite(10000)),
		reads:            make(map[string]int),
	}
	cfg := setting.NewCfg()
	cfg.ZanzanaServer.ListObjectsDeadline = 10 * time.Second
	cfg.ZanzanaServer.CacheSettings.CheckQueryCacheEnabled = false
	cfg.ZanzanaServer.CacheSettings.CheckIteratorCacheEnabled = false
	cfg.ZanzanaServer.CacheSettings.ListObjectsIteratorCacheEnabled = false
	cfg.ZanzanaServer.CacheSettings.CacheControllerEnabled = false
	cfg.ZanzanaServer.CacheSettings.SharedIteratorEnabled = false
	srv, err := NewEmbeddedZanzanaServer(cfg, ds, log.NewNopLogger(), tracing.NewNoopTracerService(), prometheus.NewRegistry(), nil, nil, leaderelection.NewDefaultElector(), nil)
	require.NoError(t, err)
	t.Cleanup(func() {
		srv.openFGAServer.(interface{ Close() }).Close()
	})
	storeInfo, err := srv.getStoreInfo(context.Background(), namespace)
	require.NoError(t, err)
	if len(tuples) > 0 {
		require.NoError(t, ds.Write(context.Background(), storeInfo.ID, nil, tuples))
	}
	ds.reset()
	return srv, ds, storeInfo
}

type normalizedSnapshotList struct {
	Entry   common.ActionListEntry
	All     bool
	Items   []string
	Folders []string
}

func normalizeSnapshotLists(results []permissionListResult) map[string]normalizedSnapshotList {
	normalized := make(map[string]normalizedSnapshotList, len(results))
	for _, result := range results {
		items := append([]string{}, result.List.GetItems()...)
		folders := append([]string{}, result.List.GetFolders()...)
		slices.Sort(items)
		slices.Sort(folders)
		normalized[result.Entry.Action] = normalizedSnapshotList{
			Entry: result.Entry, All: result.List.GetAll(),
			Items: slices.Compact(items), Folders: slices.Compact(folders),
		}
	}
	return normalized
}

func baselineSnapshotLists(ctx context.Context, srv *Server, req *authzv1.GetUserPermissionsRequest) ([]permissionListResult, error) {
	results := make([]permissionListResult, 0, len(common.SupportedActions()))
	for _, entry := range common.SupportedActions() {
		list, err := srv.list(ctx, &authzv1.ListRequest{
			Namespace: req.GetNamespace(), Subject: req.GetSubject(), Teams: req.GetTeams(),
			Group: entry.Group, Resource: entry.Resource, Subresource: entry.Subresource, Verb: entry.Verb,
		})
		if err != nil {
			return nil, fmt.Errorf("%s: %w", entry.Action, err)
		}
		results = append(results, permissionListResult{Entry: entry, List: list})
	}
	return results, nil
}

func requireSnapshotParity(t *testing.T, srv *Server, req *authzv1.GetUserPermissionsRequest) map[string]normalizedSnapshotList {
	t.Helper()
	ctx := newContextWithNamespace()
	want, err := baselineSnapshotLists(ctx, srv, req)
	require.NoError(t, err)
	got, err := srv.listUserPermissions(ctx, req)
	require.NoError(t, err)
	require.Len(t, got, len(common.SupportedActions()))
	require.Len(t, normalizeSnapshotLists(got), len(common.SupportedActions()), "every supported action, including aliases, must be returned once")
	require.Equal(t, normalizeSnapshotLists(want), normalizeSnapshotLists(got))
	return normalizeSnapshotLists(got)
}

func snapshotParityTuples() []*openfgav1.TupleKey {
	tuples := []*openfgav1.TupleKey{
		common.NewResourceTuple("user:direct", common.RelationSetAdmin, dashboardGroup, dashboardResource, "", "direct-dashboard"),
		common.NewTypedTuple(common.TypeUser, "user:direct", common.RelationGet, "readable-user"),
		common.NewTypedTuple(common.TypeServiceAccount, "user:direct", common.RelationGetPermissions, "managed-bot"),
		common.NewTypedResourceTuple("user:direct", common.RelationGet, common.TypeTeam, teamGroup, teamResource, "members", "typed-team"),
		common.NewResourceTuple("team:external-a#member", common.RelationGet, dashboardGroup, dashboardResource, "", "external-dashboard"),
		common.NewResourceTuple("team:external-b#member", common.RelationUpdate, "datasource.grafana.app", datasourceResource, "caching", "external-datasource"),
		common.NewTypedTuple(common.TypeTeam, "user:stored", common.RelationTeamMember, "stored-team"),
		common.NewTypedTuple(common.TypeTeam, "user:admin", common.RelationTeamAdmin, "admin-team"),
		common.NewResourceTuple("team:admin-team#member", common.RelationGet, dashboardGroup, dashboardResource, "", "admin-member-dashboard"),
		common.NewTypedTuple(common.TypeRole, "team:stored-team#member", common.RelationAssignee, "stored-role"),
		common.NewFolderTuple("role:stored-role#assignee", common.RelationSetAdmin, "ancestor"),
		common.NewTypedTuple(common.TypeRole, "user:role", common.RelationAssignee, "direct-role"),
		common.NewTypedTuple(common.TypeRole, "team:external-a#member", common.RelationAssignee, "external-role"),
		common.NewResourceTuple("role:external-role#assignee", common.RelationCreate, "datasource.grafana.app", datasourceResource, "query", "role-datasource"),
		common.NewGroupResourceTuple("role:direct-role#assignee", common.RelationSetView, dashboardGroup, dashboardResource, ""),
		common.NewResourceTuple("role:direct-role#assignee", common.RelationSetAdmin, dashboardGroup, dashboardResource, "", "wildcard-covered-dashboard"),
		common.NewFolderTuple("role:direct-role#assignee", common.RelationGet, "wildcard-covered-folder"),
		common.NewFolderResourceTuple("user:conditional", common.RelationCreate, "datasource.grafana.app", datasourceResource, "query", "ancestor"),
		common.NewFolderResourceTuple("user:conditional", common.RelationGet, "datasource.grafana.app", datasourceResource, "caching", "ancestor"),
		common.NewResourceTuple("user:conditional", common.RelationGet, "unrelated.grafana.app", "objects", "", "same-name"),
		common.NewResourceTuple("user:conditional", common.RelationGet, "datasource.grafana.app", datasourceResource, "", "same-name"),
		common.NewFolderTuple("user:root", common.RelationSetView, "general"),
		common.NewFolderResourceTuple("user:root", common.RelationCreate, "datasource.grafana.app", datasourceResource, "query", "general"),
		common.NewFolderTuple("user:deep", common.RelationSetEdit, "ancestor"),
		common.NewFolderTuple("user:other", common.RelationSetAdmin, "unrelated-parent"),
		common.NewFolderParentTuple("unrelated-child", "unrelated-parent"),
		common.NewTypedTuple(common.TypeRole, "anonymous:0", common.RelationAssignee, "anonymous-role"),
		common.NewGroupResourceTuple("role:anonymous-role#assignee", common.RelationGet, dashboardGroup, dashboardResource, ""),
		common.NewResourceTuple("service-account:bot", common.RelationGet, dashboardGroup, dashboardResource, "", "bot-dashboard"),
	}
	parent := "ancestor"
	for i := range 6 {
		child := fmt.Sprintf("descendant-%d", i)
		tuples = append(tuples, common.NewFolderParentTuple(child, parent))
		parent = child
	}
	wildcards := make(map[string]struct{})
	for _, entry := range common.SupportedActions() {
		tuple := common.NewGroupResourceTuple("user:all", common.VerbMapping[entry.Verb], entry.Group, entry.Resource, entry.Subresource)
		key := tuple.GetRelation() + "/" + tuple.GetObject()
		if _, exists := wildcards[key]; !exists {
			wildcards[key] = struct{}{}
			tuples = append(tuples, tuple)
		}
	}
	return tuples
}

func TestUserPermissionsSnapshotParity(t *testing.T) {
	srv, _, _ := newSnapshotTestServer(t, snapshotParityTuples())
	for _, tc := range []struct {
		name, subject string
		teams         []string
	}{
		{"direct actionsets and typed subresources", "user:direct", nil},
		{"request teams and role bindings", "user:external", []string{"external-a", "external-b", "external-a", ""}},
		{"stored membership and role inheritance", "user:stored", nil},
		{"stored team admin and implied membership", "user:admin", nil},
		{"wildcard precedes narrower grants", "user:role", nil},
		{"conditions restrict resource groups and subresources", "user:conditional", nil},
		{"root sentinel", "user:root", nil},
		{"deep folder inheritance", "user:deep", nil},
		{"anonymous role", "anonymous:0", nil},
		{"service account", "service-account:bot", nil},
		{"render contextual grants", "render:renderer", nil},
		{"no permissions", "user:absent", nil},
		{"all supported actions have wildcard grants", "user:all", nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			requireSnapshotParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: tc.subject, Teams: tc.teams})
		})
	}

	t.Run("alias actions remain distinct", func(t *testing.T) {
		got := requireSnapshotParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.Contains(t, got["users:read"].Items, "readable-user")
		require.Equal(t, got["users:read"].Items, got["org.users:read"].Items)
	})
	t.Run("descendants are included without unrelated subtree", func(t *testing.T) {
		got := requireSnapshotParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:deep"})
		require.Contains(t, got["folders:read"].Items, "descendant-5")
		require.NotContains(t, got["folders:read"].Items, "unrelated-child")
	})
	t.Run("wildcard coverage includes every supported action", func(t *testing.T) {
		got := requireSnapshotParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:all"})
		for action, list := range got {
			require.True(t, list.All, action)
		}
	})
}

func TestUserPermissionsSnapshotLargeContextualTeamSet(t *testing.T) {
	groups := make([]string, 205)
	for i := range groups {
		groups[i] = fmt.Sprintf("large-team-%03d", i)
	}
	tuples := []*openfgav1.TupleKey{
		common.NewResourceTuple("team:"+groups[0]+"#member", common.RelationGet, dashboardGroup, dashboardResource, "", "first-chunk"),
		common.NewResourceTuple("team:"+groups[104]+"#member", common.RelationGet, dashboardGroup, dashboardResource, "", "second-chunk"),
		common.NewResourceTuple("team:"+groups[204]+"#member", common.RelationGet, dashboardGroup, dashboardResource, "", "last-chunk"),
	}
	srv, _, _ := newSnapshotTestServer(t, tuples)
	got := requireSnapshotParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:many-teams", Teams: groups})
	require.Equal(t, []string{"first-chunk", "last-chunk", "second-chunk"}, got["dashboards:read"].Items)
}

func TestUserPermissionsSnapshotObservesRevocations(t *testing.T) {
	for _, tc := range []struct {
		name, subject, action, item string
		tuple                       *openfgav1.TupleKey
	}{
		{"direct grant", "user:direct", "dashboards:read", "direct-dashboard", common.NewResourceTuple("user:direct", common.RelationSetAdmin, dashboardGroup, dashboardResource, "", "direct-dashboard")},
		{"stored membership", "user:stored", "folders:read", "ancestor", common.NewTypedTuple(common.TypeTeam, "user:stored", common.RelationTeamMember, "stored-team")},
		{"role binding", "user:stored", "folders:read", "ancestor", common.NewTypedTuple(common.TypeRole, "team:stored-team#member", common.RelationAssignee, "stored-role")},
		{"folder edge", "user:deep", "folders:read", "descendant-5", common.NewFolderParentTuple("descendant-0", "ancestor")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv, ds, store := newSnapshotTestServer(t, snapshotParityTuples())
			req := &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: tc.subject}
			before := requireSnapshotParity(t, srv, req)
			require.Contains(t, before[tc.action].Items, tc.item)
			require.NoError(t, ds.Write(t.Context(), store.ID, []*openfgav1.TupleKeyWithoutCondition{{User: tc.tuple.User, Relation: tc.tuple.Relation, Object: tc.tuple.Object}}, nil))
			after := requireSnapshotParity(t, srv, req)
			require.NotContains(t, after[tc.action].Items, tc.item)
		})
	}
}

func TestUserPermissionsSnapshotIsolatesConcurrentContextualTeams(t *testing.T) {
	srv, _, _ := newSnapshotTestServer(t, []*openfgav1.TupleKey{
		common.NewResourceTuple("team:left#member", common.RelationGet, dashboardGroup, dashboardResource, "", "left-dashboard"),
		common.NewResourceTuple("team:right#member", common.RelationGet, dashboardGroup, dashboardResource, "", "right-dashboard"),
	})
	for i := range 8 {
		for _, team := range []string{"left", "right"} {
			t.Run(fmt.Sprintf("%s-%d", team, i), func(t *testing.T) {
				t.Parallel()
				got := requireSnapshotParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:same", Teams: []string{team}})
				require.Equal(t, []string{team + "-dashboard"}, got["dashboards:read"].Items)
			})
		}
	}
}

func TestUserPermissionsSnapshotReturnsNoPartialResults(t *testing.T) {
	t.Run("canceled request", func(t *testing.T) {
		srv, _, _ := newSnapshotTestServer(t, snapshotParityTuples())
		ctx, cancel := context.WithCancel(newContextWithNamespace())
		cancel()
		results, err := srv.listUserPermissions(ctx, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.Error(t, err)
		require.Empty(t, results)
	})
	t.Run("datastore failure", func(t *testing.T) {
		srv, ds, _ := newSnapshotTestServer(t, snapshotParityTuples())
		ds.failRead = errors.New("grant datastore unavailable")
		results, err := srv.listUserPermissions(newContextWithNamespace(), &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.ErrorContains(t, err, "grant datastore unavailable")
		require.Empty(t, results)
	})
	t.Run("stream fails after returning a grant", func(t *testing.T) {
		srv, ds, _ := newSnapshotTestServer(t, snapshotParityTuples())
		ds.failIterator = errors.New("grant stream interrupted")
		results, err := srv.listUserPermissions(newContextWithNamespace(), &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.ErrorContains(t, err, "grant stream interrupted")
		require.Empty(t, results)
	})
	t.Run("unknown authorization model", func(t *testing.T) {
		srv, ds, store := newSnapshotTestServer(t, snapshotParityTuples())
		model, err := ds.OpenFGADatastore.ReadAuthorizationModel(t.Context(), store.ID, store.ModelID)
		require.NoError(t, err)
		model = proto.Clone(model).(*openfgav1.AuthorizationModel)
		model.TypeDefinitions = append(model.TypeDefinitions, &openfgav1.TypeDefinition{Type: "future-type"})
		ds.modelOverride = model
		results, err := srv.listUserPermissions(newContextWithNamespace(), &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.Error(t, err)
		require.Empty(t, results)
	})
}

func snapshotPerformanceTuples() []*openfgav1.TupleKey {
	tuples := make([]*openfgav1.TupleKey, 0, 70)
	entries := common.SupportedActions()
	for i := range 34 {
		roleID := fmt.Sprintf("seeded-%02d", i)
		entry := entries[i%len(entries)]
		tuples = append(tuples,
			common.NewTypedTuple(common.TypeRole, "team:platform-team#member", common.RelationAssignee, roleID),
			common.NewGroupResourceTuple("role:"+roleID+"#assignee", common.VerbMapping[entry.Verb], entry.Group, entry.Resource, entry.Subresource),
		)
	}
	return tuples
}

func TestUserPermissionsSnapshotReducesDatastoreOperations(t *testing.T) {
	srv, ds, _ := newSnapshotTestServer(t, snapshotPerformanceTuples())
	req := &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice", Teams: []string{"platform-team"}}
	ctx := newContextWithNamespace()
	want, err := baselineSnapshotLists(ctx, srv, req)
	require.NoError(t, err)
	baselineCounts, baselineTotal := ds.counts()
	ds.reset()
	got, err := srv.listUserPermissions(ctx, req)
	require.NoError(t, err)
	snapshotCounts, snapshotTotal := ds.counts()
	require.Equal(t, normalizeSnapshotLists(want), normalizeSnapshotLists(got))
	require.Less(t, snapshotTotal*3, baselineTotal, "prefetch should eliminate repeated remote graph walks")
	require.LessOrEqual(t, snapshotCounts["read"], 36, "each subject, request team and assigned role should be fetched at most once")
	require.Zero(t, snapshotCounts["user_tuple"])
	require.Zero(t, snapshotCounts["usersets"])
	t.Logf("datastore operations: baseline=%d %v, snapshot=%d %v", baselineTotal, baselineCounts, snapshotTotal, snapshotCounts)
}

func BenchmarkUserPermissionsSnapshotDelayedDatastore(b *testing.B) {
	for _, delay := range []time.Duration{0, 5 * time.Millisecond} {
		for _, path := range []string{"baseline", "snapshot"} {
			b.Run(fmt.Sprintf("delay=%s/%s", delay, path), func(b *testing.B) {
				srv, ds, _ := newSnapshotTestServer(b, snapshotPerformanceTuples())
				ds.delay = delay
				req := &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice", Teams: []string{"platform-team"}}
				ctx := newContextWithNamespace()
				b.ReportAllocs()
				b.ResetTimer()
				for range b.N {
					var err error
					if path == "baseline" {
						_, err = baselineSnapshotLists(ctx, srv, req)
					} else {
						_, err = srv.listUserPermissions(ctx, req)
					}
					if err != nil {
						b.Fatal(err)
					}
				}
				b.StopTimer()
				_, total := ds.counts()
				b.ReportMetric(float64(total)/float64(b.N), "datastore-ops/op")
			})
		}
	}
}
