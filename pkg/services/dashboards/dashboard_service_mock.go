package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakeDashboardService struct {
	DashboardService

	SaveDashboardResult *models.Dashboard
	SaveDashboardError  error
	SavedDashboards     []*SaveDashboardDTO
	ProvisionedDashData *models.DashboardProvisioning
}

func (s *FakeDashboardService) SaveDashboard(ctx context.Context, dto *SaveDashboardDTO, allowUiUpdate bool) (*models.Dashboard, error) {
	s.SavedDashboards = append(s.SavedDashboards, dto)

	if s.SaveDashboardResult == nil && s.SaveDashboardError == nil {
		s.SaveDashboardResult = dto.Dashboard
	}

	return s.SaveDashboardResult, s.SaveDashboardError
}

func (s *FakeDashboardService) ImportDashboard(ctx context.Context, dto *SaveDashboardDTO) (*models.Dashboard, error) {
	return s.SaveDashboard(ctx, dto, true)
}

func (s *FakeDashboardService) DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	for index, dash := range s.SavedDashboards {
		if dash.Dashboard.Id == dashboardId && dash.OrgId == orgId {
			s.SavedDashboards = append(s.SavedDashboards[:index], s.SavedDashboards[index+1:]...)
			break
		}
	}
	return nil
}

func (s *FakeDashboardService) GetProvisionedDashboardDataByDashboardID(id int64) (*models.DashboardProvisioning, error) {
	return s.ProvisionedDashData, nil
}
func (s *FakeDashboardService) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error {
	return nil
}
