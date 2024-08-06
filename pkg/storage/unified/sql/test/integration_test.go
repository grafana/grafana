package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func newServer(t *testing.T) (sql.Backend, resource.ResourceServer) {
	t.Helper()

	dbstore := infraDB.InitTestDB(t)
	cfg := setting.NewCfg()
	features := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorage)
	tr := noop.NewTracerProvider().Tracer("integrationtests")

	eDB, err := dbimpl.ProvideResourceDB(dbstore, cfg, features, tr)
	require.NoError(t, err)
	require.NotNil(t, eDB)

	ret, err := sql.NewBackend(sql.BackendOptions{
		DBProvider: eDB,
		Tracer:     tr,
	})
	require.NoError(t, err)
	require.NotNil(t, ret)

	err = ret.Init(testutil.NewDefaultTestContext(t))
	require.NoError(t, err)

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:     ret,
		Diagnostics: ret,
		Lifecycle:   ret,
	})
	require.NoError(t, err)
	require.NotNil(t, server)

	return ret, server
}

func TestIntegrationBackendHappyPath(t *testing.T) {
	t.Skip("TODO: test blocking, skipping to unblock Enterprise until we fix this")
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testUserA := &identity.StaticRequester{
		Type:           identity.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // can do anything
	}
	ctx := identity.WithRequester(context.Background(), testUserA)
	backend, server := newServer(t)

	stream, err := backend.WatchWriteEvents(context.Background()) // Using a different context to avoid canceling the stream after the DefaultContextTimeout
	require.NoError(t, err)

	t.Run("Add 3 resources", func(t *testing.T) {
		rv, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
		require.NoError(t, err)
		require.Equal(t, int64(1), rv)

		rv, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED)
		require.NoError(t, err)
		require.Equal(t, int64(2), rv)

		rv, err = writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED)
		require.NoError(t, err)
		require.Equal(t, int64(3), rv)
	})

	t.Run("Update item2", func(t *testing.T) {
		rv, err := writeEvent(ctx, backend, "item2", resource.WatchEvent_MODIFIED)
		require.NoError(t, err)
		require.Equal(t, int64(4), rv)
	})

	t.Run("Delete item1", func(t *testing.T) {
		rv, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_DELETED)
		require.NoError(t, err)
		require.Equal(t, int64(5), rv)
	})

	t.Run("Read latest item 2", func(t *testing.T) {
		resp := backend.ReadResource(ctx, &resource.ReadRequest{Key: resourceKey("item2")})
		require.Nil(t, resp.Error)
		require.Equal(t, int64(4), resp.ResourceVersion)
		require.Equal(t, "item2 MODIFIED", string(resp.Value))
	})

	t.Run("Read early version of item2", func(t *testing.T) {
		resp := backend.ReadResource(ctx, &resource.ReadRequest{
			Key:             resourceKey("item2"),
			ResourceVersion: 3, // item2 was created at rv=2 and updated at rv=4
		})
		require.Nil(t, resp.Error)
		require.Equal(t, int64(2), resp.ResourceVersion)
		require.Equal(t, "item2 ADDED", string(resp.Value))
	})

	t.Run("PrepareList latest", func(t *testing.T) {
		resp, err := server.List(ctx, &resource.ListRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, resp.Error)
		require.Len(t, resp.Items, 2)
		require.Equal(t, "item2 MODIFIED", string(resp.Items[0].Value))
		require.Equal(t, "item3 ADDED", string(resp.Items[1].Value))
		require.Equal(t, int64(5), resp.ResourceVersion)
	})

	t.Run("Watch events", func(t *testing.T) {
		event := <-stream
		require.Equal(t, "item1", event.Key.Name)
		require.Equal(t, int64(1), event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_ADDED, event.Type)
		event = <-stream
		require.Equal(t, "item2", event.Key.Name)
		require.Equal(t, int64(2), event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_ADDED, event.Type)

		event = <-stream
		require.Equal(t, "item3", event.Key.Name)
		require.Equal(t, int64(3), event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_ADDED, event.Type)

		event = <-stream
		require.Equal(t, "item2", event.Key.Name)
		require.Equal(t, int64(4), event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_MODIFIED, event.Type)

		event = <-stream
		require.Equal(t, "item1", event.Key.Name)
		require.Equal(t, int64(5), event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_DELETED, event.Type)
	})
}

func TestIntegrationBackendWatchWriteEventsFromLastest(t *testing.T) {
	t.Skip("TODO: test blocking, skipping to unblock Enterprise until we fix this")
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	backend, _ := newServer(t)

	// Create a few resources before initing the watch
	_, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
	require.NoError(t, err)

	// Start the watch
	stream, err := backend.WatchWriteEvents(ctx)
	require.NoError(t, err)

	// Create one more event
	_, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Equal(t, "item2", (<-stream).Key.Name)
}

func TestIntegrationBackendList(t *testing.T) {
	t.Skip("TODO: test blocking, skipping to unblock Enterprise until we fix this")
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	backend, server := newServer(t)

	// Create a few resources before starting the watch
	_, _ = writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)    // rv=1
	_, _ = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED)    // rv=2 - will be modified at rv=6
	_, _ = writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED)    // rv=3 - will be deleted  at rv=7
	_, _ = writeEvent(ctx, backend, "item4", resource.WatchEvent_ADDED)    // rv=4
	_, _ = writeEvent(ctx, backend, "item5", resource.WatchEvent_ADDED)    // rv=5
	_, _ = writeEvent(ctx, backend, "item2", resource.WatchEvent_MODIFIED) // rv=6
	_, _ = writeEvent(ctx, backend, "item3", resource.WatchEvent_DELETED)  // rv=7
	_, _ = writeEvent(ctx, backend, "item6", resource.WatchEvent_ADDED)    // rv=8
	t.Run("fetch all latest", func(t *testing.T) {
		res, err := server.List(ctx, &resource.ListRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 5)
		// should be sorted by key ASC
		require.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item2 MODIFIED", string(res.Items[1].Value))
		require.Equal(t, "item4 ADDED", string(res.Items[2].Value))
		require.Equal(t, "item5 ADDED", string(res.Items[3].Value))
		require.Equal(t, "item6 ADDED", string(res.Items[4].Value))

		require.Empty(t, res.NextPageToken)
	})

	t.Run("list latest first page ", func(t *testing.T) {
		res, err := server.List(ctx, &resource.ListRequest{
			Limit: 3,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 3)
		continueToken, err := sql.GetContinueToken(res.NextPageToken)
		require.NoError(t, err)
		require.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item2 MODIFIED", string(res.Items[1].Value))
		require.Equal(t, "item4 ADDED", string(res.Items[2].Value))
		require.Equal(t, int64(8), continueToken.ResourceVersion)
	})

	t.Run("list at revision", func(t *testing.T) {
		res, err := server.List(ctx, &resource.ListRequest{
			ResourceVersion: 4,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 4)
		require.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item2 ADDED", string(res.Items[1].Value))
		require.Equal(t, "item3 ADDED", string(res.Items[2].Value))
		require.Equal(t, "item4 ADDED", string(res.Items[3].Value))
		require.Empty(t, res.NextPageToken)
	})

	t.Run("fetch first page at revision with limit", func(t *testing.T) {
		res, err := server.List(ctx, &resource.ListRequest{
			Limit:           3,
			ResourceVersion: 7,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 3)
		t.Log(res.Items)
		require.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item2 MODIFIED", string(res.Items[1].Value))
		require.Equal(t, "item4 ADDED", string(res.Items[2].Value))

		continueToken, err := sql.GetContinueToken(res.NextPageToken)
		require.NoError(t, err)
		require.Equal(t, int64(7), continueToken.ResourceVersion)
	})

	t.Run("fetch second page at revision", func(t *testing.T) {
		continueToken := &sql.ContinueToken{
			ResourceVersion: 8,
			StartOffset:     2,
		}
		res, err := server.List(ctx, &resource.ListRequest{
			NextPageToken: continueToken.String(),
			Limit:         2,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 2)
		t.Log(res.Items)
		require.Equal(t, "item4 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item5 ADDED", string(res.Items[1].Value))

		continueToken, err = sql.GetContinueToken(res.NextPageToken)
		require.NoError(t, err)
		require.Equal(t, int64(8), continueToken.ResourceVersion)
		require.Equal(t, int64(4), continueToken.StartOffset)
	})
}
func TestClientServer(t *testing.T) {
	t.Skip("TODO: test blocking, skipping to unblock Enterprise until we fix this")
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	dbstore := infraDB.InitTestDB(t)

	cfg := setting.NewCfg()
	cfg.GRPCServerAddress = "localhost:0"
	cfg.GRPCServerNetwork = "tcp"

	features := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorage)

	svc, err := sql.ProvideService(cfg, features, dbstore, nil)
	require.NoError(t, err)
	var client resource.ResourceStoreClient

	// Test with an admin identity
	clientCtx := identity.WithRequester(ctx, &identity.StaticRequester{
		Type:           identity.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // can do anything
	})

	t.Run("Start and stop service", func(t *testing.T) {
		err = services.StartAndAwaitRunning(ctx, svc)
		require.NoError(t, err)
		require.NotEmpty(t, svc.GetAddress())
	})

	t.Run("Create a client", func(t *testing.T) {
		conn, err := grpc.NewClient(svc.GetAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
		require.NoError(t, err)
		client = resource.NewResourceStoreClientGRPC(conn)
	})

	t.Run("Create a resource", func(t *testing.T) {
		raw := []byte(`{
			"apiVersion": "group/v0alpha1",
			"kind": "resource",
			"metadata": {
				"name": "item1",
				"namespace": "namespace"
			},
			"spec": {}
		}`)
		resp, err := client.Create(clientCtx, &resource.CreateRequest{
			Key:   resourceKey("item1"),
			Value: raw,
		})
		require.NoError(t, err)
		require.Empty(t, resp.Error)
		require.Greater(t, resp.ResourceVersion, int64(0))
	})

	t.Run("Read the resource", func(t *testing.T) {
		resp, err := client.Read(clientCtx, &resource.ReadRequest{
			Key: resourceKey("item1"),
		})
		require.NoError(t, err)
		require.Empty(t, resp.Error)
		require.Greater(t, resp.ResourceVersion, int64(0))
	})

	t.Run("Stop the service", func(t *testing.T) {
		err = services.StopAndAwaitTerminated(ctx, svc)
		require.NoError(t, err)
	})
}

func writeEvent(ctx context.Context, store sql.Backend, name string, action resource.WatchEvent_Type) (int64, error) {
	return store.WriteEvent(ctx, resource.WriteEvent{
		Type:  action,
		Value: []byte(name + " " + resource.WatchEvent_Type_name[int32(action)]),
		Key: &resource.ResourceKey{
			Namespace: "namespace",
			Group:     "group",
			Resource:  "resource",
			Name:      name,
		},
	})
}

func resourceKey(name string) *resource.ResourceKey {
	return &resource.ResourceKey{
		Namespace: "namespace",
		Group:     "group",
		Resource:  "resource",
		Name:      name,
	}
}
