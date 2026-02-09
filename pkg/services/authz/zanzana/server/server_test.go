package server

import (
	"context"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	namespace = "default"

	dashboardGroup    = "dashboard.grafana.app"
	dashboardResource = "dashboards"

	folderGroup    = "folder.grafana.app"
	folderResource = "folders"

	teamGroup    = "iam.grafana.app"
	teamResource = "teams"

	userGroup    = "iam.grafana.app"
	userResource = "users"

	serviceAccountGroup    = "iam.grafana.app"
	serviceAccountResource = "serviceaccounts"

	statusSubresource = "status"
)

func setup(t *testing.T, srv *Server) *Server {
	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewResourceTuple("user:1", common.RelationGet, dashboardGroup, dashboardResource, "", "1"),
		common.NewResourceTuple("user:1", common.RelationUpdate, dashboardGroup, dashboardResource, "", "1"),
		common.NewGroupResourceTuple("user:2", common.RelationGet, dashboardGroup, dashboardResource, ""),
		common.NewGroupResourceTuple("user:2", common.RelationUpdate, dashboardGroup, dashboardResource, ""),
		common.NewResourceTuple("user:3", common.RelationSetView, dashboardGroup, dashboardResource, "", "1"),
		common.NewFolderResourceTuple("user:4", common.RelationGet, dashboardGroup, dashboardResource, "", "1"),
		common.NewFolderResourceTuple("user:4", common.RelationGet, dashboardGroup, dashboardResource, "", "3"),
		common.NewFolderResourceTuple("user:5", common.RelationSetEdit, dashboardGroup, dashboardResource, "", "1"),
		common.NewFolderTuple("user:6", common.RelationGet, "1"),
		common.NewGroupResourceTuple("user:7", common.RelationGet, folderGroup, folderResource, ""),
		// folder-4 -> folder-5 -> folder-6
		common.NewFolderParentTuple("5", "4"),
		common.NewFolderParentTuple("6", "5"),
		common.NewFolderResourceTuple("user:8", common.RelationSetEdit, dashboardGroup, dashboardResource, "", "5"),
		common.NewFolderResourceTuple("user:9", common.RelationCreate, dashboardGroup, dashboardResource, "", "5"),
		common.NewResourceTuple("user:10", common.RelationGet, dashboardGroup, dashboardResource, statusSubresource, "10"),
		common.NewResourceTuple("user:10", common.RelationGet, dashboardGroup, dashboardResource, statusSubresource, "11"),
		common.NewGroupResourceTuple("user:11", common.RelationGet, dashboardGroup, dashboardResource, statusSubresource),
		common.NewFolderResourceTuple("user:12", common.RelationGet, dashboardGroup, dashboardResource, statusSubresource, "5"),
		common.NewFolderResourceTuple("user:13", common.RelationGet, folderGroup, folderResource, statusSubresource, "5"),
		common.NewTypedResourceTuple("user:14", common.RelationGet, common.TypeTeam, teamGroup, teamResource, statusSubresource, "1"),
		common.NewTypedResourceTuple("user:15", common.RelationGet, common.TypeUser, userGroup, userResource, statusSubresource, "1"),
		common.NewTypedResourceTuple("user:16", common.RelationGet, common.TypeServiceAccount, serviceAccountGroup, serviceAccountResource, statusSubresource, "1"),
		common.NewFolderTuple("user:17", common.RelationSetView, "4"),
		common.NewFolderTuple("user:18", common.RelationCreate, "general"),
		common.NewFolderResourceTuple("user:18", common.RelationCreate, dashboardGroup, dashboardResource, "", "general"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func setupOpenFGAServer(t *testing.T) *Server {
	t.Helper()

	// Create a test-specific config to avoid migration conflicts
	cfg := setting.NewCfg()

	// Use a test-specific database to avoid migration conflicts
	testStore := sqlstore.NewTestStore(t, sqlstore.WithCfg(cfg))

	// Hack to skip these tests on mysql 5.7
	if testStore.GetDialect().DriverName() == migrator.MySQL {
		if supported, err := testStore.RecursiveQueriesAreSupported(); !supported || err != nil {
			t.Skip("skipping integration test")
		}
	}

	srv, err := NewEmbeddedZanzanaServer(cfg, testStore, log.NewNopLogger(), tracing.NewNoopTracerService(), prometheus.NewRegistry())
	require.NoError(t, err)

	t.Cleanup(func() {
		srv.Close()
	})

	return srv
}

func setupOpenFGADatabase(t *testing.T, srv *Server, tuples []*openfgav1.TupleKey) *Server {
	t.Helper()

	storeInf, err := srv.getStoreInfo(context.Background(), namespace)
	require.NoError(t, err)

	// Clean up any existing store
	_, err = srv.openFGAClient.DeleteStore(context.Background(), &openfgav1.DeleteStoreRequest{
		StoreId: storeInf.ID,
	})
	require.NoError(t, err)

	// seed tuples
	writes := &openfgav1.WriteRequestWrites{
		TupleKeys:   tuples,
		OnDuplicate: "ignore",
	}

	// First, try to delete any existing tuples to avoid conflicts
	deletes := make([]*openfgav1.TupleKeyWithoutCondition, 0, len(writes.TupleKeys))
	for _, tupleKey := range writes.TupleKeys {
		deletes = append(deletes, &openfgav1.TupleKeyWithoutCondition{
			User:     tupleKey.User,
			Relation: tupleKey.Relation,
			Object:   tupleKey.Object,
		})
	}

	// Try to delete existing tuples (ignore errors if they don't exist)
	_, err = srv.openFGAClient.Write(context.Background(), &openfgav1.WriteRequest{
		StoreId:              storeInf.ID,
		AuthorizationModelId: storeInf.ModelID,
		Deletes: &openfgav1.WriteRequestDeletes{
			TupleKeys: deletes,
			OnMissing: "ignore",
		},
	})
	require.NoError(t, err)

	// Now write the new tuples
	_, err = srv.openFGAClient.Write(context.Background(), &openfgav1.WriteRequest{
		StoreId:              storeInf.ID,
		AuthorizationModelId: storeInf.ModelID,
		Writes:               writes,
	})
	require.NoError(t, err)
	return srv
}

func newContextWithNamespace() context.Context {
	return newContextWithNamespaceAndPermissions()
}

func newContextWithNamespaceAndPermissions(perms ...string) context.Context {
	ctx := context.Background()
	ctx = claims.WithAuthInfo(ctx, authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
		Rest: authnlib.AccessTokenClaims{
			Namespace:            "*",
			Permissions:          perms,
			DelegatedPermissions: perms,
		},
	}))
	return ctx
}

func newContextWithZanzanaUpdatePermission() context.Context {
	return newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUpdate)
}
