package resource

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/gcom"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewTenantDeleterConfig_ClusterSlug(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.EnableTenantDeleter = true
	cfg.UnifiedStorageClusterSlug = "prod-us-central-0"

	deleterCfg := NewTenantDeleterConfig(cfg)
	require.NotNil(t, deleterCfg)
	assert.Equal(t, cfg.UnifiedStorageClusterSlug, deleterCfg.ClusterSlug)
}

func TestGcomAllowsTenantDeletion_ClusterSlug(t *testing.T) {
	const local = "prod-us-central-0"
	const remote = "prod-us-east-0"
	for _, tt := range []struct {
		name    string
		status  string
		local   string
		remote  string
		err     error
		allowed bool
	}{
		{name: "active in same cluster", status: "active", local: local, remote: local},
		{name: "paused in same cluster", status: "paused", local: local, remote: local},
		{name: "archived in same cluster", status: "archived", local: local, remote: local},
		{name: "active in different cluster", status: "active", local: local, remote: remote, allowed: true},
		{name: "paused in different cluster", status: "paused", local: local, remote: remote, allowed: true},
		{name: "archived in different cluster", status: "archived", local: local, remote: remote, allowed: true},
		{name: "same cluster after trimming", status: "paused", local: " " + local, remote: local + "\t"},
		{name: "different clusters after trimming", status: "paused", local: " " + local, remote: remote + "\t", allowed: true},
		{name: "missing local cluster", status: "paused", remote: remote},
		{name: "whitespace local cluster", status: "paused", local: " \t", remote: remote},
		{name: "missing remote cluster", status: "paused", local: local},
		{name: "whitespace remote cluster", status: "paused", local: local, remote: " \t"},
		{name: "both clusters missing", status: "paused"},
		{name: "deleted without cluster configuration", status: "deleted", allowed: true},
		{name: "deleted in same cluster", status: "deleted", local: local, remote: local, allowed: true},
		{name: "not found without cluster configuration", err: fmt.Errorf("get instance: %w", gcom.ErrInstanceNotFound), allowed: true},
		{name: "request failure with different clusters", status: "paused", local: local, remote: remote, err: fmt.Errorf("GCOM unavailable")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			calls := 0
			td := NewTenantDeleter(nil, nil, TenantDeleterConfig{
				ClusterSlug: tt.local,
				Log:         log.NewNopLogger(),
				Gcom: &testGcomVerifier{getInstance: func(_ context.Context, _, instanceID string) (gcom.Instance, error) {
					calls++
					require.Equal(t, "1", instanceID)
					return gcom.Instance{ID: 1, Status: tt.status, ClusterSlug: tt.remote}, tt.err
				}},
			}, nil)

			assert.Equal(t, tt.allowed, td.gcomAllowsTenantDeletion(t.Context(), testStacksNS1))
			assert.Equal(t, 1, calls, "status and placement must use the same GCOM response")
		})
	}

	t.Run("missing GCOM client", func(t *testing.T) {
		td := NewTenantDeleter(nil, nil, TenantDeleterConfig{
			ClusterSlug: local,
			Log:         log.NewNopLogger(),
		}, nil)
		assert.False(t, td.gcomAllowsTenantDeletion(t.Context(), testStacksNS1))
	})
}

func TestRunDeletionPass_MigratedTenant(t *testing.T) {
	for _, tt := range []struct {
		name     string
		dryRun   bool
		orphaned bool
	}{
		{name: "cleanup completes"},
		{name: "dry run preserves data", dryRun: true},
		{name: "orphan cleanup removes pending record", orphaned: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			td, ds, pds := newTestTenantDeleter(t, tt.dryRun)
			td.cfg.ClusterSlug = "prod-us-central-0"
			calls := 0
			td.gcom = &testGcomVerifier{getInstance: func(_ context.Context, _, instanceID string) (gcom.Instance, error) {
				calls++
				require.Equal(t, "1", instanceID)
				return gcom.Instance{ID: 1, Status: "paused", ClusterSlug: "prod-us-east-0"}, nil
			}}
			embeddings := td.embeddingDeleter.(*fakeEmbeddingDeleter)
			saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
			saveTestResource(t, ds, testStacksNS2, "apps", "dashboards", "dash2", 101, nil)
			pending := PendingDeleteRecord{DeleteAfter: pastTime(), Orphaned: tt.orphaned}
			require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, pending))

			td.runDeletionPass(t.Context())

			assert.Equal(t, 1, calls)
			assert.Equal(t, 1, tenantDashboardCount(t, ds, testStacksNS2), "other tenants must be untouched")
			record, err := pds.Get(t.Context(), testStacksNS1)
			if tt.dryRun {
				require.NoError(t, err)
				assert.Equal(t, pending, record)
				assert.Equal(t, 1, tenantDashboardCount(t, ds, testStacksNS1))
				assert.Empty(t, embeddings.calls)
				return
			}

			assert.Zero(t, tenantDashboardCount(t, ds, testStacksNS1))
			assert.Equal(t, []string{testStacksNS1}, embeddings.calls)
			if tt.orphaned {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.NotEmpty(t, record.DeletedAt)
				pending.DeletedAt = record.DeletedAt
				assert.Equal(t, pending, record)
			}

			td.runDeletionPass(t.Context())
			assert.Equal(t, 1, calls, "completed cleanup must not query GCOM again")
			assert.Equal(t, []string{testStacksNS1}, embeddings.calls)
		})
	}
}

func TestRunDeletionPass_RechecksClusterAfterDryRun(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, true)
	td.cfg.ClusterSlug = "prod-us-central-0"
	remoteCluster := "prod-us-east-0"
	calls := 0
	td.gcom = &testGcomVerifier{getInstance: func(_ context.Context, _, instanceID string) (gcom.Instance, error) {
		calls++
		require.Equal(t, "1", instanceID)
		return gcom.Instance{ID: 1, Status: "paused", ClusterSlug: remoteCluster}, nil
	}}
	embeddings := td.embeddingDeleter.(*fakeEmbeddingDeleter)
	saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
	pending := PendingDeleteRecord{DeleteAfter: pastTime(), LabelingComplete: true}
	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, pending))

	td.runDeletionPass(t.Context())
	require.Equal(t, 1, calls)

	remoteCluster = td.cfg.ClusterSlug
	td.cfg.DryRun = false
	td.runDeletionPass(t.Context())

	assert.Equal(t, 2, calls, "each pass must fetch current placement")
	assert.Equal(t, 1, tenantDashboardCount(t, ds, testStacksNS1), "moving back must block deletion")
	assert.Empty(t, embeddings.calls)
	record, err := pds.Get(t.Context(), testStacksNS1)
	require.NoError(t, err)
	assert.Equal(t, pending, record)
}

func TestRunDeletionPass_MigrationStillRequiresExpiredPendingRecord(t *testing.T) {
	for _, tt := range []struct {
		name    string
		pending *PendingDeleteRecord
	}{
		{name: "no pending record"},
		{name: "future deadline", pending: &PendingDeleteRecord{DeleteAfter: futureTime()}},
		{name: "completed cleanup", pending: &PendingDeleteRecord{DeleteAfter: pastTime(), DeletedAt: pastTime()}},
		{name: "invalid deadline", pending: &PendingDeleteRecord{DeleteAfter: "invalid"}},
		{name: "missing deadline", pending: &PendingDeleteRecord{}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			td, ds, pds := newTestTenantDeleter(t, false)
			td.cfg.ClusterSlug = "prod-us-central-0"
			calls := 0
			td.gcom = &testGcomVerifier{getInstance: func(_ context.Context, _, _ string) (gcom.Instance, error) {
				calls++
				return gcom.Instance{ID: 1, Status: "paused", ClusterSlug: "prod-us-east-0"}, nil
			}}
			saveTestResource(t, ds, testStacksNS1, "apps", "dashboards", "dash1", 100, nil)
			if tt.pending != nil {
				require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, *tt.pending))
			}

			td.runDeletionPass(t.Context())

			assert.Zero(t, calls)
			assert.Equal(t, 1, tenantDashboardCount(t, ds, testStacksNS1))
			assert.Empty(t, td.embeddingDeleter.(*fakeEmbeddingDeleter).calls)
			record, err := pds.Get(t.Context(), testStacksNS1)
			if tt.pending == nil {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, *tt.pending, record)
			}
		})
	}
}

func tenantDashboardCount(t *testing.T, ds *dataStore, namespace string) int {
	t.Helper()
	prefix := (ListRequestKey{Group: "apps", Resource: "dashboards", Namespace: namespace}).Prefix()
	count := 0
	for _, err := range ds.kv.Keys(t.Context(), dataSection, ListOptions{StartKey: prefix, EndKey: PrefixRangeEnd(prefix)}) {
		require.NoError(t, err)
		count++
	}
	return count
}
