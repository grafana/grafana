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

func TestPermissionSnapshotTupleLimitRetainsLegacyFallback(t *testing.T) {
	tuples := &permissionSnapshotTuples{keys: make(map[permissionSnapshotTupleKey]*openfgav1.TupleKey)}
	for i := range permissionSnapshotMaxTuples {
		require.NoError(t, tuples.add(&openfgav1.TupleKey{User: "user:alice", Relation: "get", Object: fmt.Sprintf("folder:%d", i)}))
	}
	require.NoError(t, tuples.add(&openfgav1.TupleKey{User: "user:alice", Relation: "get", Object: "folder:0"}))
	err := tuples.add(&openfgav1.TupleKey{User: "user:alice", Relation: "get", Object: "folder:over-limit"})
	require.Equal(t, codes.Unimplemented, status.Code(err))
	require.Len(t, tuples.keys, permissionSnapshotMaxTuples)
}

type permissionDescendantTestStore struct {
	storage.OpenFGADatastore
	ctx       context.Context
	depth     int
	malformed bool
}

func (s *permissionDescendantTestStore) ReadStartingWithUser(ctx context.Context, _ string, filter storage.ReadStartingWithUserFilter, _ storage.ReadStartingWithUserOptions) (storage.TupleIterator, error) {
	s.ctx = ctx
	if s.malformed {
		return storage.NewStaticTupleIterator([]*openfgav1.Tuple{{}}), nil
	}
	s.depth++
	return storage.NewStaticTupleIterator([]*openfgav1.Tuple{{Key: &openfgav1.TupleKey{
		User: filter.UserFilter[0].GetObject(), Relation: common.RelationParent, Object: fmt.Sprintf("folder:child-%d", s.depth),
	}}}), nil
}

func TestPermissionSnapshotEarlyExitCancelsDescendantStream(t *testing.T) {
	for _, malformed := range []bool{false, true} {
		t.Run(fmt.Sprintf("malformed=%t", malformed), func(t *testing.T) {
			srv, ds, _ := newSnapshotTestServer(t, []*openfgav1.TupleKey{
				common.NewTypedTuple(common.TypeFolder, "user:alice", common.RelationGet, "root"),
			})
			store := &permissionDescendantTestStore{OpenFGADatastore: ds, malformed: malformed}
			srv.store = store
			ctx := newContextWithNamespace()
			results, err := srv.listUserPermissions(ctx, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"})
			require.Error(t, err)
			require.Empty(t, results)
			if !malformed {
				require.Equal(t, codes.Unimplemented, status.Code(err))
				require.Equal(t, permissionSnapshotMaxDepth, store.depth)
			}
			require.NotNil(t, store.ctx)
			require.ErrorIs(t, store.ctx.Err(), context.Canceled)
			require.NoError(t, ctx.Err())
		})
	}
}
