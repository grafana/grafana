package authz

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/server/reconciler"
)

func TestReconcilerState_GlobalRoleSnapshotIsolation(t *testing.T) {
	ctx := context.Background()
	database := kvstore.NewFakeKVStore()
	first := newReconcilerState(database)
	second := newReconcilerState(database)
	const key = "snapshot-v1-state2"
	require.NoError(t, first.Set(ctx, key, "namespace completion"))
	require.NoError(t, first.SetGlobalRoleSnapshot(ctx, key, "global permissions"))

	raw, ok, err := second.GetGlobalRoleSnapshot(ctx, key)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "global permissions", raw)
	raw, ok, err = database.Get(ctx, reconciler.StateKVOrgID, reconciler.GlobalRolesKVNamespace, key)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "global permissions", raw)

	require.NoError(t, second.Del(ctx, key))
	raw, ok, err = first.GetGlobalRoleSnapshot(ctx, key)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "global permissions", raw, "namespace cleanup must not delete snapshots")

	otherCluster := newReconcilerState(kvstore.NewFakeKVStore())
	_, ok, err = otherCluster.GetGlobalRoleSnapshot(ctx, key)
	require.NoError(t, err)
	require.False(t, ok, "snapshots must not cross cluster databases")
}
