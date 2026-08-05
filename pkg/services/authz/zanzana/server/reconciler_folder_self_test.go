package server

import (
	"context"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationReconciler_FolderSelfReadWildcardScopeRejected is a spike test for
// identity-access-team#2285, open question #6 (wildcard-scope edge case): "if someone grants
// folders.self:read with scope folders:* instead of folders:uid:X, what happens?"
//
// common.TranslateToResourceTuple happily produces a get_self tuple on a group_resource object
// (see common.TestTranslateToResourceTuple_FolderSelfReadWildcardScope) -- translation does not
// reject it. This test proves the *next* layer down, the real compiled OpenFGA model, does: since
// get_self is deliberately absent from schema_resource.fga's group_resource type, writing that
// tuple is rejected by OpenFGA itself.
//
// Practical consequence for the reconciler: a Role with {action: folders.self:read,
// scope: folders:*} will fail to reconcile its tuples (the write errors), rather than silently
// granting nothing or silently granting everything. This is undesirable either way -- Phase 1
// needs explicit validation that rejects folders.self:read + a wildcard/kind-level scope at
// role-write time, with a clear error, instead of leaving it to fail this deep in the pipeline.
func TestIntegrationReconciler_FolderSelfReadWildcardScopeRejected(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	srv := setupOpenFGAServer(t)

	tuple, ok := common.TranslateToResourceTuple("user:wildcard-self", "folders.self:read", "folders", "*")
	require.True(t, ok)
	require.Equal(t, common.RelationGetSelf, tuple.Relation)
	require.Equal(t, "group_resource:folder.grafana.app/folders", tuple.Object)

	store, err := srv.getStoreInfo(context.Background(), namespace)
	require.NoError(t, err)

	_, err = srv.openFGAClient.Write(context.Background(), &openfgav1.WriteRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys: []*openfgav1.TupleKey{tuple},
		},
	})

	assert.Error(t, err, "OpenFGA should reject a get_self tuple on group_resource:folder.grafana.app/folders, since get_self is not a relation defined on that type")
}
