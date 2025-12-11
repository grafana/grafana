package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func setupMutateFolders(t *testing.T, srv *Server) *Server {
	t.Helper()

	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewFolderParentTuple("11", "1"),
		common.NewFolderParentTuple("12", "1"),
		common.NewFolderParentTuple("111", "11"),
		common.NewFolderParentTuple("112", "11"),
		common.NewFolderParentTuple("broken", "foo"),
		common.NewFolderParentTuple("broken", "bar"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func testMutateFolders(t *testing.T, srv *Server) {
	setupMutateFolders(t, srv)

	t.Run("should create new folder parent relation", func(t *testing.T) {
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
	})

	t.Run("should delete folder parent relation", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithNamespace(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_DeleteFolder{
						DeleteFolder: &v1.DeleteFolderOperation{
							Folder: "11",
							Parent: "1",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		res, err := srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Object:   "folder:11",
				Relation: "parent",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 0)
	})

	t.Run("should clean up all parent relations", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithNamespace(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_DeleteFolder{
						DeleteFolder: &v1.DeleteFolderOperation{
							Folder:         "broken",
							DeleteExisting: true,
						},
					},
				},
			},
		})
		require.NoError(t, err)

		res, err := srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Object:   "folder:broken",
				Relation: "parent",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 0)
	})

	t.Run("should perform batch mutate if multiple operations are provided", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithNamespace(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_SetFolderParent{
						SetFolderParent: &v1.SetFolderParentOperation{
							Folder: "new-folder-2",
							Parent: "1",
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeleteFolder{
						DeleteFolder: &v1.DeleteFolderOperation{
							Folder: "12",
							Parent: "1",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		res, err := srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Object:   "folder:new-folder-2",
				Relation: "parent",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "folder:new-folder-2", res.Tuples[0].Key.Object)
		require.Equal(t, "parent", res.Tuples[0].Key.Relation)
		require.Equal(t, "folder:1", res.Tuples[0].Key.User)

		res, err = srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Object:   "folder:12",
				Relation: "parent",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 0)
	})
}
