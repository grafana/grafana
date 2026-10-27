package server

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/memory"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
)

func permissionStoreFixture(t testing.TB) (*openfgav1.AuthorizationModel, []*openfgav1.TupleKey) {
	t.Helper()
	model, err := permissionSnapshotModel()
	require.NoError(t, err)
	model = proto.Clone(model).(*openfgav1.AuthorizationModel)
	model.Id = "01K00000000000000000000000"
	conditionContext, err := structpb.NewStruct(map[string]any{"region": "europe"})
	require.NoError(t, err)
	return model, []*openfgav1.TupleKey{
		tuple.NewTupleKey("document:z", "viewer", "user:alice"),
		tuple.NewTupleKey("document:a", "viewer", "user:alice"),
		tuple.NewTupleKey("document:b", "viewer", "team:eng#member"),
		tuple.NewTupleKey("document:b", "viewer", "role:reader#assignee"),
		tuple.NewTupleKey("document:b", "viewer", "user:*"),
		tuple.NewTupleKey("document:b", "editor", "team:eng#admin"),
		tuple.NewTupleKey("folder:parent", "viewer", "user:bob"),
		{Object: "document:c", Relation: "viewer", User: "user:alice", Condition: &openfgav1.RelationshipCondition{Name: "regional", Context: conditionContext}},
		{Object: "document:b", Relation: "viewer", User: "team:conditional#member", Condition: &openfgav1.RelationshipCondition{Name: "regional", Context: conditionContext}},
	}
}

func permissionIteratorKeys(t testing.TB, iterator storage.TupleIterator, err error) []*openfgav1.TupleKey {
	t.Helper()
	require.NoError(t, err)
	defer iterator.Stop()
	var keys []*openfgav1.TupleKey
	for {
		item, err := iterator.Next(context.Background())
		if errors.Is(err, storage.ErrIteratorDone) {
			return keys
		}
		require.NoError(t, err)
		keys = append(keys, item.GetKey())
	}
}

func equalPermissionKeys(t testing.TB, expected, actual []*openfgav1.TupleKey) {
	t.Helper()
	require.Len(t, actual, len(expected))
	compare := func(a, b *openfgav1.TupleKey) int {
		return strings.Compare(tuple.TupleKeyToString(a), tuple.TupleKeyToString(b))
	}
	slices.SortFunc(expected, compare)
	slices.SortFunc(actual, compare)
	for i := range expected {
		require.True(t, proto.Equal(expected[i], actual[i]), "expected %v, got %v", expected[i], actual[i])
	}
}

func TestPermissionSnapshotStoreReadContract(t *testing.T) {
	ctx := context.Background()
	model, keys := permissionStoreFixture(t)
	indexed, err := newPermissionSnapshotStore(ctx, "store", model, keys)
	require.NoError(t, err)
	t.Cleanup(indexed.Close)
	baseline := memory.New()
	t.Cleanup(baseline.Close)
	require.NoError(t, baseline.Write(ctx, "store", nil, keys))

	for _, filter := range []storage.ReadFilter{
		{}, {Object: "document:b"}, {Object: "document:"}, {Object: "document"}, {Relation: "editor"},
		{User: "user:alice"}, {User: "user:"}, {User: "team:eng#member"},
		{Object: "document:b", User: "team:eng#member", Relation: "viewer"},
		{Object: "document:", Conditions: []string{"regional"}}, {User: "user:alice", Conditions: []string{""}},
		{Object: "missing:x"}, {User: "user:missing"},
	} {
		t.Run(fmt.Sprintf("%+v", filter), func(t *testing.T) {
			wantIter, wantErr := baseline.Read(ctx, "store", filter, storage.ReadOptions{})
			gotIter, gotErr := indexed.Read(ctx, "store", filter, storage.ReadOptions{})
			equalPermissionKeys(t, permissionIteratorKeys(t, wantIter, wantErr), permissionIteratorKeys(t, gotIter, gotErr))
		})
	}
	for _, store := range []string{"store", "other"} {
		for _, filter := range []storage.ReadUsersetTuplesFilter{
			{Object: "document:b", Relation: "viewer"},
			{Object: "document:b", Relation: "viewer", AllowedUserTypeRestrictions: []*openfgav1.RelationReference{{Type: "team", RelationOrWildcard: &openfgav1.RelationReference_Relation{Relation: "member"}}}},
			{Object: "document:b", Relation: "viewer", AllowedUserTypeRestrictions: []*openfgav1.RelationReference{{Type: "user", RelationOrWildcard: &openfgav1.RelationReference_Wildcard{Wildcard: &openfgav1.Wildcard{}}}}},
		} {
			wantIter, wantErr := baseline.ReadUsersetTuples(ctx, store, filter, storage.ReadUsersetTuplesOptions{})
			gotIter, gotErr := indexed.ReadUsersetTuples(ctx, store, filter, storage.ReadUsersetTuplesOptions{})
			equalPermissionKeys(t, permissionIteratorKeys(t, wantIter, wantErr), permissionIteratorKeys(t, gotIter, gotErr))
		}
		for _, filter := range []storage.ReadStartingWithUserFilter{
			{ObjectType: "document", Relation: "viewer", UserFilter: []*openfgav1.ObjectRelation{{Object: "user:alice"}, {Object: "team:eng", Relation: "member"}}},
			{ObjectType: "document", Relation: "viewer", UserFilter: []*openfgav1.ObjectRelation{{Object: "user:alice"}}, ObjectIDs: storage.NewSortedSet("a", "c")},
			{ObjectType: "document", Relation: "viewer", UserFilter: []*openfgav1.ObjectRelation{{Object: "user:alice"}}, Conditions: []string{"regional"}},
		} {
			for _, sorted := range []bool{false, true} {
				options := storage.ReadStartingWithUserOptions{WithResultsSortedAscending: sorted}
				wantIter, wantErr := baseline.ReadStartingWithUser(ctx, store, filter, options)
				gotIter, gotErr := indexed.ReadStartingWithUser(ctx, store, filter, options)
				require.NoError(t, gotErr)
				require.Equal(t, sorted, gotIter.IsOrdered())
				got := permissionIteratorKeys(t, gotIter, nil)
				if sorted {
					require.True(t, slices.IsSortedFunc(got, func(a, b *openfgav1.TupleKey) int { return strings.Compare(a.GetObject(), b.GetObject()) }))
				}
				equalPermissionKeys(t, permissionIteratorKeys(t, wantIter, wantErr), got)
			}
		}
	}

	for _, filter := range []storage.ReadUserTupleFilter{
		{Object: "document:c", Relation: "viewer", User: "user:alice"},
		{Object: "document:c", Relation: "viewer", User: "user:alice", Conditions: []string{"regional"}},
		{Object: "document:c", Relation: "viewer", User: "user:alice", Conditions: []string{""}},
		{Object: "document:missing", Relation: "viewer", User: "user:alice"},
	} {
		want, wantErr := baseline.ReadUserTuple(ctx, "store", filter, storage.ReadUserTupleOptions{})
		got, gotErr := indexed.ReadUserTuple(ctx, "store", filter, storage.ReadUserTupleOptions{})
		require.Equal(t, wantErr, gotErr)
		if wantErr == nil {
			require.True(t, proto.Equal(want.GetKey(), got.GetKey()))
		}
	}
	iterator, err := indexed.Read(ctx, "other", storage.ReadFilter{}, storage.ReadOptions{})
	require.Empty(t, permissionIteratorKeys(t, iterator, err))
	_, err = indexed.ReadUserTuple(ctx, "other", storage.ReadUserTupleFilter{Object: "document:a", Relation: "viewer", User: "user:alice"}, storage.ReadUserTupleOptions{})
	require.ErrorIs(t, err, storage.ErrNotFound)
	storedModel, err := indexed.ReadAuthorizationModel(ctx, "store", model.GetId())
	require.NoError(t, err)
	require.True(t, proto.Equal(model, storedModel))
	_, err = indexed.ReadAuthorizationModel(ctx, "other", model.GetId())
	require.ErrorIs(t, err, storage.ErrNotFound)

	// Conditions must filter usersets too; the general memory backend ignores this
	// filter, so assert the storage contract directly rather than copying its bug.
	iterator, err = indexed.ReadUsersetTuples(ctx, "store", storage.ReadUsersetTuplesFilter{Object: "document:b", Relation: "viewer", Conditions: []string{"regional"}}, storage.ReadUsersetTuplesOptions{})
	equalPermissionKeys(t, []*openfgav1.TupleKey{keys[8]}, permissionIteratorKeys(t, iterator, err))
}

func TestPermissionSnapshotStorePagesAndImmutability(t *testing.T) {
	ctx := context.Background()
	model, keys := permissionStoreFixture(t)
	indexed, err := newPermissionSnapshotStore(ctx, "store", model, keys)
	require.NoError(t, err)
	t.Cleanup(indexed.Close)
	baseline := memory.New()
	t.Cleanup(baseline.Close)
	require.NoError(t, baseline.Write(ctx, "store", nil, keys))
	filter := storage.ReadFilter{Object: "document:"}
	options := storage.ReadPageOptions{Pagination: storage.PaginationOptions{PageSize: 3}}
	for {
		want, wantNext, err := baseline.ReadPage(ctx, "store", filter, options)
		require.NoError(t, err)
		got, gotNext, err := indexed.ReadPage(ctx, "store", filter, options)
		require.NoError(t, err)
		require.Equal(t, wantNext, gotNext)
		require.Len(t, got, len(want))
		for i := range want {
			require.True(t, proto.Equal(want[i].GetKey(), got[i].GetKey()))
		}
		if gotNext == "" {
			break
		}
		options.Pagination.From = gotNext
	}
	for _, token := range []string{"bad", "-1", "1000"} {
		_, _, err := indexed.ReadPage(ctx, "store", filter, storage.ReadPageOptions{Pagination: storage.PaginationOptions{PageSize: 3, From: token}})
		require.ErrorIs(t, err, storage.ErrInvalidContinuationToken)
	}
	page, next, err := indexed.ReadPage(ctx, "other", filter, storage.ReadPageOptions{Pagination: storage.PaginationOptions{PageSize: 3}})
	require.NoError(t, err)
	require.Empty(t, page)
	require.Empty(t, next)
	require.Error(t, indexed.Write(ctx, "store", nil, keys[:1]))
	keys[0].Object = "document:changed"
	keys[7].Condition.Context.Fields["region"] = structpb.NewStringValue("changed")
	item, err := indexed.ReadUserTuple(ctx, "store", storage.ReadUserTupleFilter{Object: "document:z", Relation: "viewer", User: "user:alice"}, storage.ReadUserTupleOptions{})
	require.NoError(t, err)
	require.Equal(t, "document:z", item.GetKey().GetObject())
	item, err = indexed.ReadUserTuple(ctx, "store", storage.ReadUserTupleFilter{Object: "document:c", Relation: "viewer", User: "user:alice"}, storage.ReadUserTupleOptions{})
	require.NoError(t, err)
	require.Equal(t, "europe", item.GetKey().GetCondition().GetContext().GetFields()["region"].GetStringValue())
	_, err = newPermissionSnapshotStore(ctx, "store", model, []*openfgav1.TupleKey{keys[0], keys[0]})
	require.ErrorIs(t, err, storage.ErrInvalidWriteInput)
	_, err = newPermissionSnapshotStore(ctx, "store", model, []*openfgav1.TupleKey{nil})
	require.Error(t, err)
}

func TestPermissionSnapshotStoreCancellation(t *testing.T) {
	model, keys := permissionStoreFixture(t)
	indexed, err := newPermissionSnapshotStore(context.Background(), "store", model, keys)
	require.NoError(t, err)
	t.Cleanup(indexed.Close)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = newPermissionSnapshotStore(ctx, "store", model, keys)
	require.ErrorIs(t, err, context.Canceled)
	_, err = indexed.Read(ctx, "store", storage.ReadFilter{}, storage.ReadOptions{})
	require.ErrorIs(t, err, context.Canceled)
	_, _, err = indexed.ReadPage(ctx, "store", storage.ReadFilter{}, storage.ReadPageOptions{})
	require.ErrorIs(t, err, context.Canceled)
	_, err = indexed.ReadUserTuple(ctx, "store", storage.ReadUserTupleFilter{}, storage.ReadUserTupleOptions{})
	require.ErrorIs(t, err, context.Canceled)
	_, err = indexed.ReadUsersetTuples(ctx, "store", storage.ReadUsersetTuplesFilter{}, storage.ReadUsersetTuplesOptions{})
	require.ErrorIs(t, err, context.Canceled)
	_, err = indexed.ReadStartingWithUser(ctx, "store", storage.ReadStartingWithUserFilter{}, storage.ReadStartingWithUserOptions{})
	require.ErrorIs(t, err, context.Canceled)
	iterator, err := indexed.Read(context.Background(), "store", storage.ReadFilter{}, storage.ReadOptions{})
	require.NoError(t, err)
	defer iterator.Stop()
	_, err = iterator.Next(ctx)
	require.ErrorIs(t, err, context.Canceled)
	_, err = iterator.Head(ctx)
	require.ErrorIs(t, err, context.Canceled)
}

func BenchmarkPermissionSnapshotStoreBuild(b *testing.B) {
	model, _ := permissionStoreFixture(b)
	for _, size := range []int{1000, 10000, 20000, 100000} {
		b.Run(fmt.Sprint(size), func(b *testing.B) {
			keys := make([]*openfgav1.TupleKey, size)
			for i := range keys {
				keys[i] = tuple.NewTupleKey(fmt.Sprintf("folder:%08d", i), "parent", "folder:root")
			}
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				store, err := newPermissionSnapshotStore(context.Background(), "store", model, keys)
				if err != nil {
					b.Fatal(err)
				}
				store.Close()
			}
		})
	}
}
