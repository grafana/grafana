package server

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func TestUserPermissionsReturnsUIDScopesWithoutIAM(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewTypedTuple(common.TypeTeam, "user:alice", common.RelationGet, "platform"),
		common.NewTypedTuple(common.TypeUser, "user:alice", common.RelationGet, "bob"),
		common.NewTypedTuple(common.TypeServiceAccount, "user:alice", common.RelationGet, "robot"),
	})
	stream := &permissionResponseStream{ctx: newContextWithNamespace()}
	require.NoError(t, srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream))
	require.ElementsMatch(t, []*authzv1.UserPermission{
		{Action: "teams:read", Scope: "teams:uid:platform"},
		{Action: "users:read", Scope: "global.users:uid:bob"},
		{Action: "org.users:read", Scope: "users:uid:bob"},
		{Action: "serviceaccounts:read", Scope: "serviceaccounts:uid:robot"},
	}, stream.permissions)
	counts, _ := ds.counts()
	require.Equal(t, map[string]int{"read": 1}, counts)
}
