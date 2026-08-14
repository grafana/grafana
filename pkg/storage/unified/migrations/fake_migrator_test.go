package migrations

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// fakeUnifiedMigrator is a hand-written test double for UnifiedMigrator.
type fakeUnifiedMigrator struct {
	migrateResponse *resourcepb.BulkResponse
	migrateErr      error
	migrateCalled   int

	rebuildErr    error
	rebuildCalled int
}

func (f *fakeUnifiedMigrator) Migrate(_ context.Context, _ MigrateOptions) (*resourcepb.BulkResponse, error) {
	f.migrateCalled++
	return f.migrateResponse, f.migrateErr
}

func (f *fakeUnifiedMigrator) RebuildIndexes(_ context.Context, _ RebuildIndexOptions) error {
	f.rebuildCalled++
	return f.rebuildErr
}
