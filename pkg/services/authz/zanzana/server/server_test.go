package server

import (
	"context"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

const (
	namespace = "default"

	dashboardGroup    = "dashboard.grafana.app"
	dashboardResource = "dashboards"

	folderGroup    = "folder.grafana.app"
	folderResource = "folders"

	statusSubresource = "status"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testDB, cfg := db.InitTestDBWithCfg(t)
	// Hack to skip these tests on mysql 5.7
	if testDB.GetDialect().DriverName() == migrator.MySQL {
		if supported, err := testDB.RecursiveQueriesAreSupported(); !supported || err != nil {
			t.Skip("skipping integration test")
		}
	}

	srv := setup(t, testDB, cfg)
	t.Run("test check", func(t *testing.T) {
		testCheck(t, srv)
	})

	t.Run("test list", func(t *testing.T) {
		testList(t, srv)
	})

	t.Run("test batch check", func(t *testing.T) {
		testBatchCheck(t, srv)
	})
}

func setup(t *testing.T, testDB db.DB, cfg *setting.Cfg) *Server {
	t.Helper()
	store, err := store.NewEmbeddedStore(cfg, testDB, log.NewNopLogger())
	require.NoError(t, err)
	openfga, err := NewOpenFGA(&cfg.Zanzana, store, log.NewNopLogger())
	require.NoError(t, err)

	srv, err := NewAuthz(cfg, openfga)
	require.NoError(t, err)

	storeInf, err := srv.getStoreInfo(context.Background(), namespace)
	require.NoError(t, err)

	// seed tuples
	_, err = openfga.Write(context.Background(), &openfgav1.WriteRequest{
		StoreId:              storeInf.ID,
		AuthorizationModelId: storeInf.ModelID,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys: []*openfgav1.TupleKey{
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
				common.NewFolderParentTuple("5", "4"),
				common.NewFolderParentTuple("6", "5"),
				common.NewFolderResourceTuple("user:8", common.RelationSetEdit, dashboardGroup, dashboardResource, "", "5"),
				common.NewFolderResourceTuple("user:9", common.RelationCreate, dashboardGroup, dashboardResource, "", "5"),
				common.NewResourceTuple("user:10", common.RelationGet, dashboardGroup, dashboardResource, statusSubresource, "10"),
				common.NewResourceTuple("user:10", common.RelationGet, dashboardGroup, dashboardResource, statusSubresource, "11"),
				common.NewGroupResourceTuple("user:11", common.RelationGet, dashboardGroup, dashboardResource, statusSubresource),
				common.NewFolderResourceTuple("user:12", common.RelationGet, dashboardGroup, dashboardResource, statusSubresource, "5"),
			},
		},
	})
	require.NoError(t, err)
	return srv
}
