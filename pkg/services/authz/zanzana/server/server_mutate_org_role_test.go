package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func setupMutateOrgRoles(t *testing.T, srv *Server) *Server {
	t.Helper()

	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewTuple("user:1", common.RelationAssignee, "role:Editor"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func testMutateOrgRoles(t *testing.T, srv *Server) {
	setupMutateResourcePermissions(t, srv)

	t.Run("should update user org role and delete old role", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithNamespace(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_UpdateUserOrgRole{
						UpdateUserOrgRole: &v1.UpdateUserOrgRoleOperation{
							User: "1",
							Role: "Admin",
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeleteUserOrgRole{
						DeleteUserOrgRole: &v1.DeleteUserOrgRoleOperation{
							User: "1",
							Role: "Editor",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		res, err := srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Relation: common.RelationAssignee,
				Object:   "role:Admin",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "user:1", res.Tuples[0].Key.User)
	})
}
