package sql

import (
	"context"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/zeebo/assert"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestBackendCRUDLW(t *testing.T) {
	ctx := context.Background()
	dbstore := db.InitTestDB(t)

	rdb, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorage), nil)
	assert.NoError(t, err)
	store, err := NewBackendStore(backendOptions{
		DB: rdb,
	})

	assert.NoError(t, err)
	assert.NotNil(t, store)

	stream, err := store.WatchWriteEvents(ctx)
	assert.NoError(t, err)

	t.Run("WriteEvent Add 3 objects", func(t *testing.T) {
		for i := 1; i <= 3; i++ {
			rv, err := store.WriteEvent(ctx, resource.WriteEvent{
				Type:  resource.WatchEvent_ADDED,
				Value: []byte("initial value"),
				Key: &resource.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
					Name:      "item" + strconv.Itoa(i),
				},
			})
			assert.NoError(t, err)
			assert.Equal(t, int64(i), rv)
		}
	})

	t.Run("WriteEvent Update item2", func(t *testing.T) {
		rv, err := store.WriteEvent(ctx, resource.WriteEvent{
			Type:  resource.WatchEvent_MODIFIED,
			Value: []byte("updated value"),
			Key: &resource.ResourceKey{
				Namespace: "namespace",
				Group:     "group",
				Resource:  "resource",
				Name:      "item2",
			},
		})
		assert.NoError(t, err)
		assert.Equal(t, int64(4), rv)
	})

	t.Run("WriteEvent Delete item1", func(t *testing.T) {
		rv, err := store.WriteEvent(ctx, resource.WriteEvent{
			Type: resource.WatchEvent_DELETED,
			Key: &resource.ResourceKey{
				Namespace: "namespace",
				Group:     "group",
				Resource:  "resource",
				Name:      "item1",
			},
		})
		assert.NoError(t, err)
		assert.Equal(t, int64(5), rv)
	})

	t.Run("Read latest", func(t *testing.T) {
		resp, err := store.Read(ctx, &resource.ReadRequest{
			Key: &resource.ResourceKey{
				Namespace: "namespace",
				Group:     "group",
				Resource:  "resource",
				Name:      "item2",
			},
		})
		assert.NoError(t, err)
		assert.Equal(t, int64(4), resp.ResourceVersion)
		assert.Equal(t, "updated value", string(resp.Value))
	})

	t.Run("Read early verions", func(t *testing.T) {
		resp, err := store.Read(ctx, &resource.ReadRequest{
			Key: &resource.ResourceKey{
				Namespace: "namespace",
				Group:     "group",
				Resource:  "resource",
				Name:      "item2",
			},
			ResourceVersion: 3, // item2 was created at rv=2 and updated at rv=4
		})
		assert.NoError(t, err)
		assert.Equal(t, int64(2), resp.ResourceVersion)
		assert.Equal(t, "initial value", string(resp.Value))
	})

	t.Run("Watch events", func(t *testing.T) {
		event := <-stream
		assert.Equal(t, "item1", event.Key.Name)
		assert.Equal(t, 1, event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_ADDED, event.Type)
		event = <-stream
		assert.Equal(t, "item2", event.Key.Name)
		assert.Equal(t, 2, event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_ADDED, event.Type)

		event = <-stream
		assert.Equal(t, "item3", event.Key.Name)
		assert.Equal(t, 3, event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_ADDED, event.Type)

		event = <-stream
		assert.Equal(t, "item2", event.Key.Name)
		assert.Equal(t, 4, event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_MODIFIED, event.Type)

		event = <-stream
		assert.Equal(t, "item1", event.Key.Name)
		assert.Equal(t, 5, event.ResourceVersion)
		assert.Equal(t, resource.WatchEvent_DELETED, event.Type)
	})
}
