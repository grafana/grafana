package dashverimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	maxVersionsToDeletePerBatch = 100
	maxVersionDeletionBatches   = 50
)

type Service struct {
	store store
}

func ProvideService(db db.DB) dashver.Service {
	return &Service{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
		},
	}
}

func (s *Service) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	version, err := s.store.Get(ctx, query)
	if err != nil {
		return nil, err
	}
	version.Data.Set("id", version.DashboardID)
	return version, nil
}

func (s *Service) DeleteExpired(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand) error {
	versionsToKeep := setting.DashboardVersionsToKeep
	if versionsToKeep < 1 {
		versionsToKeep = 1
	}

	for batch := 0; batch < maxVersionDeletionBatches; batch++ {
		versionIdsToDelete, batchErr := s.store.GetBatch(ctx, cmd, maxVersionsToDeletePerBatch, versionsToKeep)
		if batchErr != nil {
			return batchErr
		}

		if len(versionIdsToDelete) < 1 {
			return nil
		}

		deleted, err := s.store.DeleteBatch(ctx, cmd, versionIdsToDelete)
		if err != nil {
			return err
		}

		cmd.DeletedRows += deleted

		if deleted < int64(maxVersionsToDeletePerBatch) {
			break
		}
	}
	return nil
}

// List all dashboard versions for the given dashboard ID.
func (s *Service) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersionDTO, error) {
	if query.Limit == 0 {
		query.Limit = 1000
	}
	return s.store.List(ctx, query)
}
