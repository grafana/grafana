package server

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func enablePrincipalCache(srv *Server) {
	srv.cfg.CacheSettings.CheckQueryCacheEnabled = true
	srv.cfg.CacheSettings.CheckQueryCacheTTL = time.Minute
	srv.cfg.CacheSettings.CheckCacheLimit = 100
	srv.permissionScopeResolver = permissionIDs{}
}

func permissionPairs(t *testing.T, srv *Server, subject string, teams []string, skip bool) map[[2]string]bool {
	t.Helper()
	stream := &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
	require.NoError(t, srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: subject, Teams: teams, Options: &authzv1.GetUserPermissionsOptions{Skipcache: skip}}, stream))
	result := map[[2]string]bool{}
	for _, permission := range stream.permissions {
		key := [2]string{permission.Action, permission.Scope}
		require.False(t, result[key], "response must contain unique action/scope pairs")
		result[key] = true
	}
	return result
}

func TestUserPermissionsCachesEmptyPrincipal(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, nil)
	enablePrincipalCache(srv)
	require.Empty(t, permissionPairs(t, srv, "user:nobody", nil, false))
	counts, total := ds.counts()
	require.Equal(t, map[string]int{"model": 1, "read": 1}, counts)
	require.Equal(t, 2, total)
	ds.reset()
	require.Empty(t, permissionPairs(t, srv, "user:nobody", nil, false))
	_, total = ds.counts()
	require.Zero(t, total)
}

func TestUserPermissionsKeepsContextualMembershipOutOfUserCache(t *testing.T) {
	srv, _, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewResourceTuple("team:left#member", common.RelationGet, dashboardGroup, dashboardResource, "", "left"),
		common.NewResourceTuple("team:right#member", common.RelationGet, dashboardGroup, dashboardResource, "", "right"),
	})
	enablePrincipalCache(srv)
	left := [2]string{"dashboards:read", "dashboards:uid:left"}
	right := [2]string{"dashboards:read", "dashboards:uid:right"}
	require.True(t, permissionPairs(t, srv, "user:alice", []string{"left"}, false)[left])
	require.Empty(t, permissionPairs(t, srv, "user:alice", nil, false))
	require.Empty(t, permissionPairs(t, srv, "user:bob", nil, false))
	got := permissionPairs(t, srv, "user:bob", []string{"right"}, false)
	require.True(t, got[right])
	require.False(t, got[left])
}

func TestUserPermissionsBypassesPrincipalCache(t *testing.T) {
	grant := common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard")
	srv, ds, store := newPermissionTestServer(t, []*openfgav1.TupleKey{grant})
	enablePrincipalCache(srv)
	require.NotEmpty(t, permissionPairs(t, srv, "user:alice", nil, false))
	// A write on another instance has no local invalidation hook.
	require.NoError(t, ds.Write(t.Context(), store.ID, []*openfgav1.TupleKeyWithoutCondition{{User: grant.User, Relation: grant.Relation, Object: grant.Object}}, nil))
	ds.reset()
	require.Empty(t, permissionPairs(t, srv, "user:alice", nil, true))
	counts, _ := ds.counts()
	require.Equal(t, map[string]int{"model": 1, "read": 1}, counts)
	require.NotEmpty(t, permissionPairs(t, srv, "user:alice", nil, false), "bypass must not populate or replace shared entries")
}

func TestUserPermissionsCacheTTLObservesExternalRevocation(t *testing.T) {
	grant := common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard")
	srv, ds, store := newPermissionTestServer(t, []*openfgav1.TupleKey{grant})
	enablePrincipalCache(srv)
	srv.cfg.CacheSettings.CheckQueryCacheTTL = 20 * time.Millisecond
	require.NotEmpty(t, permissionPairs(t, srv, "user:alice", nil, false))
	require.NoError(t, ds.Write(t.Context(), store.ID, []*openfgav1.TupleKeyWithoutCondition{{User: grant.User, Relation: grant.Relation, Object: grant.Object}}, nil))
	time.Sleep(25 * time.Millisecond)
	require.Empty(t, permissionPairs(t, srv, "user:alice", nil, false))
}

func TestUserPermissionsWriteEvictsNegativeContribution(t *testing.T) {
	srv, _, _ := newPermissionTestServer(t, nil)
	enablePrincipalCache(srv)
	require.Empty(t, permissionPairs(t, srv, "user:alice", nil, false))
	grant := common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard")
	_, err := srv.Write(newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUpdate), &authzextv1.WriteRequest{Namespace: namespace, Writes: &authzextv1.WriteRequestWrites{TupleKeys: []*authzextv1.TupleKey{common.ToAuthzExtTupleKey(grant)}}})
	require.NoError(t, err)
	require.True(t, permissionPairs(t, srv, "user:alice", nil, false)[[2]string{"dashboards:read", "dashboards:uid:dashboard"}])
}

type gatedPermissionStore struct {
	storage.OpenFGADatastore
	mu      sync.Mutex
	entered chan struct{}
	release chan struct{}
	block   bool
	reads   int
}

func (s *gatedPermissionStore) Read(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadOptions) (storage.TupleIterator, error) {
	iterator, err := s.OpenFGADatastore.Read(ctx, store, filter, options)
	if err != nil {
		return nil, err
	}
	if filter.User != "team:shared#member" {
		return iterator, nil
	}
	// Capture results before the gate so a concurrent revocation can make this
	// in-flight read stale, just as with a remote database read.
	var rows []*openfgav1.Tuple
	for {
		row, err := iterator.Next(ctx)
		if errors.Is(err, storage.ErrIteratorDone) {
			break
		}
		if err != nil {
			iterator.Stop()
			return nil, err
		}
		rows = append(rows, row)
	}
	iterator.Stop()
	s.mu.Lock()
	s.reads++
	block := s.block
	if block {
		s.block = false
		close(s.entered)
	}
	s.mu.Unlock()
	if block {
		select {
		case <-s.release:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return storage.NewStaticTupleIterator(rows), nil
}

func TestUserPermissionsCoalescesSharedLoadsAcrossCanceledWaiter(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{common.NewResourceTuple("team:shared#member", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard")})
	enablePrincipalCache(srv)
	// Warm only the model and individual empty users.
	permissionPairs(t, srv, "user:alice", nil, false)
	permissionPairs(t, srv, "user:bob", nil, false)
	gate := &gatedPermissionStore{OpenFGADatastore: ds, entered: make(chan struct{}), release: make(chan struct{}), block: true}
	srv.store = gate
	ctx, cancel := context.WithCancel(newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions))
	first := make(chan error, 1)
	go func() {
		first <- srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice", Teams: []string{"shared"}}, &permissionResponseStream{ctx: ctx})
	}()
	<-gate.entered
	second := make(chan error, 1)
	go func() {
		second <- srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:bob", Teams: []string{"shared"}}, &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)})
	}()
	cancel()
	require.ErrorIs(t, <-first, context.Canceled)
	close(gate.release)
	require.NoError(t, <-second)
	gate.mu.Lock()
	defer gate.mu.Unlock()
	require.Equal(t, 1, gate.reads)
}

func TestUserPermissionsDoesNotRepopulateCacheFromReadBeforeWrite(t *testing.T) {
	grant := common.NewResourceTuple("team:shared#member", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard")
	srv, ds, store := newPermissionTestServer(t, []*openfgav1.TupleKey{grant})
	enablePrincipalCache(srv)
	permissionPairs(t, srv, "user:alice", nil, false)
	gate := &gatedPermissionStore{OpenFGADatastore: ds, entered: make(chan struct{}), release: make(chan struct{}), block: true}
	srv.store = gate
	done := make(chan error, 1)
	go func() {
		done <- srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice", Teams: []string{"shared"}}, &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)})
	}()
	<-gate.entered
	require.NoError(t, srv.WriteTuples(t.Context(), store, nil, []*openfgav1.TupleKeyWithoutCondition{{User: grant.User, Relation: grant.Relation, Object: grant.Object}}))
	require.False(t, permissionPairs(t, srv, "user:bob", []string{"shared"}, false)[[2]string{"dashboards:read", "dashboards:uid:dashboard"}])
	close(gate.release)
	require.NoError(t, <-done)
	require.False(t, permissionPairs(t, srv, "user:alice", []string{"shared"}, false)[[2]string{"dashboards:read", "dashboards:uid:dashboard"}])
}

func TestUserPermissionsReusesRoleAcrossDifferentTeams(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewTypedTuple(common.TypeRole, "team:left#member", common.RelationAssignee, "shared"),
		common.NewTypedTuple(common.TypeRole, "team:right#member", common.RelationAssignee, "shared"),
		common.NewResourceTuple("role:shared#assignee", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard"),
	})
	enablePrincipalCache(srv)
	want := permissionPairs(t, srv, "user:alice", []string{"left"}, false)
	ds.reset()
	got := permissionPairs(t, srv, "user:bob", []string{"right"}, false)
	key := [2]string{"dashboards:read", "dashboards:uid:dashboard"}
	require.True(t, want[key])
	require.True(t, got[key])
	counts, _ := ds.counts()
	require.Equal(t, 2, counts["read"], "a new user and team reuse the existing role contribution")
}

func TestUserPermissionsComposesStoredAndContextualTeams(t *testing.T) {
	membership := common.NewTypedTuple(common.TypeTeam, "user:alice", common.RelationTeamMember, "stored")
	srv, _, store := newPermissionTestServer(t, []*openfgav1.TupleKey{
		membership,
		common.NewResourceTuple("team:stored#member", common.RelationGet, dashboardGroup, dashboardResource, "", "stored"),
		common.NewResourceTuple("team:external#member", common.RelationGet, dashboardGroup, dashboardResource, "", "external"),
	})
	enablePrincipalCache(srv)
	stored := [2]string{"dashboards:read", "dashboards:uid:stored"}
	external := [2]string{"dashboards:read", "dashboards:uid:external"}
	got := permissionPairs(t, srv, "user:alice", []string{"external"}, false)
	require.True(t, got[stored])
	require.True(t, got[external])
	got = permissionPairs(t, srv, "user:alice", nil, false)
	require.True(t, got[stored])
	require.False(t, got[external])
	require.NoError(t, srv.WriteTuples(t.Context(), store, nil, []*openfgav1.TupleKeyWithoutCondition{{User: membership.User, Relation: membership.Relation, Object: membership.Object}}))
	require.Empty(t, permissionPairs(t, srv, "user:alice", nil, false))
}

func TestUserPermissionsPrincipalCacheIsolatesStores(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "first")})
	enablePrincipalCache(srv)
	permissionPairs(t, srv, "user:alice", nil, false)
	srv.cfg.AllowInsecure = true
	other, err := srv.getStoreInfo(t.Context(), "stacks-42")
	require.NoError(t, err)
	require.NoError(t, ds.Write(t.Context(), other.ID, nil, []*openfgav1.TupleKey{common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "second")}))
	stream := &permissionResponseStream{ctx: context.Background()}
	require.NoError(t, srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: "stacks-42", Subject: "user:alice"}, stream))
	require.Equal(t, []*authzv1.UserPermission{{Action: "dashboards:read", Scope: "dashboards:uid:second"}}, stream.permissions)
}

func TestUserPermissionsDoesNotCacheFailedRead(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard")})
	enablePrincipalCache(srv)
	ds.failIterator = errors.New("read interrupted")
	stream := &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
	require.Error(t, srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream))
	require.Empty(t, stream.permissions)
	ds.failIterator = nil
	require.NotEmpty(t, permissionPairs(t, srv, "user:alice", nil, false))
}
