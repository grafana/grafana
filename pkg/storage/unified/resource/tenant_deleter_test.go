package resource

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestTenantDeleter(t *testing.T, dryRun bool) (*TenantDeleter, *dataStore, *PendingDeleteStore) {
	t.Helper()
	kv := setupBadgerKV(t)
	ds := newDataStore(kv)
	pds := newPendingDeleteStore(kv)
	cfg := TenantDeleterConfig{
		Enabled:  true,
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
