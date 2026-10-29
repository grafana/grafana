package server

import (
	"context"
	"fmt"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func TestPermissionSnapshotTupleLimitReturnsResourceExhausted(t *testing.T) {
	tuples := &permissionSnapshotTuples{keys: make(map[permissionSnapshotTupleKey]*openfgav1.TupleKey)}
	for i := range permissionSnapshotMaxTuples {
		require.NoError(t, tuples.add(&openfgav1.TupleKey{User: "user:alice", Relation: "get", Object: fmt.Sprintf("folder:%d", i)}))
	}
	require.NoError(t, tuples.add(&openfgav1.TupleKey{User: "user:alice", Relation: "get", Object: "folder:0"}))
	err := tuples.add(&openfgav1.TupleKey{User: "user:alice", Relation: "get", Object: "folder:over-limit"})
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	require.Len(t, tuples.keys, permissionSnapshotMaxTuples)
}

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
	tuples := make([]*openfgav1.Tuple, permissionSnapshotMaxTuples+1)
	for i := range tuples {
		tuples[i] = &openfgav1.Tuple{Key: common.NewFolderTuple("user:alice", common.RelationGet, fmt.Sprintf("folder-%d", i))}
	}
	return storage.NewStaticTupleIterator(tuples), nil
}

func TestPermissionSnapshotEarlyExitCancelsPrincipalStream(t *testing.T) {
	for _, malformed := range []bool{false, true} {
		t.Run(fmt.Sprintf("malformed=%t", malformed), func(t *testing.T) {
			srv, ds, _ := newSnapshotTestServer(t, []*openfgav1.TupleKey{
				common.NewTypedTuple(common.TypeFolder, "user:alice", common.RelationGet, "root"),
			})
			store := &permissionPrincipalTestStore{OpenFGADatastore: ds, malformed: malformed}
			srv.store = store
			ctx := newContextWithNamespace()
			results, err := srv.listUserPermissions(ctx, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"})
			require.Error(t, err)
			require.Empty(t, results)
			if !malformed {
				require.Equal(t, codes.ResourceExhausted, status.Code(err))
			}
			require.NotNil(t, store.ctx)
			require.ErrorIs(t, store.ctx.Err(), context.Canceled)
			require.NoError(t, ctx.Err())
		})
	}
}
