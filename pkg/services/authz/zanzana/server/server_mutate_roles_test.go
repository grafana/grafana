package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func setupMutateRoles(t *testing.T, srv *Server) *Server {
	t.Helper()

	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewTuple("role:foo_viewer#assignee", "view", "group_resource:dashboard.grafana.app/dashboards"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func testMutateRoles(t *testing.T, srv *Server) {
	setupMutateRoles(t, srv)

	t.Run("should update role and delete old role permissions", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithNamespace(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_CreateRole{
						CreateRole: &v1.CreateRoleOperation{
							RoleName: "foo_viewer",
							RoleKind: "Role",
							Permissions: []*v1.RolePermission{
								{
									Action: "dashboards:edit",
									Scope:  "dashboards:*",
								},
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeleteRole{
						DeleteRole: &v1.DeleteRoleOperation{
							RoleName: "foo_viewer",
							RoleKind: "Role",
							Permissions: []*v1.RolePermission{
								{
									Action: "dashboards:view",
									Scope:  "dashboards:*",
								},
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		res, err := srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				User:     "role:foo_viewer#assignee",
				Relation: "edit",
				Object:   "group_resource:",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "role:foo_viewer#assignee", res.Tuples[0].Key.User)
		require.Equal(t, "group_resource:dashboard.grafana.app/dashboards", res.Tuples[0].Key.Object)
		require.Equal(t, "edit", res.Tuples[0].Key.Relation)
	})
}
