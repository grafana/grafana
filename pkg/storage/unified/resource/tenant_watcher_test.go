package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"

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

		tw.handleTenant(t.Context(), tenant)

		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.Equal(t, "2026-03-01T00:00:00Z", record.DeleteAfter)
		assert.True(t, record.LabelingComplete, "labeling should be marked complete")
	})

	t.Run("does not overwrite existing complete record", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z")
		tw.handleTenant(t.Context(), tenant)

		// Overwrite with a different deleteAfter so we can detect an overwrite.
		err := tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter:      "2099-01-01T00:00:00Z",
			LabelingComplete: true,
		})
		require.NoError(t, err)

		// Handle the same tenant again — should be a no-op because the record is complete.
		tw.handleTenant(t.Context(), tenant)

		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.Equal(t, "2099-01-01T00:00:00Z", record.DeleteAfter, "existing complete record should not be overwritten")
	})

	t.Run("skips when missing delete-after annotation", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := &unstructured.Unstructured{}
		tenant.SetName("tenant-1")
		tenant.SetLabels(map[string]string{labelPendingDelete: "true"})

		tw.handleTenant(t.Context(), tenant)

		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.ErrorIs(t, err, ErrNotFound)
	})
}

func TestTenantClearPendingDelete(t *testing.T) {
	t.Run("removes record when tenant is no longer pending delete", func(t *testing.T) {
		tw := newTestTenantWatcher(t)

		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))
		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)

		restored := &unstructured.Unstructured{}
		restored.SetName("tenant-1")
		tw.handleTenant(t.Context(), restored)

		_, err = tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("no-op when tenant has no pending delete record", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := &unstructured.Unstructured{}
		tenant.SetName("tenant-1")

		tw.handleTenant(t.Context(), tenant)

		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("orphaned record persists through reconcile and clear events", func(t *testing.T) {
		tw := newTestTenantWatcher(t)

		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
			Orphaned:         true,
		}))

		// Reconcile path: tenant CRD says pending-delete.
		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.True(t, record.Orphaned)

		// Clear path: tenant CRD says active.
		restored := &unstructured.Unstructured{}
		restored.SetName("tenant-1")
		tw.handleTenant(t.Context(), restored)

		record, err = tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.True(t, record.Orphaned)
		assert.True(t, record.LabelingComplete)
	})
}

func TestTenantResourceLabelling(t *testing.T) {
	t.Run("adds pending-delete label to all tenant resources", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)
		collector := &writeEventCollector{}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         collector.append,
			stopCh:             make(chan struct{}),
		}

		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash2", 101, nil)
		saveTestResource(t, ds, "tenant-2", "apps", "dashboards", "other", 102, nil)

		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

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
		ds := newDataStore(setupBadgerKV(t), nil)
		collector := &writeEventCollector{}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         collector.append,
			stopCh:             make(chan struct{}),
		}

		// Seed resources already labelled as pending-delete.
		pendingLabels := map[string]string{labelPendingDelete: "true"}
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, pendingLabels)

		// Create the pending-delete record (with LabelingComplete=true) so the
		// cache knows about it and clearTenantPendingDelete exercises the full path.
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
		}))

		// Now "restore" the tenant (no pending-delete label).
		restored := &unstructured.Unstructured{}
		restored.SetName("tenant-1")
		tw.handleTenant(t.Context(), restored)

		events := collector.all()
		require.Len(t, events, 1)

		evt := events[0]
		assert.Equal(t, "dash1", evt.Key.Name)
		assert.Equal(t, resourcepb.WatchEvent_MODIFIED, evt.Type)
		_, hasPendingDelete := evt.Object.GetLabels()[labelPendingDelete]
		assert.False(t, hasPendingDelete, "pending-delete label should be removed")
	})

	t.Run("record exists with LabelingComplete=false when labelling fails", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)
		failingWriter := func(_ context.Context, _ *WriteEvent) (int64, error) {
			return 0, fmt.Errorf("simulated write failure")
		}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         failingWriter,
			stopCh:             make(chan struct{}),
		}

		saveTestResource(t, ds, "tenant-1", "apps", "deployments", "deploy-a", 100, nil)

		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err, "record should exist even when labelling fails")
		assert.False(t, record.LabelingComplete, "labeling should not be marked complete")
	})

	t.Run("does not delete record if unlabelling fails", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)
		failingWriter := func(_ context.Context, _ *WriteEvent) (int64, error) {
			return 0, fmt.Errorf("simulated write failure")
		}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         failingWriter,
			stopCh:             make(chan struct{}),
		}

		// Seed a labelled resource and an existing pending-delete record.
		saveTestResource(t, ds, "tenant-1", "apps", "deployments", "deploy-a", 100, map[string]string{labelPendingDelete: "true"})
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
		}))

		// "Restore" the tenant — unlabelling will fail.
		restored := &unstructured.Unstructured{}
		restored.SetName("tenant-1")
		tw.handleTenant(t.Context(), restored)

		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.NoError(t, err, "record should not be deleted when unlabelling fails")
	})

	t.Run("skips resources that already have the correct label state", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)
		collector := &writeEventCollector{}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         collector.append,
			stopCh:             make(chan struct{}),
		}

		// Resource already has the pending-delete label.
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "already-labelled", 100, map[string]string{labelPendingDelete: "true"})

		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		assert.Empty(t, collector.all(), "should not write events for already-labelled resources")
	})

	t.Run("conflict error during labelling succeeds when latest version already has label", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)

		// Save the resource at RV 100 without the label (this is what the stale dataKey will read).
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
		// Save a newer version at RV 200 WITH the label (simulating another pod having already labelled it).
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 200, map[string]string{labelPendingDelete: "true"})

		conflictWriter := func(_ context.Context, _ *WriteEvent) (int64, error) {
			return 0, apierrors.NewConflict(schema.GroupResource{
				Group: "apps", Resource: "dashboards",
			}, "dash1", fmt.Errorf("resource version does not match current value"))
		}

		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         conflictWriter,
			stopCh:             make(chan struct{}),
		}

		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		// The latest version already has the label, so doEditResourceLabel
		// detects the no-op and the operation succeeds without writing.
		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err, "pending delete record should be created despite conflict error")
	})

	t.Run("conflict error during labelling fails when latest version does not have label", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)

		// Save the resource at RV 100 without the label.
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
		// Save a newer version at RV 200 also without the label (e.g., an unrelated modification).
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 200, nil)

		conflictWriter := func(_ context.Context, _ *WriteEvent) (int64, error) {
			return 0, apierrors.NewConflict(schema.GroupResource{
				Group: "apps", Resource: "dashboards",
			}, "dash1", fmt.Errorf("resource version does not match current value"))
		}

		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         conflictWriter,
			stopCh:             make(chan struct{}),
			retryMaxDelay:      time.Millisecond,
		}

		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		// All retry attempts are exhausted (conflicts every time), so the
		// intent record exists but with LabelingComplete=false.
		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err, "intent record should exist")
		assert.False(t, record.LabelingComplete, "labeling should not be marked complete")
	})

	t.Run("retry succeeds after transient conflict", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)

		callCount := 0
		conflictThenSucceed := func(_ context.Context, event *WriteEvent) (int64, error) {
			callCount++
			if callCount == 1 {
				return 0, apierrors.NewConflict(schema.GroupResource{
					Group: "apps", Resource: "dashboards",
				}, "dash1", fmt.Errorf("resource version does not match current value"))
			}
			return 1, nil
		}

		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         conflictThenSucceed,
			stopCh:             make(chan struct{}),
			retryMaxDelay:      time.Millisecond,
		}

		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.True(t, record.LabelingComplete, "labeling should succeed after retry")
		assert.Equal(t, 2, callCount, "writeEvent should be called exactly twice")
	})

	t.Run("context cancellation stops retry on conflict", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)

		ctx, cancel := context.WithCancel(t.Context())
		conflictAndCancel := func(_ context.Context, _ *WriteEvent) (int64, error) {
			cancel()
			return 0, apierrors.NewConflict(schema.GroupResource{
				Group: "apps", Resource: "dashboards",
			}, "dash1", fmt.Errorf("resource version does not match current value"))
		}

		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         conflictAndCancel,
			stopCh:             make(chan struct{}),
			retryMaxDelay:      time.Millisecond,
		}

		dataKey := DataKey{
			Group: "apps", Resource: "dashboards",
			Namespace: "tenant-1", Name: "dash1",
			ResourceVersion: 100, Action: DataActionCreated,
		}
		err := tw.editResourceLabel(ctx, dataKey, true)
		assert.ErrorIs(t, err, context.Canceled)
	})

	t.Run("partial labelling failure followed by tenant unmark cleans up orphaned labels", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)
		collector := &writeEventCollector{}

		// Two resources: the writer will fail on the second one.
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash2", 101, nil)

		callCount := 0
		failOnSecond := func(ctx context.Context, event *WriteEvent) (int64, error) {
			callCount++
			if callCount == 1 {
				// First resource succeeds — simulate by collecting the event.
				return collector.append(ctx, event)
			}
			return 0, fmt.Errorf("simulated failure on second resource")
		}

		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         failOnSecond,
			stopCh:             make(chan struct{}),
		}

		// Step 1: Attempt to mark pending-delete — will partially fail.
		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		// Record should exist with LabelingComplete=false.
		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.False(t, record.LabelingComplete)

		// Step 2: Tenant is unmarked (restored) — should clean up the orphaned labels.
		// Switch to a working writer for the unlabelling.
		unlabelCollector := &writeEventCollector{}
		tw.writeEvent = unlabelCollector.append

		restored := &unstructured.Unstructured{}
		restored.SetName("tenant-1")
		tw.handleTenant(t.Context(), restored)

		// The record should be deleted.
		_, err = tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		assert.ErrorIs(t, err, ErrNotFound, "record should be deleted after clearing")
	})

	t.Run("incomplete record is retried on next event", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)

		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)

		callCount := 0
		failFirst := func(ctx context.Context, event *WriteEvent) (int64, error) {
			callCount++
			if callCount == 1 {
				return 0, fmt.Errorf("simulated failure")
			}
			return 1, nil
		}

		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         failFirst,
			stopCh:             make(chan struct{}),
		}

		// First attempt: labelling fails, record stays incomplete.
		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))
		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.False(t, record.LabelingComplete)

		// Second attempt: labelling succeeds, record is marked complete.
		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))
		record, err = tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.True(t, record.LabelingComplete, "record should be complete after retry")
	})

	t.Run("orphaned record prevents unlabelling during clear", func(t *testing.T) {
		ds := newDataStore(setupBadgerKV(t), nil)
		collector := &writeEventCollector{}
		tw := &TenantWatcher{
			log:                log.NewNopLogger(),
			pendingDeleteStore: newPendingDeleteStore(ds.kv),
			dataStore:          ds,
			writeEvent:         collector.append,
			stopCh:             make(chan struct{}),
		}

		pendingLabels := map[string]string{labelPendingDelete: "true"}
		saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, pendingLabels)

		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
			Orphaned:         true,
		}))

		restored := &unstructured.Unstructured{}
		restored.SetName("tenant-1")
		tw.handleTenant(t.Context(), restored)

		assert.Empty(t, collector.all(), "no unlabelling should occur for orphaned records")
	})

	t.Run("reconcile preserves Orphaned field on incomplete record", func(t *testing.T) {
		tw := newTestTenantWatcher(t)

		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: false,
			Orphaned:         true,
		}))

		tw.handleTenant(t.Context(), pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))

		record, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.True(t, record.Orphaned, "Orphaned field should be preserved after reconcile")
		assert.True(t, record.LabelingComplete, "labeling should be marked complete")
	})
}

func TestRunPollCycle(t *testing.T) {
	t.Run("reconciles pending-delete tenants and creates records", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		collector := &writeEventCollector{}
		tw.writeEvent = collector.append
		// Seed resources for tenant-1 so the reconcile actually has something to label.
		saveTestResource(t, tw.dataStore, "tenant-1", "apps", "dashboards", "dash1", 100, nil)

		tw.client = newFakeTenantClient(t,
			pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"),
			pendingDeleteTenant("tenant-2", "2026-03-01T00:00:00Z"),
		)

		tw.runPollCycle(t.Context())

		r1, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.Equal(t, "2026-03-01T00:00:00Z", r1.DeleteAfter)
		assert.True(t, r1.LabelingComplete, "tenant-1 should be marked labeling complete")

		r2, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-2")
		require.NoError(t, err)
		assert.True(t, r2.LabelingComplete, "tenant-2 should be marked labeling complete")
	})

	t.Run("fast-paths already-reconciled tenants with no write events", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		collector := &writeEventCollector{}
		tw.writeEvent = collector.append
		saveTestResource(t, tw.dataStore, "tenant-1", "apps", "dashboards", "dash1", 100, map[string]string{labelPendingDelete: "true"})

		// Pre-seed a record with DeleteAfter that differs from the tenant's
		// annotation. If the fast path fires, the record is untouched. If the
		// slow path runs, it overwrites DeleteAfter with the annotation value.
		// This lets us distinguish fast-vs-slow by record state alone (the
		// final LabelingComplete=true is the same in both paths).
		original := PendingDeleteRecord{
			DeleteAfter:      "2099-12-31T00:00:00Z",
			LabelingComplete: true,
		}
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", original))

		tw.client = newFakeTenantClient(t, pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z"))
		tw.runPollCycle(t.Context())

		after, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err)
		assert.Equal(t, "2099-12-31T00:00:00Z", after.DeleteAfter,
			"fast path must not overwrite DeleteAfter with tenant's annotation")
		assert.Empty(t, collector.all(), "fast path should not produce write events")
	})

	t.Run("stale record with tenant still present clears (label removed)", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		collector := &writeEventCollector{}
		tw.writeEvent = collector.append
		saveTestResource(t, tw.dataStore, "tenant-restored", "apps", "dashboards", "dash1", 100, map[string]string{labelPendingDelete: "true"})

		// Stale KV record + unlabeled tenant in the fake client (keeps liveNames
		// non-empty via tenant-active). GET returns the unlabeled tenant, so we
		// take the clear branch.
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-restored", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
		}))

		unlabeled := &unstructured.Unstructured{}
		unlabeled.SetName("tenant-restored")
		tw.client = newFakeTenantClient(t,
			pendingDeleteTenant("tenant-active", "2026-03-01T00:00:00Z"),
			unlabeled,
		)

		tw.runPollCycle(t.Context())

		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-restored")
		assert.ErrorIs(t, err, ErrNotFound, "restored tenant's record should be cleared")

		// Clear must also unlabel the tenant's resources. Without this
		// assertion, a broken clearTenantPendingDelete that removed the KV
		// record without touching resources would pass.
		events := collector.all()
		require.Len(t, events, 1, "exactly one unlabel write event expected")
		assert.Equal(t, "tenant-restored", events[0].Key.Namespace)
		assert.Equal(t, "dash1", events[0].Key.Name)
		assert.NotEqual(t, "true", events[0].Object.GetLabels()[labelPendingDelete],
			"pending-delete label should have been removed")
	})

	t.Run("stale record with tenant NotFound preserves record for deleter", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		collector := &writeEventCollector{}
		tw.writeEvent = collector.append

		// KV record exists but tenant is completely gone from the tenant API.
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-deleted", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
		}))

		// Seed one labeled tenant so the sweep isn't empty; tenant-deleted is absent.
		tw.client = newFakeTenantClient(t,
			pendingDeleteTenant("tenant-active", "2026-03-01T00:00:00Z"),
		)

		tw.runPollCycle(t.Context())

		r, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-deleted")
		require.NoError(t, err, "KV record should be preserved for the deleter")
		assert.True(t, r.LabelingComplete)
	})

	t.Run("empty live set skips clear phase to avoid wiping records", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		saveTestResource(t, tw.dataStore, "tenant-1", "apps", "dashboards", "dash1", 100, map[string]string{labelPendingDelete: "true"})

		// Pre-seed a record that would otherwise be considered stale.
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
		}))

		// Seed the tenant in the fake client WITHOUT the pending-delete label.
		// The label selector excludes it from LIST → liveNames is empty. But if
		// the zero-live-tenants guard were removed, the clear phase would GET
		// tenant-1, find it without the label, and incorrectly clear the record.
		unlabeled := &unstructured.Unstructured{}
		unlabeled.SetName("tenant-1")
		tw.client = newFakeTenantClient(t, unlabeled)
		tw.runPollCycle(t.Context())

		_, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-1")
		require.NoError(t, err, "zero-live-tenants should skip clear phase, record preserved")
	})

	t.Run("LIST error mid-sweep aborts cycle without clearing records", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		saveTestResource(t, tw.dataStore, "tenant-stale", "apps", "dashboards", "dash1", 100, map[string]string{labelPendingDelete: "true"})

		// Pre-seed a record. In the fake client, seed the tenant WITHOUT the
		// label so the clear phase (if it ran) would GET tenant-stale, find it
		// unlabeled, and clear the record. This distinguishes the LIST-abort
		// guard from the zero-live-tenants guard: the two-page scenario ensures
		// liveNames is non-empty after page 1, so empty-guard can't save us.
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-stale", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
		}))

		unlabeled := &unstructured.Unstructured{}
		unlabeled.SetName("tenant-stale")
		fake := newFakeTenantClient(t, unlabeled)

		var listCalls int
		fake.PrependReactor("list", "tenants", func(k8stesting.Action) (bool, runtime.Object, error) {
			listCalls++
			if listCalls == 1 {
				// Page 1: return an active labeled tenant AND a continue token
				// to force a second page.
				page := &unstructured.UnstructuredList{}
				page.SetGroupVersionKind(tenantGVR.GroupVersion().WithKind("TenantList"))
				page.SetContinue("continue-token")
				page.Items = []unstructured.Unstructured{*pendingDeleteTenant("tenant-active", "2026-03-01T00:00:00Z")}
				return true, page, nil
			}
			// Page 2: error — mid-sweep LIST failure.
			return true, nil, errors.New("tenant API unavailable mid-sweep")
		})
		tw.client = fake

		tw.runPollCycle(t.Context())

		r, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-stale")
		require.NoError(t, err, "mid-sweep LIST error should skip clear phase, record preserved")
		assert.True(t, r.LabelingComplete)
	})

	t.Run("GET transient error preserves record for next cycle", func(t *testing.T) {
		tw := newTestTenantWatcher(t)

		// KV record that will look stale (absent from liveNames).
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-stale", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
		}))

		// One labeled tenant so liveNames is non-empty and clear phase runs.
		fake := newFakeTenantClient(t, pendingDeleteTenant("tenant-active", "2026-03-01T00:00:00Z"))
		fake.PrependReactor("get", "tenants", func(action k8stesting.Action) (bool, runtime.Object, error) {
			if ga, ok := action.(k8stesting.GetAction); ok && ga.GetName() == "tenant-stale" {
				return true, nil, errors.New("tenant API timeout")
			}
			return false, nil, nil
		})
		tw.client = fake

		tw.runPollCycle(t.Context())

		r, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-stale")
		require.NoError(t, err, "transient GET error should preserve record")
		assert.True(t, r.LabelingComplete)
	})

	t.Run("race: label re-added between LIST and GET skips clearing", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		collector := &writeEventCollector{}
		tw.writeEvent = collector.append

		// KV record exists for tenant-raced.
		require.NoError(t, tw.pendingDeleteStore.Upsert(t.Context(), "tenant-raced", PendingDeleteRecord{
			DeleteAfter:      "2026-03-01T00:00:00Z",
			LabelingComplete: true,
		}))

		// Fake client knows about both tenants (both labeled). Use a List reactor
		// to hide tenant-raced from the LIST response, simulating a race where it
		// got the label after the LIST snapshot.
		fake := newFakeTenantClient(t,
			pendingDeleteTenant("tenant-active", "2026-03-01T00:00:00Z"),
			pendingDeleteTenant("tenant-raced", "2026-03-01T00:00:00Z"),
		)
		fake.PrependReactor("list", "tenants", func(k8stesting.Action) (bool, runtime.Object, error) {
			list := &unstructured.UnstructuredList{}
			list.SetGroupVersionKind(tenantGVR.GroupVersion().WithKind("TenantList"))
			list.Items = []unstructured.Unstructured{*pendingDeleteTenant("tenant-active", "2026-03-01T00:00:00Z")}
			return true, list, nil
		})
		tw.client = fake

		tw.runPollCycle(t.Context())

		r, err := tw.pendingDeleteStore.Get(t.Context(), "tenant-raced")
		require.NoError(t, err, "raced record must be preserved")
		assert.True(t, r.LabelingComplete)
		assert.Empty(t, collector.all(), "no unlabel writes for raced tenant")
	})
}

// newFakeTenantClient builds a fake dynamic client seeded with the given
// unstructured tenants. The fake client applies label selectors on LIST and
// supports GET by name, which is all runPollCycle needs.
func newFakeTenantClient(t *testing.T, tenants ...*unstructured.Unstructured) *dynamicfake.FakeDynamicClient {
	t.Helper()
	scheme := runtime.NewScheme()
	scheme.AddKnownTypeWithName(tenantGVR.GroupVersion().WithKind("Tenant"), &unstructured.Unstructured{})
	scheme.AddKnownTypeWithName(tenantGVR.GroupVersion().WithKind("TenantList"), &unstructured.UnstructuredList{})

	objs := make([]runtime.Object, 0, len(tenants))
	for _, tenant := range tenants {
		tenant.GetObjectKind().SetGroupVersionKind(tenantGVR.GroupVersion().WithKind("Tenant"))
		objs = append(objs, tenant)
	}
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
		tenantGVR: "TenantList",
	}, objs...)
}

func newTestTenantWatcher(t *testing.T) *TenantWatcher {
	t.Helper()
	ds := newDataStore(setupBadgerKV(t), nil)
	return &TenantWatcher{
		log:                log.NewNopLogger(),
		pendingDeleteStore: newPendingDeleteStore(ds.kv),
		dataStore:          ds,
		writeEvent: func(_ context.Context, _ *WriteEvent) (int64, error) {
			return 0, nil
		},
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
