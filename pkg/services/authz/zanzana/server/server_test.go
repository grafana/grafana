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
	dashboardGroup    = "dashboard.grafana.app"
	dashboardResource = "dashboards"

	folderGroup    = "folder.grafana.app"
	folderResource = "folders"
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
}

func setup(t *testing.T, testDB db.DB, cfg *setting.Cfg) *Server {
	t.Helper()
	store, err := store.NewEmbeddedStore(cfg, testDB, log.NewNopLogger())
	require.NoError(t, err)
	openfga, err := NewOpenFGA(&cfg.Zanzana, store, log.NewNopLogger())
	require.NoError(t, err)

	srv, err := NewAuthz(openfga)
	require.NoError(t, err)

	namespace := "default"
	storeInf, err := srv.initNamespaceStore(context.Background(), namespace)
	require.NoError(t, err)

	// seed tuples
	_, err = openfga.Write(context.Background(), &openfgav1.WriteRequest{
		StoreId:              storeInf.Id,
		AuthorizationModelId: storeInf.AuthorizationModelId,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys: []*openfgav1.TupleKey{
				common.NewResourceTuple("user:1", "read", dashboardGroup, dashboardResource, "1"),
				common.NewNamespaceResourceTuple("user:2", "read", dashboardGroup, dashboardResource),
				common.NewResourceTuple("user:3", "view", dashboardGroup, dashboardResource, "1"),
				common.NewFolderResourceTuple("user:4", "read", dashboardGroup, dashboardResource, "1"),
				common.NewFolderResourceTuple("user:4", "read", dashboardGroup, dashboardResource, "3"),
				common.NewFolderResourceTuple("user:5", "view", dashboardGroup, dashboardResource, "1"),
				common.NewFolderTuple("user:6", "read", "1"),
				common.NewNamespaceResourceTuple("user:7", "read", folderGroup, folderResource),
				common.NewFolderParentTuple("5", "4"),
				common.NewFolderParentTuple("6", "5"),
				common.NewFolderResourceTuple("user:8", "view", dashboardGroup, dashboardResource, "5"),
			},
		},
	})
	require.NoError(t, err)
	return srv
}
