package server

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func setupMutateRoles(t *testing.T, srv *Server) *Server {
	t.Helper()

	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewTuple("role:foo_viewer#assignee", "view", "group_resource:dashboard.grafana.app/dashboards"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func TestIntegrationServerMutateRoles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	srv := setupOpenFGAServer(t)
	setupMutateRoles(t, srv)

	t.Run("should update role and delete old role permissions", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithZanzanaUpdatePermission(), &v1.MutateRequest{
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

func TestIntegrationDatasourceRoleActionSets(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, action := range []string{"datasources:query", "datasources:edit", "datasources:admin"} {
		for _, scope := range []string{"datasources:uid:ds1", "datasources:*"} {
			t.Run(action+"/"+scope, func(t *testing.T) {
				srv := setupOpenFGAServer(t)
				tuples, err := zanzana.RoleToTuples("datasource-role", []*v1.RolePermission{{Action: action, Scope: scope}})
				require.NoError(t, err)
				tuples = append(tuples, common.NewTuple("user:datasource-user", "assignee", "role:datasource-role"))
				setupOpenFGADatabase(t, srv, tuples)
				for _, tc := range []struct {
					verb, subresource string
					allowed           bool
				}{
					{"get", "", true},
					{"list", "", true},
					{"create", "query", true},
					{"create", "", false},
					{"update", "", action != "datasources:query"},
					{"delete", "", action != "datasources:query"},
					{"get_permissions", "", action == "datasources:admin"},
					{"set_permissions", "", action == "datasources:admin"},
					{"get", "caching", action == "datasources:admin"},
					{"update", "caching", action == "datasources:admin"},
					{"create", "caching", action == "datasources:admin"},
					{"delete", "caching", action == "datasources:admin"},
				} {
					for _, uid := range []string{"ds1", "ds2"} {
						t.Run(tc.verb+"/"+tc.subresource+"/"+uid, func(t *testing.T) {
							result, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{
								Namespace: namespace, Subject: "user:datasource-user",
								Group: "datasource.grafana.app", Resource: "datasources",
								Verb: tc.verb, Subresource: tc.subresource, Name: uid,
							})
							require.NoError(t, err)
							require.Equal(t, tc.allowed && (uid == "ds1" || scope == "datasources:*"), result.GetAllowed())
						})
					}
				}
			})
		}
	}
}
