package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func setupMutateRoleBindings(t *testing.T, srv *Server) *Server {
	t.Helper()

	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewTuple("user:1", common.RelationAssignee, "role:foo_viewer"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func testMutateRoleBindings(t *testing.T, srv *Server) {
	setupMutateRoleBindings(t, srv)

	t.Run("should update user role and delete old role", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithNamespace(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_CreateRoleBinding{
						CreateRoleBinding: &v1.CreateRoleBindingOperation{
							SubjectKind: "User",
							SubjectName: "1",
							RoleKind:    "Role",
							RoleName:    "foo_editor",
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeleteRoleBinding{
						DeleteRoleBinding: &v1.DeleteRoleBindingOperation{
							SubjectKind: "User",
							SubjectName: "1",
							RoleKind:    "Role",
							RoleName:    "foo_viewer",
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
				Object:   "role:foo_editor",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "user:1", res.Tuples[0].Key.User)

		res, err = srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Relation: common.RelationAssignee,
				Object:   "role:foo_viewer",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 0)
	})

	t.Run("should assign role to basic role", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithNamespace(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_CreateRoleBinding{
						CreateRoleBinding: &v1.CreateRoleBindingOperation{
							SubjectKind: "BasicRole",
							SubjectName: "basic_viewer",
							RoleKind:    "Role",
							RoleName:    "foo_bar",
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
				Object:   "role:foo_bar",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "role:basic_viewer#assignee", res.Tuples[0].Key.User)
	})
}
