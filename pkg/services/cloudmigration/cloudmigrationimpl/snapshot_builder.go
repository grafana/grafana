package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

// Builder
type SnapshotBuilder interface {
	Build(ctx context.Context, user identity.Requester) ([]cloudmigration.MigrateDataRequestItem, error)
}

// Builder Impl - Enterprise
type ReportSnapshotBuilder struct {
	reportService any
}

var _ SnapshotBuilder = &ReportSnapshotBuilder{}

func (s *ReportSnapshotBuilder) Build(ctx context.Context, user identity.Requester) ([]cloudmigration.MigrateDataRequestItem, error) {
	migrationDataSlice := make([]cloudmigration.MigrateDataRequestItem, 0)

	// todo query data
	reports := make([]string, 0)

	for _, report := range reports {
		// todo append to migrationDataSlice
		_ = report
	}

	return migrationDataSlice, nil
}
