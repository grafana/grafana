package server

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

type stagedPermissionStore struct {
	storage.OpenFGADatastore
	userStarted, teamStarted, roleStarted chan struct{}
	releaseUser, releaseTeams             chan struct{}
	userOnce, teamOnce, roleOnce          sync.Once
	mu                                    sync.Mutex
	reads                                 map[string]int
}

func (s *stagedPermissionStore) Read(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadOptions) (storage.TupleIterator, error) {
	s.mu.Lock()
	s.reads[filter.User]++
	s.mu.Unlock()
	var release <-chan struct{}
	switch {
	case filter.User == "user:alice":
		s.userOnce.Do(func() { close(s.userStarted) })
		release = s.releaseUser
	case strings.HasPrefix(filter.User, common.TypeTeamPrefix):
		s.teamOnce.Do(func() { close(s.teamStarted) })
		release = s.releaseTeams
	default:
		s.roleOnce.Do(func() { close(s.roleStarted) })
	}
	if release != nil {
		select {
		case <-release:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return s.OpenFGADatastore.Read(ctx, store, filter, options)
}

func TestUserPermissionsLoadsUserThenTeamsThenRoles(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewFolderTuple("user:alice", common.RelationGet, "direct"),
		common.NewTypedTuple(common.TypeTeam, "user:alice", common.RelationTeamMember, "stored"),
		common.NewTypedTuple(common.TypeTeam, "user:alice", common.RelationTeamAdmin, "stored"),
		common.NewTypedTuple(common.TypeRole, "user:alice", common.RelationAssignee, "shared"),
		common.NewTypedTuple(common.TypeRole, "team:stored#member", common.RelationAssignee, "shared"),
		common.NewTypedTuple(common.TypeRole, "team:external#member", common.RelationAssignee, "shared"),
		common.NewFolderTuple("team:stored#member", common.RelationGet, "stored"),
		common.NewFolderTuple("team:external#member", common.RelationGet, "external"),
		common.NewFolderTuple("role:shared#assignee", common.RelationGet, "role"),
	})
	store := &stagedPermissionStore{OpenFGADatastore: ds, userStarted: make(chan struct{}), teamStarted: make(chan struct{}), roleStarted: make(chan struct{}), releaseUser: make(chan struct{}), releaseTeams: make(chan struct{}), reads: map[string]int{}}
	srv.store = store
	ctx, cancel := context.WithTimeout(newContextWithNamespace(), 5*time.Second)
	defer cancel()
	stream := &permissionResponseStream{ctx: ctx}
	result := make(chan error, 1)
	finished := make(chan struct{})
	t.Cleanup(func() { cancel(); <-finished })
	go func() {
		defer close(finished)
		result <- srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice", Teams: []string{"stored", "external", "external"}}, stream)
	}()
	select {
	case <-store.userStarted:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	select {
	case <-store.teamStarted:
		t.Fatal("team grants started loading before the user's grants finished loading")
	case <-time.After(50 * time.Millisecond):
	}
	close(store.releaseUser)
	select {
	case <-store.teamStarted:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	select {
	case <-store.roleStarted:
		t.Fatal("role grants started loading before the team grants finished loading")
	case <-time.After(50 * time.Millisecond):
	}
	close(store.releaseTeams)
	require.NoError(t, <-result)
	store.mu.Lock()
	require.Equal(t, map[string]int{"user:alice": 1, "team:stored#member": 1, "team:external#member": 1, "role:shared#assignee": 1}, store.reads)
	store.mu.Unlock()
	for _, name := range []string{"direct", "stored", "external", "role"} {
		require.Contains(t, stream.permissions, &authzv1.UserPermission{Action: "folders:read", Scope: "folders:uid:" + name})
	}
	for _, action := range []string{"teams:read", "teams:write", "teams:delete", "teams.permissions:read", "teams.permissions:write"} {
		require.Contains(t, stream.permissions, &authzv1.UserPermission{Action: action, Scope: "teams:uid:stored"})
	}
}

func TestUserPermissionsCachesEmptyTeamsAndRoles(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewTypedTuple(common.TypeRole, "user:alice", common.RelationAssignee, "empty"),
		common.NewTypedTuple(common.TypeRole, "user:bob", common.RelationAssignee, "empty"),
	})
	enablePrincipalCache(srv)
	for i, subject := range []string{"user:alice", "user:bob", "user:bob"} {
		ds.reset()
		got := permissionPairs(t, srv, subject, []string{"empty"}, false)
		require.Equal(t, map[[2]string]bool{{"teams:read", "teams:uid:empty"}: true}, got)
		_, reads := ds.counts()
		require.Equal(t, []int{3, 1, 0}[i], reads)
	}
}

func TestUserPermissionsRejectsUnexpectedPrincipalDependencies(t *testing.T) {
	for _, tc := range []struct {
		name, principal, dependency string
	}{
		{"unknown principal", "user:alice", "unknown:one#member"},
		{"unsupported team relation", "user:alice", "team:one#admin"},
		{"missing role relation", "user:alice", "role:one"},
		{"nested teams", "team:one#member", "team:two#member"},
		{"nested roles", "role:one#assignee", "role:two#assignee"},
		{"role team membership", "role:one#assignee", "team:two#member"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv, ds, store := newPermissionTestServer(t, nil)
			enablePrincipalCache(srv)
			cache := srv.principalCache()
			cache.mu.Lock()
			if tc.principal != "user:alice" {
				cache.entries.Add(permissionPrincipalKey{store.ID, store.ModelID, "user:alice"}, permissionPrincipalEntry{grants: &principalGrants{dependencies: []string{tc.principal}}, expires: cache.clock.Now().Add(time.Minute)})
			}
			cache.entries.Add(permissionPrincipalKey{store.ID, store.ModelID, tc.principal}, permissionPrincipalEntry{grants: &principalGrants{dependencies: []string{tc.dependency}}, expires: cache.clock.Now().Add(time.Minute)})
			cache.mu.Unlock()
			stream := &permissionResponseStream{ctx: newContextWithNamespace()}
			err := srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream)
			require.Equal(t, codes.FailedPrecondition, status.Code(err))
			require.Empty(t, stream.permissions)
			_, reads := ds.counts()
			require.Zero(t, reads, "unexpected dependencies must not trigger speculative reads")
		})
	}
}

func TestUserPermissionsPrincipalCacheIsolatesModels(t *testing.T) {
	old := common.NewFolderTuple("user:alice", common.RelationGet, "old")
	srv, ds, store := newPermissionTestServer(t, []*openfgav1.TupleKey{old})
	enablePrincipalCache(srv)
	require.True(t, permissionPairs(t, srv, "user:alice", nil, false)[[2]string{"folders:read", "folders:uid:old"}])
	require.NoError(t, ds.Write(t.Context(), store.ID, []*openfgav1.TupleKeyWithoutCondition{{User: old.User, Relation: old.Relation, Object: old.Object}}, []*openfgav1.TupleKey{common.NewFolderTuple("user:alice", common.RelationGet, "new")}))
	srv.storesMU.Lock()
	updated := srv.stores[namespace]
	updated.ModelID += "-next"
	srv.stores[namespace] = updated
	srv.storesMU.Unlock()
	ds.reset()
	got := permissionPairs(t, srv, "user:alice", nil, false)
	require.Equal(t, map[[2]string]bool{{"folders:read", "folders:uid:new"}: true}, got)
	counts, _ := ds.counts()
	require.Equal(t, map[string]int{"read": 1}, counts)
}

type boundedPermissionStore struct {
	storage.OpenFGADatastore
	started           chan struct{}
	release           chan struct{}
	mu                sync.Mutex
	active, maxActive int
}

func (s *boundedPermissionStore) Read(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadOptions) (storage.TupleIterator, error) {
	if strings.HasPrefix(filter.User, common.TypeTeamPrefix) {
		s.mu.Lock()
		s.active++
		s.maxActive = max(s.maxActive, s.active)
		s.mu.Unlock()
		defer func() { s.mu.Lock(); s.active--; s.mu.Unlock() }()
		s.started <- struct{}{}
		select {
		case <-s.release:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return s.OpenFGADatastore.Read(ctx, store, filter, options)
}

func TestUserPermissionsBoundsParallelPrincipalReads(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, nil)
	teams := make([]string, 20)
	for i := range teams {
		teams[i] = fmt.Sprintf("team-%d", i)
	}
	store := &boundedPermissionStore{OpenFGADatastore: ds, started: make(chan struct{}, len(teams)), release: make(chan struct{})}
	srv.store = store
	ctx, cancel := context.WithTimeout(newContextWithNamespace(), 5*time.Second)
	finished := make(chan struct{})
	result := make(chan error, 1)
	go func() {
		defer close(finished)
		result <- srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice", Teams: teams}, &permissionResponseStream{ctx: ctx})
	}()
	t.Cleanup(func() { cancel(); <-finished })
	for range permissionPrincipalConcurrency {
		select {
		case <-store.started:
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		}
	}
	select {
	case <-store.started:
		t.Fatal("more than eight principal reads started together")
	case <-time.After(50 * time.Millisecond):
	}
	close(store.release)
	require.NoError(t, <-result)
	store.mu.Lock()
	require.Equal(t, permissionPrincipalConcurrency, store.maxActive)
	store.mu.Unlock()
}
