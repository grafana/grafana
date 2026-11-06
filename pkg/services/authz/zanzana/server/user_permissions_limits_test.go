package server

import (
	"context"
	"errors"
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

type permissionPrincipalTestStore struct {
	storage.OpenFGADatastore
	ctx       context.Context
	malformed bool
}

func (s *permissionPrincipalTestStore) Read(ctx context.Context, _ string, _ storage.ReadFilter, _ storage.ReadOptions) (storage.TupleIterator, error) {
	s.ctx = ctx
	if s.malformed {
		return storage.NewStaticTupleIterator([]*openfgav1.Tuple{{}}), nil
	}
	return &permissionFailingIterator{TupleIterator: storage.NewStaticTupleIterator([]*openfgav1.Tuple{{Key: common.NewFolderTuple("user:alice", common.RelationGet, "root")}}), failure: errors.New("principal stream interrupted")}, nil
}

func TestPermissionPrincipalEarlyExitCancelsPrincipalStream(t *testing.T) {
	for _, malformed := range []bool{false, true} {
		t.Run(fmt.Sprintf("malformed=%t", malformed), func(t *testing.T) {
			srv, ds, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
				common.NewTypedTuple(common.TypeFolder, "user:alice", common.RelationGet, "root"),
			})
			store := &permissionPrincipalTestStore{OpenFGADatastore: ds, malformed: malformed}
			srv.store = store
			ctx := newContextWithNamespace()
			results, err := srv.resolveUserPermissions(ctx, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"})
			require.Error(t, err)
			require.Empty(t, results)
			if !malformed {
				require.ErrorContains(t, err, "principal stream interrupted")
			}
			require.NotNil(t, store.ctx)
			require.ErrorIs(t, store.ctx.Err(), context.Canceled)
			require.NoError(t, ctx.Err())
		})
	}
}

type largePermissionStore struct {
	storage.OpenFGADatastore
	rows  []*openfgav1.Tuple
	reads int
}

func (s *largePermissionStore) Read(context.Context, string, storage.ReadFilter, storage.ReadOptions) (storage.TupleIterator, error) {
	s.reads++
	return storage.NewStaticTupleIterator(s.rows), nil
}

func TestUserPermissionsReturnsLargePermissionsWithoutCaching(t *testing.T) {
	srv, ds, store := newPermissionTestServer(t, nil)
	enablePrincipalCache(srv)
	large := &largePermissionStore{OpenFGADatastore: ds, rows: make([]*openfgav1.Tuple, permissionPrincipalCacheMaxTuples+1)}
	for i := range large.rows {
		large.rows[i] = &openfgav1.Tuple{Key: common.NewFolderTuple("user:alice", common.RelationGet, fmt.Sprintf("folder-%d", i))}
	}
	srv.store = large
	for range 2 {
		stream := &permissionResponseStream{ctx: newContextWithNamespace()}
		require.NoError(t, srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream))
		require.Len(t, stream.permissions, len(large.rows))
		require.Contains(t, stream.permissions, &authzv1.UserPermission{Action: "folders:read", Scope: fmt.Sprintf("folders:uid:folder-%d", permissionPrincipalCacheMaxTuples)})
		cache := srv.principalCache()
		cache.mu.Lock()
		_, cached := cache.entries.Peek(permissionPrincipalKey{store.ID, store.ModelID, "user:alice"})
		cache.mu.Unlock()
		require.False(t, cached, "oversized principal grants must not occupy the principal cache")
	}
	require.Equal(t, 2, large.reads)
}

func TestUserPermissionsLimitsDistinctPrincipalsAcrossStages(t *testing.T) {
	for _, resource := range []string{common.TypeTeam, common.TypeRole} {
		t.Run(resource, func(t *testing.T) {
			srv, ds, store := newPermissionTestServer(t, nil)
			enablePrincipalCache(srv)
			dependencyCount := permissionPrincipalMaxCount
			var contextualTeams []string
			relation := common.RelationTeamMember
			if resource == common.TypeRole {
				relation = common.RelationAssignee
				dependencyCount--
				contextualTeams = []string{"one"}
			}
			dependencies := make([]string, dependencyCount)
			for i := range dependencies {
				dependencies[i] = fmt.Sprintf("%s:%d#%s", resource, i, relation)
			}
			cache := srv.principalCache()
			cache.mu.Lock()
			cache.entries.Add(permissionPrincipalKey{store.ID, store.ModelID, "user:alice"}, permissionPrincipalEntry{grants: &principalGrants{dependencies: dependencies, tupleCount: dependencyCount}, expires: cache.clock.Now().Add(time.Minute)})
			cache.entries.Add(permissionPrincipalKey{store.ID, store.ModelID, "team:one#member"}, permissionPrincipalEntry{grants: &principalGrants{}, expires: cache.clock.Now().Add(time.Minute)})
			cache.mu.Unlock()
			stream := &permissionResponseStream{ctx: newContextWithNamespace()}
			err := srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice", Teams: contextualTeams}, stream)
			require.Equal(t, codes.ResourceExhausted, status.Code(err))
			require.Empty(t, stream.permissions)
			_, reads := ds.counts()
			require.Zero(t, reads, "reject an oversized principal stage before issuing its reads")
		})
	}
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
