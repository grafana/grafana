package server

import (
	"context"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"

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

func TestServer(t *testing.T) {
	srv := setup(t)

	t.Run("test check", func(t *testing.T) {
		testCheck(t, srv)
	})

	t.Run("test list", func(t *testing.T) {
		testList(t, srv)
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
				newNamespaceResourceTuple("user:2", "read", dashboardGroup, dashboardResource),
				newResourceTuple("user:3", "view", dashboardGroup, dashboardResource, "1"),
				newFolderResourceTuple("user:4", "read", dashboardGroup, dashboardResource, "1"),
				newFolderResourceTuple("user:4", "read", dashboardGroup, dashboardResource, "3"),
				newFolderResourceTuple("user:5", "view", dashboardGroup, dashboardResource, "1"),
				newFolderTuple("user:6", "read", "1"),
			},
		},
	})
	require.NoError(t, err)

	srv, err := NewAuthz(openfga)
	require.NoError(t, err)
	return srv
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
					"resource_group": structpb.NewStringValue(formatGroupResource(group, resource)),
				},
			},
		},
	}
}

func newFolderResourceTuple(subject, relation, group, resource, folder string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   newFolderResourceIdent(group, resource, folder),
		Condition: &openfgav1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"resource_group": structpb.NewStringValue(formatGroupResource(group, resource)),
				},
			},
		},
	}
}

func newNamespaceResourceTuple(subject, relation, group, resource string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   newNamespaceResourceIdent(group, resource),
	}
}

func newFolderTuple(subject, relation, name string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   newTypedIdent("folder2", name),
	}
}
