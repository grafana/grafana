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
	"github.com/grafana/grafana/pkg/services/gcom"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testGcomVerifier implements gcom.Service for tests. Default behavior: instance not in GCOM.
type testGcomVerifier struct {
	getInstance func(ctx context.Context, requestID, instanceID string) (gcom.Instance, error)
}

func (v *testGcomVerifier) GetInstanceByID(ctx context.Context, requestID, instanceID string) (gcom.Instance, error) {
	if v.getInstance != nil {
		return v.getInstance(ctx, requestID, instanceID)
	}
	return gcom.Instance{}, fmt.Errorf("instance not found")
}

func (v *testGcomVerifier) GetPlugins(ctx context.Context, requestID string) (map[string]gcom.Plugin, error) {
	return map[string]gcom.Plugin{}, nil
}

// testStacksNS1 and testStacksNS2 are authlib-parseable cloud namespaces (StackID > 0).
const (
	testStacksNS1 = "stacks-1"
	testStacksNS2 = "stacks-2"
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
	ds := newDataStore(kv, nil)
	pds := newPendingDeleteStore(kv)
	cfg := TenantDeleterConfig{
		DryRun:   dryRun,
		Interval: time.Hour,
		Log:      log.NewNopLogger(),
		Gcom: &testGcomVerifier{
			getInstance: func(ctx context.Context, requestID, instanceID string) (gcom.Instance, error) {
				if instanceID == "1" {
					return gcom.Instance{ID: 1, Slug: "test", Status: "deleted"}, nil
				}
				return gcom.Instance{}, fmt.Errorf("instance not found")
			},
		},
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

// TestRunDeletionPass_SkipsAlreadyDeleted verifies that a tenant with DeletedAt
// set is not processed again.
func TestRunDeletionPass_SkipsAlreadyDeleted(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)

	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter: pastTime(),
		DeletedAt:   pastTime(),
	}))

	td.runDeletionPass(t.Context())

	// Data should still be present because the record was already marked deleted.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 1, count, "resource should still exist for already-deleted record")
}

// TestRunDeletionPass_SkipsNotExpired verifies that a tenant with a future
// deletion time is not deleted.
func TestRunDeletionPass_SkipsNotExpired(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)

	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter: futureTime(),
	}))

	td.runDeletionPass(t.Context())

	// Data should still be present.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
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
	_, err := pds.Get(t.Context(), testStacksNS1)
	assert.NoError(t, err)
}

// TestRunDeletionPass_DeletesExpired verifies that all resource keys for an
// expired tenant are removed, and the pending-delete record is marked with DeletedAt.
func TestRunDeletionPass_DeletesExpired(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash2", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	td.runDeletionPass(t.Context())

	// All data keys for the expired tenant should be gone.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
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

	// Pending delete record should have DeletedAt set.
	record, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err)
	assert.NotEmpty(t, record.DeletedAt, "DeletedAt should be set after successful deletion")
}

// TestRunDeletionPass_PreservesOtherTenants verifies that only the expired
// tenant's data is removed, leaving other tenants' data intact.
func TestRunDeletionPass_PreservesOtherTenants(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	// First tenant is expired; second is not.
	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, testStacksNS2, "apps", "dashboards", "dash2", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))
	require.NoError(t, pds.Upsert(t.Context(), testStacksNS2, PendingDeleteRecord{
		DeleteAfter: futureTime(),
	}))

	td.runDeletionPass(t.Context())

	// First tenant's data gone.
	listKey1 := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
	prefix1 := listKey1.Prefix()
	var count1 int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix1,
		EndKey:   PrefixRangeEnd(prefix1),
	}) {
		require.NoError(t, err)
		count1++
	}
	assert.Equal(t, 0, count1, "first tenant resources should have been deleted")

	// Second tenant's data intact.
	listKey2 := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS2}
	prefix2 := listKey2.Prefix()
	var count2 int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix2,
		EndKey:   PrefixRangeEnd(prefix2),
	}) {
		require.NoError(t, err)
		count2++
	}
	assert.Equal(t, 1, count2, "second tenant resources should remain")

	// First tenant's pending delete record should have DeletedAt set; second tenant's record should not.
	record, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err)
	assert.NotEmpty(t, record.DeletedAt, "DeletedAt should be set for deleted tenant")

	record2, err := pds.Get(t.Context(), testStacksNS2)
	require.NoError(t, err)
	assert.Empty(t, record2.DeletedAt, "DeletedAt should not be set for non-expired tenant")
}

// TestRunDeletionPass_DryRun verifies that dry-run mode does not delete any
// data or remove the pending-delete record.
func TestRunDeletionPass_DryRun(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, true /* dryRun */)

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)

	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	td.runDeletionPass(t.Context())

	// Data should still be present.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
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

	// Pending delete record should still exist without DeletedAt.
	record, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err)
	assert.Empty(t, record.DeletedAt, "DeletedAt should not be set in dry-run mode")
}

// TestRunDeletionPass_NoDataSetsDeletedAt verifies that an expired tenant
// with no resource data still has its pending-delete record marked with DeletedAt.
func TestRunDeletionPass_NoDataSetsDeletedAt(t *testing.T) {
	td, _, pds := newTestTenantDeleter(t, false)

	// No resources saved — only a pending-delete record.
	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	td.runDeletionPass(t.Context())

	// Pending delete record should have DeletedAt set.
	record, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err)
	assert.NotEmpty(t, record.DeletedAt, "DeletedAt should be set after successful deletion")
}

// TestRunDeletionPass_IdempotentRerun verifies that running a deletion pass
// twice is safe — the second pass skips the already-deleted tenant.
func TestRunDeletionPass_IdempotentRerun(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash2", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	// First pass deletes everything and sets DeletedAt.
	td.runDeletionPass(t.Context())

	record, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err)
	require.NotEmpty(t, record.DeletedAt)

	// Second pass should be a no-op (record has DeletedAt).
	td.runDeletionPass(t.Context())

	// Verify data is still gone.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
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

	ds := newDataStore(faultyKV, nil)
	pds := newPendingDeleteStore(realKV)
	cfg := TenantDeleterConfig{
		DryRun:   false,
		Interval: time.Hour,
		Log:      log.NewNopLogger(),
		Gcom: &testGcomVerifier{
			getInstance: func(ctx context.Context, requestID, instanceID string) (gcom.Instance, error) {
				if instanceID == "1" {
					return gcom.Instance{ID: 1, Slug: "test", Status: "deleted"}, nil
				}
				return gcom.Instance{}, fmt.Errorf("instance not found")
			},
		},
	}
	td := NewTenantDeleter(ds, pds, cfg)

	// Create data across two group/resources.
	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, testStacksNS1, "core", "pods", "pod1", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	// First pass: BatchDelete #1 (dashboards) succeeds, #2 (pods) fails.
	td.runDeletionPass(t.Context())

	// Dashboards should be deleted.
	dashPrefix := (&ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}).Prefix()
	var dashCount int
	for _, err := range realKV.Keys(t.Context(), dataSection, ListOptions{
		StartKey: dashPrefix, EndKey: PrefixRangeEnd(dashPrefix),
	}) {
		require.NoError(t, err)
		dashCount++
	}
	assert.Equal(t, 0, dashCount, "dashboards should have been deleted in the first pass")

	// Pods should still exist (BatchDelete failed for this group).
	podPrefix := (&ListRequestKey{Group: "core", Resource: "pods", Namespace: testStacksNS1}).Prefix()
	var podCount int
	for _, err := range realKV.Keys(t.Context(), dataSection, ListOptions{
		StartKey: podPrefix, EndKey: PrefixRangeEnd(podPrefix),
	}) {
		require.NoError(t, err)
		podCount++
	}
	assert.Equal(t, 1, podCount, "pods should survive the failed first pass")

	// Pending-delete record must still exist without DeletedAt (deleteTenant returned an error).
	record, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err, "pending-delete record should survive after partial failure")
	assert.Empty(t, record.DeletedAt, "DeletedAt should not be set after partial failure")

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

	record, err = pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err, "pending-delete record should still exist after retry")
	assert.NotEmpty(t, record.DeletedAt, "DeletedAt should be set after successful retry")
}

// TestRunDeletionPass_DataWithoutPendingRecord verifies that tenant data is
// untouched when there is no pending-delete record for that tenant.
func TestRunDeletionPass_DataWithoutPendingRecord(t *testing.T) {
	td, ds, _ := newTestTenantDeleter(t, false)

	// Save data but do NOT create a pending-delete record.
	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)

	td.runDeletionPass(t.Context())

	// Data should be untouched.
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
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

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
	saveTestResource(t, ds, testStacksNS1, "core", "pods", "pod1", 101, nil)

	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter: pastTime(),
	}))

	groupResources, err := ds.getGroupResources(t.Context())
	require.NoError(t, err)

	err = td.deleteTenant(t.Context(), testStacksNS1, groupResources)
	require.NoError(t, err)

	// Both group/resource pairs should be gone.
	for _, gr := range []struct{ group, resource string }{
		{"apps", "dashboards"},
		{"core", "pods"},
	} {
		listKey := ListRequestKey{Group: gr.group, Resource: gr.resource, Namespace: testStacksNS1}
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

	// Pending delete record should have DeletedAt set.
	record, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err)
	assert.NotEmpty(t, record.DeletedAt, "DeletedAt should be set after successful deletion")
}

// TestRunDeletionPass_DeletesExpiredOrphanedRecord verifies that the deleter
// removes both tenant data and the pending-delete record for orphaned tenants.
func TestRunDeletionPass_DeletesExpiredOrphanedRecord(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)

	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{
		DeleteAfter:      pastTime(),
		LabelingComplete: true,
		Orphaned:         true,
	}))

	td.runDeletionPass(t.Context())

	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 0, count, "orphaned record resources should be deleted when expired")

	// Orphaned records are removed entirely after cleanup.
	_, err := pds.Get(t.Context(), testStacksNS1)
	assert.Error(t, err, "orphaned pending-delete record should be removed after cleanup")
}

// TestRunDeletionPass_AllowsWhenGcomReturnsDeletedStatus verifies local deletion when
// GCOM returns HTTP 200 with status "deleted".
func TestRunDeletionPass_AllowsWhenGcomReturnsDeletedStatus(t *testing.T) {
	kv := setupBadgerKV(t)
	ds := newDataStore(kv, nil)
	pds := newPendingDeleteStore(kv)
	td := NewTenantDeleter(ds, pds, TenantDeleterConfig{
		DryRun:   false,
		Interval: time.Hour,
		Log:      log.NewNopLogger(),
		Gcom: &testGcomVerifier{
			getInstance: func(_ context.Context, _, instanceID string) (gcom.Instance, error) {
				require.Equal(t, "1", instanceID)
				return gcom.Instance{ID: 1, Slug: "test", Status: "deleted"}, nil
			},
		},
	})

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{DeleteAfter: pastTime()}))

	td.runDeletionPass(t.Context())

	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 0, count)

	record, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err)
	assert.NotEmpty(t, record.DeletedAt, "DeletedAt should be set after successful deletion")
}

// TestRunDeletionPass_SkipsWhenGcomInstanceStillExists verifies that local data is
// not removed while GCOM still returns the stack instance.
func TestRunDeletionPass_SkipsWhenGcomInstanceStillExists(t *testing.T) {
	kv := setupBadgerKV(t)
	ds := newDataStore(kv, nil)
	pds := newPendingDeleteStore(kv)
	td := NewTenantDeleter(ds, pds, TenantDeleterConfig{
		DryRun:   false,
		Interval: time.Hour,
		Log:      log.NewNopLogger(),
		Gcom: &testGcomVerifier{
			getInstance: func(_ context.Context, _, instanceID string) (gcom.Instance, error) {
				require.Equal(t, "1", instanceID)
				return gcom.Instance{ID: 42, Slug: "active-stack", Status: "active"}, nil
			},
		},
	})

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{DeleteAfter: pastTime()}))

	td.runDeletionPass(t.Context())

	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 1, count, "resources must remain while GCOM still has the instance")

	_, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err, "pending-delete record must remain")
}

// TestRunDeletionPass_SkipsWhenGcomCheckFails verifies that a non-404 GCOM error
// does not delete local data (fail-safe on outage or permission errors).
func TestRunDeletionPass_SkipsWhenGcomCheckFails(t *testing.T) {
	kv := setupBadgerKV(t)
	ds := newDataStore(kv, nil)
	pds := newPendingDeleteStore(kv)
	td := NewTenantDeleter(ds, pds, TenantDeleterConfig{
		DryRun:   false,
		Interval: time.Hour,
		Log:      log.NewNopLogger(),
		Gcom: &testGcomVerifier{
			getInstance: func(_ context.Context, _, instanceID string) (gcom.Instance, error) {
				require.Equal(t, "1", instanceID)
				return gcom.Instance{}, fmt.Errorf("injected GCOM transport error")
			},
		},
	})

	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{DeleteAfter: pastTime()}))

	td.runDeletionPass(t.Context())

	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: testStacksNS1}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 1, count)

	_, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err)
}

// TestRunDeletionPass_SkipsWhenNamespaceHasNoStackID verifies non-cloud namespaces
// do not call GCOM and do not delete local data.
func TestRunDeletionPass_SkipsWhenNamespaceHasNoStackID(t *testing.T) {
	kv := setupBadgerKV(t)
	ds := newDataStore(kv, nil)
	pds := newPendingDeleteStore(kv)
	called := false
	td := NewTenantDeleter(ds, pds, TenantDeleterConfig{
		DryRun:   false,
		Interval: time.Hour,
		Log:      log.NewNopLogger(),
		Gcom: &testGcomVerifier{
			getInstance: func(_ context.Context, _, _ string) (gcom.Instance, error) {
				called = true
				return gcom.Instance{}, fmt.Errorf("instance not found")
			},
		},
	})

	const orgStyleNS = "org-999"
	saveTestResource(t, ds, orgStyleNS, "apps", "dashboards", "dash1", 100, nil)
	require.NoError(t, pds.Upsert(t.Context(), orgStyleNS, PendingDeleteRecord{DeleteAfter: pastTime()}))

	td.runDeletionPass(t.Context())

	require.False(t, called, "GCOM should not be called without a resolvable stack id")
	listKey := ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: orgStyleNS}
	prefix := listKey.Prefix()
	var count int
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		count++
	}
	assert.Equal(t, 1, count)
	_, err := pds.Get(t.Context(), orgStyleNS)
	require.NoError(t, err)
}
