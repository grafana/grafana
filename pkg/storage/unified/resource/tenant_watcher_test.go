package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestNewTenantWatcherConfig(t *testing.T) {
	newCfg := func() *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.TenantApiServerAddress = "https://example.com/tenant-api"
		cfg.TenantWatcherAllowInsecureTLS = true

		grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
		grpcSection.Key("token").SetValue("token")
		grpcSection.Key("token_exchange_url").SetValue("https://example.com/token-exchange")

		return cfg
	}

	t.Run("returns config when all settings are present", func(t *testing.T) {
		cfg := newCfg()
		tenantWatcherCfg := NewTenantWatcherConfig(cfg)
		require.NotNil(t, tenantWatcherCfg)
		require.Equal(t, "https://example.com/tenant-api", tenantWatcherCfg.TenantAPIServerURL)
		require.Equal(t, "token", tenantWatcherCfg.Token)
		require.Equal(t, "https://example.com/token-exchange", tenantWatcherCfg.TokenExchangeURL)
		require.True(t, tenantWatcherCfg.AllowInsecure)
	})

	t.Run("returns nil when tenant api server address is missing", func(t *testing.T) {
		cfg := newCfg()
		cfg.TenantApiServerAddress = ""
		require.Nil(t, NewTenantWatcherConfig(cfg))
	})

	t.Run("returns nil when token is missing", func(t *testing.T) {
		cfg := newCfg()
		cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token").SetValue("")
		require.Nil(t, NewTenantWatcherConfig(cfg))
	})

	t.Run("returns nil when token exchange url is missing", func(t *testing.T) {
		cfg := newCfg()
		cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token_exchange_url").SetValue("")
		require.Nil(t, NewTenantWatcherConfig(cfg))
	})
}

func TestTenantAddPendingDeleted(t *testing.T) {
	t.Run("creates record with correct fields", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z")

		tw.handleTenant(tenant)

		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.Equal(t, "2026-03-01T00:00:00Z", record.DeleteAfter)
	})

	t.Run("does not overwrite existing record because it will exist in cache", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z")
		tw.handleTenant(tenant)

		// Overwrite with a different deleteAfter so we can detect an overwrite.
		err := tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter: "2099-01-01T00:00:00Z",
		})
		require.NoError(t, err)

		// Handle the same tenant again — should be a no-op because the record is in the cache
		tw.handleTenant(tenant)

		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.Equal(t, "2099-01-01T00:00:00Z", record.DeleteAfter, "existing record should not be overwritten")
	})

	t.Run("skips when missing delete-after annotation", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := &unstructured.Unstructured{}
		tenant.SetName("tenant-1")
		tenant.SetLabels(map[string]string{labelPendingDelete: "true"})

		tw.handleTenant(tenant)

		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.ErrorIs(t, err, ErrNotFound)
	})
}

func TestTenantClearPendingDelete(t *testing.T) {
	t.Run("removes record when tenant is no longer pending delete", func(t *testing.T) {
		tw := newTestTenantWatcher(t)

		tw.handleTenant(pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))
		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)

		restored := &unstructured.Unstructured{}
		restored.SetName("tenant-1")
		tw.handleTenant(restored)

		_, err = tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("no-op when tenant has no pending delete record", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := &unstructured.Unstructured{}
		tenant.SetName("tenant-1")

		tw.handleTenant(tenant)

		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.ErrorIs(t, err, ErrNotFound)
	})
}

func TestTenantResourceLabelling(t *testing.T) {
	t.Run("adds pending-delete label to all tenant resources", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t))
		collector := &writeEventCollector{}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         collector.append,
			ctx:                t.Context(),
			stopCh:             make(chan struct{}),
		}

		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash2", 101, nil)
		saveTestResource(t, ds, "tenant-2", "apps", "dashboards", "other", 102, nil)

		tw.handleTenant(pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		events := collector.all()
		require.Len(t, events, 2)

		for _, evt := range events {
			assert.Equal(t, "tenant-1", evt.Key.Namespace)
			assert.Equal(t, resourcepb.WatchEvent_MODIFIED, evt.Type)
			assert.Equal(t, "true", evt.Object.GetLabels()[labelPendingDelete])
		}

		names := map[string]bool{}
		for _, evt := range events {
			names[evt.Key.Name] = true
		}
		assert.True(t, names["dash1"])
		assert.True(t, names["dash2"])
	})

	t.Run("removes pending-delete label when tenant is restored", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t))
		collector := &writeEventCollector{}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         collector.append,
			ctx:                t.Context(),
			stopCh:             make(chan struct{}),
		}

		// Seed resources already labelled as pending-delete.
		pendingLabels := map[string]string{labelPendingDelete: "true"}
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, pendingLabels)

		// Create the pending-delete record so the cache knows about it.
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter: "2026-03-01T00:00:00Z",
		}))
		tw.pendingDeleteStore.RefreshCache(t.Context())

		// Now "restore" the tenant (no pending-delete label).
		restored := &unstructured.Unstructured{}
		restored.SetName("tenant-1")
		tw.handleTenant(restored)

		events := collector.all()
		require.Len(t, events, 1)

		evt := events[0]
		assert.Equal(t, "dash1", evt.Key.Name)
		assert.Equal(t, resourcepb.WatchEvent_MODIFIED, evt.Type)
		_, hasPendingDelete := evt.Object.GetLabels()[labelPendingDelete]
		assert.False(t, hasPendingDelete, "pending-delete label should be removed")
	})

	t.Run("does not create record if labelling fails", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t))
		failingWriter := func(_ context.Context, _ *WriteEvent) (int64, error) {
			return 0, fmt.Errorf("simulated write failure")
		}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         failingWriter,
			ctx:                t.Context(),
			stopCh:             make(chan struct{}),
		}

		saveTestResource(t, ds, "tenant-1", "apps", "deployments", "deploy-a", 100, nil)

		tw.handleTenant(pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.ErrorIs(t, err, ErrNotFound, "record should not be created when labelling fails")
	})

	t.Run("does not delete record if unlabelling fails", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t))
		failingWriter := func(_ context.Context, _ *WriteEvent) (int64, error) {
			return 0, fmt.Errorf("simulated write failure")
		}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         failingWriter,
			ctx:                t.Context(),
			stopCh:             make(chan struct{}),
		}

		// Seed a labelled resource and an existing pending-delete record.
		saveTestResource(t, ds, "tenant-1", "apps", "deployments", "deploy-a", 100, map[string]string{labelPendingDelete: "true"})
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter: "2026-03-01T00:00:00Z",
		}))
		tw.pendingDeleteStore.RefreshCache(t.Context())

		// "Restore" the tenant — unlabelling will fail.
		restored := &unstructured.Unstructured{}
		restored.SetName("tenant-1")
		tw.handleTenant(restored)

		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.NoError(t, err, "record should not be deleted when unlabelling fails")
	})

	t.Run("skips resources that already have the correct label state", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t))
		collector := &writeEventCollector{}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         collector.append,
			ctx:                t.Context(),
			stopCh:             make(chan struct{}),
		}

		// Resource already has the pending-delete label.
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "already-labelled", 100, map[string]string{labelPendingDelete: "true"})

		tw.handleTenant(pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		assert.Empty(t, collector.all(), "should not write events for already-labelled resources")
	})
}

func newTestTenantWatcher(t *testing.T) *TenantWatcher {
	t.Helper()
	ds := newDataStore(setupBadgerKV(t))
	return &TenantWatcher{
		log:                log.NewNopLogger(),
		pendingDeleteStore: newPendingDeleteStore(ds.kv),
		dataStore:          ds,
		writeEvent: func(_ context.Context, _ *WriteEvent) (int64, error) {
			return 0, nil
		},
		ctx:    t.Context(),
		stopCh: make(chan struct{}),
	}
}

func pendingDeleteTenant(name, deleteAfter string) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{}
	obj.SetName(name)
	obj.SetLabels(map[string]string{labelPendingDelete: "true"})
	obj.SetAnnotations(map[string]string{annotationPendingDeleteAfter: deleteAfter})
	return obj
}

// writeEventCollector captures WriteEvents for assertion.
type writeEventCollector struct {
	mu     sync.Mutex
	events []*WriteEvent
}

func (c *writeEventCollector) append(_ context.Context, event *WriteEvent) (int64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, event)
	return 1, nil
}

func (c *writeEventCollector) all() []*WriteEvent {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]*WriteEvent(nil), c.events...)
}

// saveTestResource stores a minimal unstructured resource in the datastore.
func saveTestResource(t *testing.T, ds *dataStore, namespace, group, resource, name string, rv int64, labels map[string]string) {
	t.Helper()
	obj := &unstructured.Unstructured{}
	obj.SetAPIVersion(group + "/v1")
	obj.SetKind("TestKind")
	obj.SetNamespace(namespace)
	obj.SetName(name)
	if labels != nil {
		obj.SetLabels(labels)
	}
	data, err := json.Marshal(obj)
	require.NoError(t, err)

	key := DataKey{
		Namespace:       namespace,
		Group:           group,
		Resource:        resource,
		Name:            name,
		ResourceVersion: rv,
		Action:          DataActionCreated,
	}
	require.NoError(t, ds.Save(t.Context(), key, bytes.NewReader(data)))
}
