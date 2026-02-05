package dashboard

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/require"
)

func TestDashboardFolderRegistrar(t *testing.T) {
	t.Run("registers folders-dashboards migration", func(t *testing.T) {
		accessor := &mockDashboardAccessor{}
		registrar := NewDashboardFolderRegistrar(accessor)
		registry := migrations.NewMigrationRegistry()

		registrar.RegisterMigrations(registry)

		def, ok := registry.Get("folders-dashboards")
		require.True(t, ok)
		require.Len(t, def.Resources, 2)
		require.Len(t, def.Migrators, 2)
		require.Len(t, def.Validators, 3)

		validators := def.CreateValidators(nil, "sqlite3")
		require.Len(t, validators, 3)
	})
}

type mockDashboardAccessor struct{}

func (m *mockDashboardAccessor) CountResources(_ context.Context, _ legacy.MigrateOptions) (*resourcepb.BulkResponse, error) {
	return nil, nil
}

func (m *mockDashboardAccessor) MigrateDashboards(_ context.Context, _ int64, _ legacy.MigrateOptions, _ resourcepb.BulkStore_BulkProcessClient) error {
	return nil
}

func (m *mockDashboardAccessor) MigrateFolders(_ context.Context, _ int64, _ legacy.MigrateOptions, _ resourcepb.BulkStore_BulkProcessClient) error {
	return nil
}
