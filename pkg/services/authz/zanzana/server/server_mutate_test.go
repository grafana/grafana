package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func setupMutate(t *testing.T, srv *Server) *Server {
	t.Helper()

	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewFolderParentTuple("11", "1"),
		common.NewFolderParentTuple("12", "1"),
		common.NewFolderParentTuple("111", "11"),
		common.NewFolderParentTuple("112", "11"),
		common.NewResourceTuple("user:1", common.RelationGet, dashboardGroup, dashboardResource, "", "1"),
		common.NewResourceTuple("user:1", common.RelationUpdate, dashboardGroup, dashboardResource, "", "1"),
		common.NewTypedResourceTuple("user:2", common.RelationGet, common.TypeFolder, folderGroup, folderResource, "", "1"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func testMutate(t *testing.T, srv *Server) {
	setupMutate(t, srv)

	t.Run("should perform multiple mutate operations", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithNamespace(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_SetFolderParent{
						SetFolderParent: &v1.SetFolderParentOperation{
							Folder:         "new-folder",
							Parent:         "1",
							DeleteExisting: false,
						},
					},
				},
				{
					Operation: &v1.MutateOperation_CreatePermission{
						CreatePermission: &v1.CreatePermissionOperation{
							Resource: &v1.Resource{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "foo",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "bar",
								Verb: common.RelationGet,
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeletePermission{
						DeletePermission: &v1.DeletePermissionOperation{
							Resource: &v1.Resource{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "1",
								Verb: common.RelationUpdate,
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeletePermission{
						DeletePermission: &v1.DeletePermissionOperation{
							Resource: &v1.Resource{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "1",
								Verb: common.RelationGet,
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
				Object:   "folder:new-folder",
				Relation: "parent",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "folder:new-folder", res.Tuples[0].Key.Object)
		require.Equal(t, "parent", res.Tuples[0].Key.Relation)
		require.Equal(t, "folder:1", res.Tuples[0].Key.User)

		res, err = srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Relation: common.RelationGet,
				Object:   "resource:dashboard.grafana.app/dashboards/foo",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "user:bar", res.Tuples[0].Key.User)
		require.Equal(t, common.RelationGet, res.Tuples[0].Key.Relation)
		require.Equal(t, "resource:dashboard.grafana.app/dashboards/foo", res.Tuples[0].Key.Object)

		res, err = srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Relation: common.RelationGet,
				Object:   "resource:dashboard.grafana.app/dashboards/1",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 0)
	})
}
