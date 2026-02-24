package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func setupFolders() []*openfgav1.TupleKey {
	// seed tuples with a folder hierarchy:
	// folder 1 (root)
	//   └── folder 11
	//       ├── folder 111
	//       └── folder 112
	//   └── folder 12
	return []*openfgav1.TupleKey{
		common.NewFolderParentTuple("11", "1"),
		common.NewFolderParentTuple("12", "1"),
		common.NewFolderParentTuple("111", "11"),
		common.NewFolderParentTuple("112", "11"),
	}
}

func setupQueryFolders(t *testing.T, srv *Server) *Server {
	t.Helper()

	tuples := []*openfgav1.TupleKey{} //nolint:prealloc
	tuples = append(tuples, setupFolders()...)

	return setupOpenFGADatabase(t, srv, tuples)
}

func TestIntegrationServerQueryFolders(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	srv := setupOpenFGAServer(t)
	setupQueryFolders(t, srv)

	t.Run("should query folder parents successfully", func(t *testing.T) {
		res, err := srv.Query(newContextWithNamespace(), &v1.QueryRequest{
			Namespace: "default",
			Operation: &v1.QueryOperation{
				Operation: &v1.QueryOperation_GetFolderParents{
					GetFolderParents: &v1.GetFolderParentsQuery{
						Folder: "11",
					},
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, res)
		require.NotNil(t, res.GetFolderParents())
		require.Len(t, res.GetFolderParents().ParentUids, 1)
		require.Equal(t, "1", res.GetFolderParents().ParentUids[0])
	})

	t.Run("should query nested folder parents successfully", func(t *testing.T) {
		res, err := srv.Query(newContextWithNamespace(), &v1.QueryRequest{
			Namespace: "default",
			Operation: &v1.QueryOperation{
				Operation: &v1.QueryOperation_GetFolderParents{
					GetFolderParents: &v1.GetFolderParentsQuery{
						Folder: "111",
					},
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, res)
		require.NotNil(t, res.GetFolderParents())
		require.Len(t, res.GetFolderParents().ParentUids, 1)
		require.Equal(t, "11", res.GetFolderParents().ParentUids[0])
	})

	t.Run("should return empty list for folder with no parents", func(t *testing.T) {
		res, err := srv.Query(newContextWithNamespace(), &v1.QueryRequest{
			Namespace: "default",
			Operation: &v1.QueryOperation{
				Operation: &v1.QueryOperation_GetFolderParents{
					GetFolderParents: &v1.GetFolderParentsQuery{
						Folder: "1",
					},
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, res)
		require.NotNil(t, res.GetFolderParents())
		require.Len(t, res.GetFolderParents().ParentUids, 0)
	})

	t.Run("should return empty list for non-existent folder", func(t *testing.T) {
		res, err := srv.Query(newContextWithNamespace(), &v1.QueryRequest{
			Namespace: "default",
			Operation: &v1.QueryOperation{
				Operation: &v1.QueryOperation_GetFolderParents{
					GetFolderParents: &v1.GetFolderParentsQuery{
						Folder: "non-existent",
					},
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, res)
		require.NotNil(t, res.GetFolderParents())
		require.Len(t, res.GetFolderParents().ParentUids, 0)
	})

	t.Run("should return error for empty folder UID", func(t *testing.T) {
		_, err := srv.Query(newContextWithNamespace(), &v1.QueryRequest{
			Namespace: "default",
			Operation: &v1.QueryOperation{
				Operation: &v1.QueryOperation_GetFolderParents{
					GetFolderParents: &v1.GetFolderParentsQuery{
						Folder: "",
					},
				},
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to perform query request")
	})

	t.Run("should return error for nil operation", func(t *testing.T) {
		_, err := srv.Query(newContextWithNamespace(), &v1.QueryRequest{
			Namespace: "default",
			Operation: nil,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to perform query request")
	})
}
