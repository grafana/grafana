package dashverimpl

import (
	"context"

	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
}

func ProvideService(db db.DB) dashver.Service {
	return &Service{
		store: &sqlStore{
			db: db,
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

const MAX_VERSIONS_TO_DELETE_PER_BATCH = 100
const MAX_VERSION_DELETION_BATCHES = 50

func (s *Service) DeleteExpired(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand) error {
	maxBatches := MAX_VERSION_DELETION_BATCHES
	perBatch := MAX_VERSIONS_TO_DELETE_PER_BATCH
	versionsToKeep := setting.DashboardVersionsToKeep
	if versionsToKeep < 1 {
		versionsToKeep = 1
	}

	for batch := 0; batch < maxBatches; batch++ {
		versionIdsToDelete, batchErr := s.store.GetBatch(ctx, cmd, perBatch, versionsToKeep)
		if batchErr != nil {
			return batchErr
		}

		if len(versionIdsToDelete) < 1 {
			return nil
		}

		deleted, err := s.store.Delete(ctx, cmd, versionIdsToDelete)
		if err != nil {
			return err
		}

		cmd.DeletedRows += deleted

		if deleted < int64(perBatch) {
			break
		}
	}

	return nil
}
