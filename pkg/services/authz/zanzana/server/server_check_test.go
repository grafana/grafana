package server

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

const (
	dashboardGroup    = "dashboard.grafana.app"
	dashboardResource = "dashboards"

	folderGroup    = "folder.grafana.app"
	folderResource = "folders"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestServer_Check(t *testing.T) {
	server := setup(t)
	newRead := func(subject, group, resource, folder, name string) *authzv1.CheckRequest {
		return &authzv1.CheckRequest{
			Namespace: "stacks-1",
			Subject:   subject,
			Verb:      utils.VerbGet,
			Group:     group,
			Resource:  resource,
			Name:      name,
			Folder:    folder,
		}
	}

	t.Run("user:1 should only be able to read resource:dashboards.grafana.app/dashboards/1", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:1", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		// sanity check
		res, err = server.Check(context.Background(), newRead("user:1", dashboardGroup, dashboardResource, "1", "2"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:2 should be able to read resource:dashboards.grafana.app/dashboards/1 through group", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:2", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:3 should be able to read resource:dashboards.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:3", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		// sanity check
		res, err = server.Check(context.Background(), newRead("user:3", dashboardGroup, dashboardResource, "1", "2"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:4 should be able to read resource:dashboards.grafana.app/dashboards/1 through folder", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:4", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:5 should be able to read resource:dashboards.grafana.app/dashboards/1 through folder with set relation", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:5", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:5 should be able to read folder", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:5", folderGroup, folderResource, "", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})
}

func setup(t *testing.T) *Server {
	testDB, cfg := db.InitTestDBWithCfg(t)
	store, err := store.NewEmbeddedStore(cfg, testDB, log.NewNopLogger())
	require.NoError(t, err)
	openfga, err := NewOpenFGA(&cfg.Zanzana, store, log.NewNopLogger())
	require.NoError(t, err)

	// 1. create new store we can use in test
	s, err := store.CreateStore(context.Background(), &openfgav1.Store{
		Id:   storeID,
		Name: "stacks-1",
	})
	require.NoError(t, err)

	model, err := schema.TransformModulesToModel(schema.SchemaModules)
	require.NoError(t, err)
	model.Id = modelID

	// 2. create our authorization model
	require.NoError(t, store.WriteAuthorizationModel(context.Background(), s.Id, model))

	// 3. seed tuples
	_, err = openfga.Write(context.Background(), &openfgav1.WriteRequest{
		StoreId:              storeID,
		AuthorizationModelId: modelID,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys: []*openfgav1.TupleKey{
				newResourceTuple("user:1", "read", dashboardGroup, dashboardResource, "1"),
				newGroupResourceTuple("user:2", "read", dashboardGroup, dashboardResource),
				newResourceTuple("user:3", "view", dashboardGroup, dashboardResource, "1"),
				newFolderTuple("user:4", "read", "1"),
				newFolderTuple("user:5", "view", "1"),
			},
		},
	})
	require.NoError(t, err)

	return NewAuthz(openfga)
}

func newResourceTuple(subject, relation, group, resource, name string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   newResourceIdent(group, resource, name),
		Condition: &openfgav1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"resource_group": structpb.NewStringValue(group),
				},
			},
		},
	}
}

func newGroupResourceTuple(subject, relation, group, resource string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   newGroupResourceIdent(group, resource),
	}
}

func newFolderTuple(subject, relation, name string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   newTypedIdent("folder2", name),
	}
}
