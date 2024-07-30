package client

import (
	"context"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	zserver "github.com/grafana/grafana/pkg/services/authz/zanzana/server"
	zstore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationClient(t *testing.T) {
	conn := zanzanaServerIntegrationTest(t)

	var (
		prevStoreID string
		prevModelID string
	)

	t.Run("should create default store and authorization model on first startup", func(t *testing.T) {
		c, err := New(context.Background(), conn)
		require.NoError(t, err)

		assert.NotEmpty(t, c.storeID)
		assert.NotEmpty(t, c.modelID)

		prevStoreID, prevModelID = c.storeID, c.modelID
	})

	t.Run("should reuse existing store and authorization model", func(t *testing.T) {
		c, err := New(context.Background(), conn)
		require.NoError(t, err)

		assert.Equal(t, prevStoreID, c.storeID)
		assert.Equal(t, prevModelID, c.modelID)
	})

	t.Run("should create new store and authorization model when new tenant id is used", func(t *testing.T) {
		c, err := New(context.Background(), conn, WithTenantID("new"))
		require.NoError(t, err)

		assert.NotEmpty(t, c.storeID)
		assert.NotEmpty(t, c.modelID)

		assert.NotEqual(t, prevStoreID, c.storeID)
		assert.NotEqual(t, prevModelID, c.modelID)

		prevStoreID, prevModelID = c.storeID, c.modelID
	})

	t.Run("should update authorization model if it has new changes", func(t *testing.T) {
		dsl := `
model
  schema 1.1

type user
		`
		c, err := New(context.Background(), conn, WithTenantID("new"), WithSchema(dsl))
		require.NoError(t, err)

		assert.Equal(t, prevStoreID, c.storeID)
		assert.NotEqual(t, prevModelID, c.modelID)
	})

	t.Run("should load older authorization model", func(t *testing.T) {
		c, err := New(context.Background(), conn, WithTenantID("new"))
		require.NoError(t, err)

		assert.Equal(t, prevStoreID, c.storeID)
		assert.Equal(t, prevModelID, c.modelID)
	})
}

func zanzanaServerIntegrationTest(tb testing.TB) *inprocgrpc.Channel {
	if testing.Short() {
		tb.Skip("skipping integration test")
	}

	db, cfg := db.InitTestDBWithCfg(tb)

	// Hack to skip these tests on mysql 5.7
	if db.GetDialect().DriverName() == migrator.MySQL {
		if supported, err := db.RecursiveQueriesAreSupported(); !supported || err != nil {
			tb.Skip("skipping integration test")
		}
	}

	logger := log.NewNopLogger()

	store, err := zstore.NewEmbeddedStore(cfg, db, logger)
	require.NoError(tb, err)

	srv, err := zserver.New(store, logger)
	require.NoError(tb, err)

	channel := &inprocgrpc.Channel{}
	openfgav1.RegisterOpenFGAServiceServer(channel, srv)

	return channel
}
