package dashverimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	maxVersionsToDeletePerBatch = 100
	maxVersionDeletionBatches   = 50
)

type Service struct {
	store   store
	dashSvc dashboards.DashboardService
}

func ProvideService(db db.DB, dashSvc dashboards.DashboardService) dashver.Service {
	return &Service{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
		},
		dashSvc: dashSvc,
	}
}

func (s *Service) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersionDTO, error) {
	version, err := s.store.Get(ctx, query)
	if err != nil {
		return nil, err
	}
	version.Data.Set("id", version.DashboardID)

	// Get the DashboardUID
	dashIdQuery := models.GetDashboardRefByIdQuery{Id: query.DashboardID}
	err = s.dashSvc.GetDashboardUIDById(ctx, &dashIdQuery)
	if err != nil {
		return nil, err
	}

	return version.ToDTO(dashIdQuery.Result.Uid), nil
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

// List all dashboard versions for the given dashboard UID or ID. If both UID
// and ID are included, UID takes precedence.
func (s *Service) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersionDTO, error) {
	if query.Limit == 0 {
		query.Limit = 1000
	}

	var dashUID string = query.DashboardUID
	if dashUID == "" { // get the dashUID for the return DashboardVersionDTO
		q := models.GetDashboardRefByIdQuery{Id: query.DashboardID}
		err := s.dashSvc.GetDashboardUIDById(ctx, &q)
		if err != nil {
			return nil, err
		}
		dashUID = query.DashboardUID
	} else { // If we have a dashUID, get the dashboardID for the store query
		q := models.GetDashboardQuery{Uid: query.DashboardUID}
		err := s.dashSvc.GetDashboard(ctx, &q)
		if err != nil {
			return nil, err
		}
		query.DashboardID = q.Id
	}

	versions, err := s.store.List(ctx, query)
	if err != nil {
		return nil, err
	}

	ret := make([]*dashver.DashboardVersionDTO, len(versions))
	for i, v := range versions {
		ret[i] = v.ToDTO(dashUID)
	}

	return ret, nil
}
