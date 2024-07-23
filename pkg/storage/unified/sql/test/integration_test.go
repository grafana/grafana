package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

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

func newServer(t *testing.T) sql.Backend {
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

	return ret
}

func TestBackendHappyPath(t *testing.T) {
	// TODO: stop this from breaking enterprise builds https://drone.grafana.net/grafana/grafana-enterprise/73536/2/8
	t.Skip("test is breaking enterprise builds")

	ctx := testutil.NewDefaultTestContext(t)
	store := newServer(t)

	stream, err := store.WatchWriteEvents(ctx)
	assert.NoError(t, err)

	t.Run("Add 3 resources", func(t *testing.T) {
		rv, err := writeEvent(ctx, store, "item1", resource.WatchEvent_ADDED)
		assert.NoError(t, err)
		assert.Equal(t, int64(1), rv)

		rv, err = writeEvent(ctx, store, "item2", resource.WatchEvent_ADDED)
		assert.NoError(t, err)
		assert.Equal(t, int64(2), rv)

		rv, err = writeEvent(ctx, store, "item3", resource.WatchEvent_ADDED)
		assert.NoError(t, err)
		assert.Equal(t, int64(3), rv)
	})

	t.Run("Update item2", func(t *testing.T) {
		rv, err := writeEvent(ctx, store, "item2", resource.WatchEvent_MODIFIED)
		assert.NoError(t, err)
		assert.Equal(t, int64(4), rv)
	})

	t.Run("Delete item1", func(t *testing.T) {
		rv, err := writeEvent(ctx, store, "item1", resource.WatchEvent_DELETED)
		assert.NoError(t, err)
		assert.Equal(t, int64(5), rv)
	})

	t.Run("Read latest item 2", func(t *testing.T) {
		resp, err := store.Read(ctx, &resource.ReadRequest{Key: resourceKey("item2")})
		assert.NoError(t, err)
		assert.Equal(t, int64(4), resp.ResourceVersion)
		assert.Equal(t, "item2 MODIFIED", string(resp.Value))
	})

	t.Run("Read early verion of item2", func(t *testing.T) {
		resp, err := store.Read(ctx, &resource.ReadRequest{
			Key:             resourceKey("item2"),
			ResourceVersion: 3, // item2 was created at rv=2 and updated at rv=4
		})
		assert.NoError(t, err)
		assert.Equal(t, int64(2), resp.ResourceVersion)
		assert.Equal(t, "item2 ADDED", string(resp.Value))
	})

	t.Run("PrepareList latest", func(t *testing.T) {
		resp, err := store.PrepareList(ctx, &resource.ListRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
				},
			},
		})
		assert.NoError(t, err)
		assert.Len(t, resp.Items, 2)
		assert.Equal(t, "item2 MODIFIED", string(resp.Items[0].Value))
		assert.Equal(t, "item3 ADDED", string(resp.Items[1].Value))
		assert.Equal(t, int64(5), resp.ResourceVersion)
	})

	t.Run("Watch events", func(t *testing.T) {
		event := <-stream
		assert.Equal(t, "item1", event.Key.Name)
		assert.Equal(t, int64(1), event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_ADDED, event.Type)
		event = <-stream
		assert.Equal(t, "item2", event.Key.Name)
		assert.Equal(t, int64(2), event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_ADDED, event.Type)

		event = <-stream
		assert.Equal(t, "item3", event.Key.Name)
		assert.Equal(t, int64(3), event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_ADDED, event.Type)

		event = <-stream
		assert.Equal(t, "item2", event.Key.Name)
		assert.Equal(t, int64(4), event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_MODIFIED, event.Type)

		event = <-stream
		assert.Equal(t, "item1", event.Key.Name)
		assert.Equal(t, int64(5), event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_DELETED, event.Type)
	})
}

func TestBackendWatchWriteEventsFromLastest(t *testing.T) {
	// TODO: stop this from breaking enterprise builds https://drone.grafana.net/grafana/grafana-enterprise/73536/2/8
	t.Skip("test is breaking enterprise builds")
	ctx := testutil.NewDefaultTestContext(t)
	store := newServer(t)

	// Create a few resources before initing the watch
	_, err := writeEvent(ctx, store, "item1", resource.WatchEvent_ADDED)
	assert.NoError(t, err)

	// Start the watch
	stream, err := store.WatchWriteEvents(ctx)
	assert.NoError(t, err)

	// Create one more event
	_, err = writeEvent(ctx, store, "item2", resource.WatchEvent_ADDED)
	assert.NoError(t, err)
	assert.Equal(t, "item2", (<-stream).Key.Name)
}

func TestBackendPrepareList(t *testing.T) {
	// TODO: stop this from breaking enterprise builds https://drone.grafana.net/grafana/grafana-enterprise/73536/2/8
	t.Skip("test is breaking enterprise builds")
	ctx := testutil.NewDefaultTestContext(t)
	store := newServer(t)

	// Create a few resources before initing the watch
	_, _ = writeEvent(ctx, store, "item1", resource.WatchEvent_ADDED)    // rv=1
	_, _ = writeEvent(ctx, store, "item2", resource.WatchEvent_ADDED)    // rv=2 - will be modified at rv=6
	_, _ = writeEvent(ctx, store, "item3", resource.WatchEvent_ADDED)    // rv=3 - will be deleted at rv=7
	_, _ = writeEvent(ctx, store, "item4", resource.WatchEvent_ADDED)    // rv=4
	_, _ = writeEvent(ctx, store, "item5", resource.WatchEvent_ADDED)    // rv=5
	_, _ = writeEvent(ctx, store, "item2", resource.WatchEvent_MODIFIED) // rv=6
	_, _ = writeEvent(ctx, store, "item3", resource.WatchEvent_DELETED)  // rv=7
	_, _ = writeEvent(ctx, store, "item6", resource.WatchEvent_ADDED)    // rv=8
	t.Run("fetch all latest", func(t *testing.T) {
		res, err := store.PrepareList(ctx, &resource.ListRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 5)
		assert.Empty(t, res.NextPageToken)
	})

	t.Run("list latest first page ", func(t *testing.T) {
		res, err := store.PrepareList(ctx, &resource.ListRequest{
			Limit: 3,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 3)
		continueToken, err := sql.GetContinueToken(res.NextPageToken)
		assert.NoError(t, err)
		assert.Equal(t, int64(8), continueToken.ResourceVersion)
		assert.Equal(t, int64(3), continueToken.StartOffset)
	})

	t.Run("list at revision", func(t *testing.T) {
		res, err := store.PrepareList(ctx, &resource.ListRequest{
			ResourceVersion: 4,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 4)
		assert.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		assert.Equal(t, "item2 ADDED", string(res.Items[1].Value))
		assert.Equal(t, "item3 ADDED", string(res.Items[2].Value))
		assert.Equal(t, "item4 ADDED", string(res.Items[3].Value))
		assert.Empty(t, res.NextPageToken)
	})

	t.Run("fetch first page at revision with limit", func(t *testing.T) {
		res, err := store.PrepareList(ctx, &resource.ListRequest{
			Limit:           3,
			ResourceVersion: 7,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 3)
		assert.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		assert.Equal(t, "item4 ADDED", string(res.Items[1].Value))
		assert.Equal(t, "item5 ADDED", string(res.Items[2].Value))

		continueToken, err := sql.GetContinueToken(res.NextPageToken)
		assert.NoError(t, err)
		assert.Equal(t, int64(7), continueToken.ResourceVersion)
		assert.Equal(t, int64(3), continueToken.StartOffset)
	})

	t.Run("fetch second page at revision", func(t *testing.T) {
		continueToken := &sql.ContinueToken{
			ResourceVersion: 8,
			StartOffset:     2,
		}
		res, err := store.PrepareList(ctx, &resource.ListRequest{
			NextPageToken: continueToken.String(),
			Limit:         2,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 2)
		assert.Equal(t, "item5 ADDED", string(res.Items[0].Value))
		assert.Equal(t, "item2 MODIFIED", string(res.Items[1].Value))

		continueToken, err = sql.GetContinueToken(res.NextPageToken)
		assert.NoError(t, err)
		assert.Equal(t, int64(8), continueToken.ResourceVersion)
		assert.Equal(t, int64(4), continueToken.StartOffset)
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
