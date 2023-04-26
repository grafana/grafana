package dashverimpl

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
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
	log     log.Logger
}

func ProvideService(db db.DB, dashboardService dashboards.DashboardService) dashver.Service {
	return &Service{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
		},
		dashSvc: dashboardService,
		log:     log.New("dashboard-version"),
	}
}

func (s *Service) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersionDTO, error) {
	// Get the DashboardUID if not populated
	if query.DashboardUID == "" {
		u, err := s.getDashUIDMaybeEmpty(ctx, query.DashboardID)
		if err != nil {
			return nil, err
		}
		query.DashboardUID = u
	}

	// The store methods require the dashboard ID (uid is not in the dashboard
	// versions table, at time of this writing), so get the DashboardID if it
	// was not populated.
	if query.DashboardID == 0 {
		id, err := s.getDashIDMaybeEmpty(ctx, query.DashboardUID)
		if err != nil {
			return nil, err
		}
		query.DashboardID = id
	}

	version, err := s.store.Get(ctx, query)
	if err != nil {
		return nil, err
	}
	version.Data.Set("id", version.DashboardID)
	return version.ToDTO(query.DashboardUID), nil
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
	// Get the DashboardUID if not populated
	if query.DashboardUID == "" {
		u, err := s.getDashUIDMaybeEmpty(ctx, query.DashboardID)
		if err != nil {
			return nil, err
		}
		query.DashboardUID = u
	}

	// The store methods require the dashboard ID (uid is not in the dashboard
	// versions table, at time of this writing), so get the DashboardID if it
	// was not populated.
	if query.DashboardID == 0 {
		id, err := s.getDashIDMaybeEmpty(ctx, query.DashboardUID)
		if err != nil {
			return nil, err
		}
		query.DashboardID = id
	}
	if query.Limit == 0 {
		query.Limit = 1000
	}
	dvs, err := s.store.List(ctx, query)
	if err != nil {
		return nil, err
	}
	dtos := make([]*dashver.DashboardVersionDTO, len(dvs))
	for i, v := range dvs {
		dtos[i] = v.ToDTO(query.DashboardUID)
	}
	return dtos, nil
}

// getDashUIDMaybeEmpty is a helper function which takes a dashboardID and
// returns the UID. If the dashboard is not found, it will return an empty
// string.
func (s *Service) getDashUIDMaybeEmpty(ctx context.Context, id int64) (string, error) {
	q := dashboards.GetDashboardRefByIDQuery{ID: id}
	result, err := s.dashSvc.GetDashboardUIDByID(ctx, &q)
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			s.log.Debug("dashboard not found")
			return "", nil
		} else {
			s.log.Error("error getting dashboard", err)
			return "", err
		}
	}
	return result.UID, nil
}

// getDashIDMaybeEmpty is a helper function which takes a dashboardUID and
// returns the ID. If the dashboard is not found, it will return -1.
func (s *Service) getDashIDMaybeEmpty(ctx context.Context, uid string) (int64, error) {
	q := dashboards.GetDashboardQuery{UID: uid}
	result, err := s.dashSvc.GetDashboard(ctx, &q)
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			s.log.Debug("dashboard not found")
			return -1, nil
		} else {
			s.log.Error("error getting dashboard", err)
			return -1, err
		}
	}
	return result.ID, nil
}
