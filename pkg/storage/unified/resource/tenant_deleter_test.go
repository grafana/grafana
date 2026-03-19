package resource

import (
	"context"
	"fmt"
	"io"
	"iter"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// failOnceBatchDeleteKV wraps a KV and makes BatchDelete fail on the Nth call,
// then succeed on all subsequent calls. This simulates a transient failure
// partway through a deletion pass.
type failOnceBatchDeleteKV struct {
	KV
	batchDeleteCalls atomic.Int32
	failOnCall       int32
}

func (f *failOnceBatchDeleteKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	call := f.batchDeleteCalls.Add(1)
	if call == f.failOnCall {
		return fmt.Errorf("injected BatchDelete failure")
	}
	return f.KV.BatchDelete(ctx, section, keys)
}

// Delegate all other methods to the wrapped KV.
func (f *failOnceBatchDeleteKV) Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error] {
	return f.KV.Keys(ctx, section, opt)
}
func (f *failOnceBatchDeleteKV) Get(ctx context.Context, section string, key string) (io.ReadCloser, error) {
	return f.KV.Get(ctx, section, key)
}
func (f *failOnceBatchDeleteKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[KeyValue, error] {
	return f.KV.BatchGet(ctx, section, keys)
}
func (f *failOnceBatchDeleteKV) Save(ctx context.Context, section string, key string) (io.WriteCloser, error) {
	return f.KV.Save(ctx, section, key)
}
func (f *failOnceBatchDeleteKV) Delete(ctx context.Context, section string, key string) error {
	return f.KV.Delete(ctx, section, key)
}
func (f *failOnceBatchDeleteKV) UnixTimestamp(ctx context.Context) (int64, error) {
	return f.KV.UnixTimestamp(ctx)
}
func (f *failOnceBatchDeleteKV) Batch(ctx context.Context, section string, ops []BatchOp) error {
	return f.KV.Batch(ctx, section, ops)
}

func newTestTenantDeleter(t *testing.T, dryRun bool) (*TenantDeleter, *dataStore, *PendingDeleteStore) {
	t.Helper()
	kv := setupBadgerKV(t)
	ds := newDataStore(kv)
	pds := newPendingDeleteStore(kv)
	cfg := TenantDeleterConfig{
		DryRun:   dryRun,
		Interval: time.Hour,
		Log:      log.NewNopLogger(),
	}
	td := NewTenantDeleter(ds, pds, cfg)
	return td, ds, pds
}

func pastTime() string {
	return time.Now().UTC().Add(-1 * time.Hour).Format(time.RFC3339)
}

func futureTime() string {
	return time.Now().UTC().Add(1 * time.Hour).Format(time.RFC3339)
}

// TestRunDeletionPass_SkipsNotExpired verifies that a tenant with a future
// deletion time is not deleted.
func TestRunDeletionPass_SkipsNotExpired(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)

	require.NoError(t, pds.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
		DeleteAfter: futureTime(),
	}))

	td.runDeletionPass(t.Context())

	// Data should still be present.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: "tenant-1"}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 1, count, "resource should still exist for non-expired tenant")

	// Pending delete record should still be there.
	_, err := pds.Get(t.Context(), "tenant-1")
	assert.NoError(t, err)
}

// TestRunDeletionPass_DeletesExpired verifies that all resource keys for an
// expired tenant are removed, and the pending-delete record is also removed.
func TestRunDeletionPass_DeletesExpired(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash2", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	td.runDeletionPass(t.Context())

	// All data keys for tenant-1 should be gone.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: "tenant-1"}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 0, count, "resources should have been deleted for expired tenant")

	// Pending delete record should be gone.
	_, err := pds.Get(t.Context(), "tenant-1")
	assert.ErrorIs(t, err, ErrNotFound)
}

// TestRunDeletionPass_PreservesOtherTenants verifies that only the expired
// tenant's data is removed, leaving other tenants' data intact.
func TestRunDeletionPass_PreservesOtherTenants(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	// tenant-1 is expired; tenant-2 is not.
	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, "tenant-2", "apps", "dashboards", "dash2", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))
	require.NoError(t, pds.Upsert(t.Context(), "tenant-2", PendingDeleteRecord{
		DeleteAfter: futureTime(),
	}))

	td.runDeletionPass(t.Context())

	// tenant-1 data gone.
	listKey1 := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: "tenant-1"}
	prefix1 := listKey1.Prefix()
	var count1 int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix1,
		EndKey:   PrefixRangeEnd(prefix1),
	}) {
		require.NoError(t, err)
		count1++
	}
	assert.Equal(t, 0, count1, "tenant-1 resources should have been deleted")

	// tenant-2 data intact.
	listKey2 := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: "tenant-2"}
	prefix2 := listKey2.Prefix()
	var count2 int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix2,
		EndKey:   PrefixRangeEnd(prefix2),
	}) {
		require.NoError(t, err)
		count2++
	}
	assert.Equal(t, 1, count2, "tenant-2 resources should remain")

	// tenant-1 pending delete record gone; tenant-2 record still exists.
	_, err := pds.Get(t.Context(), "tenant-1")
	assert.ErrorIs(t, err, ErrNotFound)

	_, err = pds.Get(t.Context(), "tenant-2")
	assert.NoError(t, err)
}

// TestRunDeletionPass_DryRun verifies that dry-run mode does not delete any
// data or remove the pending-delete record.
func TestRunDeletionPass_DryRun(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, true /* dryRun */)

	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)

	require.NoError(t, pds.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	td.runDeletionPass(t.Context())

	// Data should still be present.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: "tenant-1"}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 1, count, "data should not be deleted in dry-run mode")

	// Pending delete record should still exist.
	_, err := pds.Get(t.Context(), "tenant-1")
	assert.NoError(t, err)
}

// TestRunDeletionPass_NoDataCleansUpRecord verifies that an expired tenant
// with no resource data still has its pending-delete record removed.
func TestRunDeletionPass_NoDataCleansUpRecord(t *testing.T) {
	td, _, pds := newTestTenantDeleter(t, false)

	// No resources saved — only a pending-delete record.
	require.NoError(t, pds.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	td.runDeletionPass(t.Context())

	// Pending delete record should be removed.
	_, err := pds.Get(t.Context(), "tenant-1")
	assert.ErrorIs(t, err, ErrNotFound)
}

// TestRunDeletionPass_IdempotentRerun verifies that running a deletion pass
// twice is safe — the second pass is a no-op.
func TestRunDeletionPass_IdempotentRerun(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash2", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	// First pass deletes everything.
	td.runDeletionPass(t.Context())

	_, err := pds.Get(t.Context(), "tenant-1")
	require.ErrorIs(t, err, ErrNotFound)

	// Second pass should be a no-op (no record, no data).
	td.runDeletionPass(t.Context())

	// Verify data is still gone.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: "tenant-1"}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 0, count, "data should remain deleted after second pass")
}

// TestRunDeletionPass_IdempotentAfterPartialFailure uses a KV wrapper that
// fails BatchDelete on the first call, so the first deletion pass deletes one
// group/resource ("apps/dashboards") but fails on the second ("core/pods").
// The pending-delete record must survive. A second pass (with no more injected
// failures) should clean up the remaining data and remove the record.
func TestRunDeletionPass_IdempotentAfterPartialFailure(t *testing.T) {
	realKV := setupBadgerKV(t)
	faultyKV := &failOnceBatchDeleteKV{KV: realKV, failOnCall: 2}

	ds := newDataStore(faultyKV)
	pds := newPendingDeleteStore(realKV)
	cfg := TenantDeleterConfig{
		DryRun:   false,
		Interval: time.Hour,
		Log:      log.NewNopLogger(),
	}
	td := NewTenantDeleter(ds, pds, cfg)

	// Create data across two group/resources.
	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, "tenant-1", "core", "pods", "pod1", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	// First pass: BatchDelete #1 (dashboards) succeeds, #2 (pods) fails.
	td.runDeletionPass(t.Context())

	// Dashboards should be deleted.
	dashPrefix := (&ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: "tenant-1"}).Prefix()
	var dashCount int
	for _, err := range realKV.Keys(t.Context(), dataSection, ListOptions{
		StartKey: dashPrefix, EndKey: PrefixRangeEnd(dashPrefix),
	}) {
		require.NoError(t, err)
		dashCount++
	}
	assert.Equal(t, 0, dashCount, "dashboards should have been deleted in the first pass")

	// Pods should still exist (BatchDelete failed for this group).
	podPrefix := (&ListRequestKey{Group: "core", Resource: "pods", Namespace: "tenant-1"}).Prefix()
	var podCount int
	for _, err := range realKV.Keys(t.Context(), dataSection, ListOptions{
		StartKey: podPrefix, EndKey: PrefixRangeEnd(podPrefix),
	}) {
		require.NoError(t, err)
		podCount++
	}
	assert.Equal(t, 1, podCount, "pods should survive the failed first pass")

	// Pending-delete record must still exist (deleteTenant returned an error).
	_, err := pds.Get(t.Context(), "tenant-1")
	require.NoError(t, err, "pending-delete record should survive after partial failure")

	// Second pass: no more injected failures — should finish the job.
	td.runDeletionPass(t.Context())

	podCount = 0
	for _, err := range realKV.Keys(t.Context(), dataSection, ListOptions{
		StartKey: podPrefix, EndKey: PrefixRangeEnd(podPrefix),
	}) {
		require.NoError(t, err)
		podCount++
	}
	assert.Equal(t, 0, podCount, "pods should be deleted after retry pass")

	_, err = pds.Get(t.Context(), "tenant-1")
	assert.ErrorIs(t, err, ErrNotFound, "pending-delete record should be removed after retry")
}

// TestRunDeletionPass_DataWithoutPendingRecord verifies that tenant data is
// untouched when there is no pending-delete record for that tenant.
func TestRunDeletionPass_DataWithoutPendingRecord(t *testing.T) {
	td, ds, _ := newTestTenantDeleter(t, false)

	// Save data but do NOT create a pending-delete record.
	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)

	td.runDeletionPass(t.Context())

	// Data should be untouched.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: "tenant-1"}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 1, count, "data should not be deleted without a pending-delete record")
}

// TestDeleteTenant_MultipleGroupResources verifies that deleteTenant removes
// data across multiple group/resource pairs.
func TestDeleteTenant_MultipleGroupResources(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	saveTestResource(t, ds, "tenant-1", "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, "tenant-1", "core", "pods", "pod1", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), "tenant-1", PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	groupResources, err := ds.getGroupResources(t.Context())
	require.NoError(t, err)

	err = td.deleteTenant(t.Context(), "tenant-1", groupResources)
	require.NoError(t, err)

	// Both group/resource pairs should be gone.
	for _, gr := range []struct{ group, resource string }{
		{"apps", "dashboards"},
		{"core", "pods"},
	} {
		listKey := ListRequestKey{Group: gr.group, Resource: gr.resource, Namespace: "tenant-1"}
		prefix := listKey.Prefix()
		var count int
		for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
			StartKey: prefix,
			EndKey:   PrefixRangeEnd(prefix),
		}) {
			require.NoError(t, err)
			count++
		}
		assert.Equal(t, 0, count, "resources for %s/%s should have been deleted", gr.group, gr.resource)
	}

	// Pending delete record should also be removed.
	_, err = pds.Get(t.Context(), "tenant-1")
	assert.ErrorIs(t, err, ErrNotFound)
}
