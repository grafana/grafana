package server

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/memory"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/setting"
)

type permissionDatastore struct {
	storage.OpenFGADatastore
	mu            sync.Mutex
	reads         map[string]int
	delay         time.Duration
	failRead      error
	failIterator  error
	modelOverride *openfgav1.AuthorizationModel
}

func (s *permissionDatastore) before(ctx context.Context, operation string) error {
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

func (s *permissionDatastore) reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reads = make(map[string]int)
}

func (s *permissionDatastore) counts() (map[string]int, int) {
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

func (s *permissionDatastore) Read(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadOptions) (storage.TupleIterator, error) {
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
		return &permissionFailingIterator{TupleIterator: iterator, failure: failure}, nil
	}
	return iterator, nil
}

type permissionFailingIterator struct {
	storage.TupleIterator
	failure  error
	returned bool
}

func (i *permissionFailingIterator) Next(ctx context.Context) (*openfgav1.Tuple, error) {
	if i.returned {
		return nil, i.failure
	}
	i.returned = true
	return i.TupleIterator.Next(ctx)
}

func (s *permissionDatastore) ReadPage(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadPageOptions) ([]*openfgav1.Tuple, string, error) {
	if err := s.before(ctx, "page"); err != nil {
		return nil, "", err
	}
	return s.OpenFGADatastore.ReadPage(ctx, store, filter, options)
}

func (s *permissionDatastore) ReadUserTuple(ctx context.Context, store string, filter storage.ReadUserTupleFilter, options storage.ReadUserTupleOptions) (*openfgav1.Tuple, error) {
	if err := s.before(ctx, "user_tuple"); err != nil {
		return nil, err
	}
	return s.OpenFGADatastore.ReadUserTuple(ctx, store, filter, options)
}

func (s *permissionDatastore) ReadUsersetTuples(ctx context.Context, store string, filter storage.ReadUsersetTuplesFilter, options storage.ReadUsersetTuplesOptions) (storage.TupleIterator, error) {
	if err := s.before(ctx, "usersets"); err != nil {
		return nil, err
	}
	return s.OpenFGADatastore.ReadUsersetTuples(ctx, store, filter, options)
}

func (s *permissionDatastore) ReadStartingWithUser(ctx context.Context, store string, filter storage.ReadStartingWithUserFilter, options storage.ReadStartingWithUserOptions) (storage.TupleIterator, error) {
	if err := s.before(ctx, "reverse"); err != nil {
		return nil, err
	}
	return s.OpenFGADatastore.ReadStartingWithUser(ctx, store, filter, options)
}

func (s *permissionDatastore) ReadAuthorizationModel(ctx context.Context, store, modelID string) (*openfgav1.AuthorizationModel, error) {
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

func newPermissionTestServer(t testing.TB, tuples []*openfgav1.TupleKey, configure ...func(*setting.Cfg)) (*Server, *permissionDatastore, *zanzana.StoreInfo) {
	t.Helper()
	ds := &permissionDatastore{
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
	cfg.RBAC.PermissionCache = false
	for _, configure := range configure {
		configure(cfg)
	}
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

type normalizedPermissionList struct {
	Entry   common.ActionListEntry
	All     bool
	Items   []string
	Folders []string
}

func normalizePermissionLists(results []permissionListResult) map[string]normalizedPermissionList {
	normalized := make(map[string]normalizedPermissionList, len(results))
	for _, result := range results {
		items := append([]string{}, result.List.GetItems()...)
		folders := append([]string{}, result.List.GetFolders()...)
		slices.Sort(items)
		slices.Sort(folders)
		normalized[result.Entry.Action] = normalizedPermissionList{
			Entry: result.Entry, All: result.List.GetAll(),
			Items: slices.Compact(items), Folders: slices.Compact(folders),
		}
	}
	return normalized
}

func baselinePermissionLists(ctx context.Context, srv *Server, req *authzv1.GetUserPermissionsRequest) ([]permissionListResult, error) {
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

// Legacy enumeration preserves grant scopes; resource List expands inheritance.
// Use the full backing graph without folder parent edges as the List reference.
func baselineGrantLists(t *testing.T, srv *Server, req *authzv1.GetUserPermissionsRequest) ([]permissionListResult, error) {
	t.Helper()
	ctx := newContextWithNamespace()
	store, err := srv.getStoreInfo(ctx, req.GetNamespace())
	require.NoError(t, err)
	iterator, err := srv.store.Read(ctx, store.ID, storage.ReadFilter{}, storage.ReadOptions{})
	require.NoError(t, err)
	defer iterator.Stop()
	var grants []*openfgav1.TupleKey
	err = collectPermissionTuples(ctx, iterator, func(tk *openfgav1.TupleKey) error {
		if tk.GetRelation() != common.RelationParent || !strings.HasPrefix(tk.GetObject(), common.TypeFolderPrefix) {
			grants = append(grants, tk)
		}
		return nil
	})
	require.NoError(t, err)
	baseline, _, _ := newPermissionTestServer(t, grants)
	return baselinePermissionLists(ctx, baseline, req)
}

func requirePermissionParity(t *testing.T, srv *Server, req *authzv1.GetUserPermissionsRequest) map[string]normalizedPermissionList {
	t.Helper()
	ctx := newContextWithNamespace()
	want, err := baselineGrantLists(t, srv, req)
	require.NoError(t, err)
	got, err := srv.resolveUserPermissionContributions(ctx, req)
	require.NoError(t, err)
	require.Len(t, got, len(common.SupportedActions()))
	require.Len(t, normalizePermissionLists(got), len(common.SupportedActions()), "every supported action, including aliases, must be returned once")
	require.Equal(t, normalizePermissionLists(want), normalizePermissionLists(got))
	return normalizePermissionLists(got)
}

func permissionParityTuples() []*openfgav1.TupleKey {
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

func TestUserPermissionsGrantsParity(t *testing.T) {
	srv, _, _ := newPermissionTestServer(t, permissionParityTuples())
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
		{"folder grant with descendants", "user:deep", nil},
		{"anonymous role", "anonymous:0", nil},
		{"service account", "service-account:bot", nil},
		{"render contextual grants", "render:renderer", nil},
		{"no permissions", "user:absent", nil},
		{"all supported actions have wildcard grants", "user:all", nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			requirePermissionParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: tc.subject, Teams: tc.teams})
		})
	}

	t.Run("alias actions remain distinct", func(t *testing.T) {
		got := requirePermissionParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.Contains(t, got["users:read"].Items, "readable-user")
		require.Equal(t, got["users:read"].Items, got["org.users:read"].Items)
	})
	t.Run("only granted folders are returned", func(t *testing.T) {
		got := requirePermissionParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:deep"})
		require.Equal(t, []string{"ancestor"}, got["folders:read"].Items)
		require.NotContains(t, got["folders:read"].Items, "unrelated-child")
	})
	t.Run("wildcard coverage includes every supported action", func(t *testing.T) {
		got := requirePermissionParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:all"})
		for action, list := range got {
			require.True(t, list.All, action)
		}
	})
}

func TestUserPermissionsGrantsLargeContextualTeamSet(t *testing.T) {
	groups := make([]string, 205)
	for i := range groups {
		groups[i] = fmt.Sprintf("large-team-%03d", i)
	}
	tuples := []*openfgav1.TupleKey{
		common.NewResourceTuple("team:"+groups[0]+"#member", common.RelationGet, dashboardGroup, dashboardResource, "", "first-chunk"),
		common.NewResourceTuple("team:"+groups[104]+"#member", common.RelationGet, dashboardGroup, dashboardResource, "", "second-chunk"),
		common.NewResourceTuple("team:"+groups[204]+"#member", common.RelationGet, dashboardGroup, dashboardResource, "", "last-chunk"),
	}
	srv, _, _ := newPermissionTestServer(t, tuples)
	got := requirePermissionParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:many-teams", Teams: groups})
	require.Equal(t, []string{"first-chunk", "last-chunk", "second-chunk"}, got["dashboards:read"].Items)
}

func TestUserPermissionsGrantsObservesRevocations(t *testing.T) {
	for _, tc := range []struct {
		name, subject, action, item string
		tuple                       *openfgav1.TupleKey
	}{
		{"direct grant", "user:direct", "dashboards:read", "direct-dashboard", common.NewResourceTuple("user:direct", common.RelationSetAdmin, dashboardGroup, dashboardResource, "", "direct-dashboard")},
		{"stored membership", "user:stored", "folders:read", "ancestor", common.NewTypedTuple(common.TypeTeam, "user:stored", common.RelationTeamMember, "stored-team")},
		{"role binding", "user:stored", "folders:read", "ancestor", common.NewTypedTuple(common.TypeRole, "team:stored-team#member", common.RelationAssignee, "stored-role")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv, ds, store := newPermissionTestServer(t, permissionParityTuples())
			req := &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: tc.subject}
			before := requirePermissionParity(t, srv, req)
			require.Contains(t, before[tc.action].Items, tc.item)
			require.NoError(t, ds.Write(t.Context(), store.ID, []*openfgav1.TupleKeyWithoutCondition{{User: tc.tuple.User, Relation: tc.tuple.Relation, Object: tc.tuple.Object}}, nil))
			after := requirePermissionParity(t, srv, req)
			require.NotContains(t, after[tc.action].Items, tc.item)
		})
	}
}

func TestUserPermissionsGrantsIsolatesConcurrentContextualTeams(t *testing.T) {
	srv, _, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewResourceTuple("team:left#member", common.RelationGet, dashboardGroup, dashboardResource, "", "left-dashboard"),
		common.NewResourceTuple("team:right#member", common.RelationGet, dashboardGroup, dashboardResource, "", "right-dashboard"),
	})
	for i := range 8 {
		for _, team := range []string{"left", "right"} {
			t.Run(fmt.Sprintf("%s-%d", team, i), func(t *testing.T) {
				t.Parallel()
				got := requirePermissionParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:same", Teams: []string{team}})
				require.Equal(t, []string{team + "-dashboard"}, got["dashboards:read"].Items)
			})
		}
	}
}

func TestUserPermissionsGrantsReturnsNoPartialResults(t *testing.T) {
	t.Run("canceled request", func(t *testing.T) {
		srv, _, _ := newPermissionTestServer(t, permissionParityTuples())
		ctx, cancel := context.WithCancel(newContextWithNamespace())
		cancel()
		results, err := srv.resolveUserPermissionContributions(ctx, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.Error(t, err)
		require.Empty(t, results)
	})
	t.Run("datastore failure", func(t *testing.T) {
		srv, ds, _ := newPermissionTestServer(t, permissionParityTuples())
		ds.failRead = errors.New("grant datastore unavailable")
		results, err := srv.resolveUserPermissionContributions(newContextWithNamespace(), &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.ErrorContains(t, err, "grant datastore unavailable")
		require.Empty(t, results)
	})
	t.Run("stream fails after returning a grant", func(t *testing.T) {
		srv, ds, _ := newPermissionTestServer(t, permissionParityTuples())
		ds.failIterator = errors.New("grant stream interrupted")
		results, err := srv.resolveUserPermissionContributions(newContextWithNamespace(), &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.ErrorContains(t, err, "grant stream interrupted")
		require.Empty(t, results)
	})
	t.Run("unknown authorization model", func(t *testing.T) {
		srv, ds, store := newPermissionTestServer(t, permissionParityTuples())
		model, err := ds.OpenFGADatastore.ReadAuthorizationModel(t.Context(), store.ID, store.ModelID)
		require.NoError(t, err)
		model = proto.Clone(model).(*openfgav1.AuthorizationModel)
		model.TypeDefinitions = append(model.TypeDefinitions, &openfgav1.TypeDefinition{Type: "future-type"})
		ds.modelOverride = model
		results, err := srv.resolveUserPermissionContributions(newContextWithNamespace(), &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"})
		require.Equal(t, codes.FailedPrecondition, status.Code(err))
		require.Empty(t, results)
	})
}

func permissionPerformanceTuples() []*openfgav1.TupleKey {
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

func TestUserPermissionsGrantsReducesDatastoreOperations(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, permissionPerformanceTuples())
	req := &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice", Teams: []string{"platform-team"}}
	ctx := newContextWithNamespace()
	want, err := baselinePermissionLists(ctx, srv, req)
	require.NoError(t, err)
	baselineCounts, baselineTotal := ds.counts()
	ds.reset()
	got, err := srv.resolveUserPermissionContributions(ctx, req)
	require.NoError(t, err)
	translationCounts, translationTotal := ds.counts()
	require.Equal(t, normalizePermissionLists(want), normalizePermissionLists(got))
	require.Less(t, translationTotal*3, baselineTotal, "prefetch should eliminate repeated remote graph walks")
	require.LessOrEqual(t, translationCounts["read"], 36, "each subject, request team and assigned role should be fetched at most once")
	require.Zero(t, translationCounts["user_tuple"])
	require.Zero(t, translationCounts["usersets"])
	t.Logf("datastore operations: baseline=%d %v, translation=%d %v", baselineTotal, baselineCounts, translationTotal, translationCounts)
}

func BenchmarkUserPermissionsGrantsDelayedDatastore(b *testing.B) {
	for _, delay := range []time.Duration{0, 5 * time.Millisecond} {
		for _, path := range []string{"baseline", "direct_uncached", "shared_team_new_user", "warm_user"} {
			b.Run(fmt.Sprintf("delay=%s/%s", delay, path), func(b *testing.B) {
				srv, ds, _ := newPermissionTestServer(b, permissionPerformanceTuples())
				ds.delay = delay
				req := &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice", Teams: []string{"platform-team"}}
				ctx := newContextWithNamespace()
				if path == "shared_team_new_user" || path == "warm_user" {
					enablePrincipalCache(srv)
					_, err := srv.resolveUserPermissionContributions(ctx, req)
					require.NoError(b, err)
					ds.reset()
				}
				b.ReportAllocs()
				b.ResetTimer()
				for i := range b.N {
					var err error
					if path == "baseline" {
						_, err = baselinePermissionLists(ctx, srv, req)
					} else {
						if path == "shared_team_new_user" {
							req.Subject = fmt.Sprintf("user:other-%d", i)
						}
						_, err = srv.resolveUserPermissionContributions(ctx, req)
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
