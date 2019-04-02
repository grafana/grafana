package dashboards

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/mock"
)

type FakeDashboardProvisioningService struct {
	mock.Mock
}

func (s *FakeDashboardProvisioningService) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	args := s.Called(name)
	return args.Get(0).([]*models.DashboardProvisioning), args.Error(1)
}

func (s *FakeDashboardProvisioningService) SaveProvisionedDashboard(dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	args := s.Called(dto, provisioning)
	return args.Get(0).(*models.Dashboard), args.Error(1)
}

func (s *FakeDashboardProvisioningService) SaveFolderForProvisionedDashboards(dto *SaveDashboardDTO) (*models.Dashboard, error) {
	args := s.Called(dto)
	return args.Get(0).(*models.Dashboard), args.Error(1)
}

func (s *FakeDashboardProvisioningService) UnprovisionDashboard(dashboardId int64) error {
	args := s.Called(dashboardId)
	return args.Error(0)
}

func (s *FakeDashboardProvisioningService) DeleteProvisionedDashboard(dashboardId int64, orgId int64) error {
	args := s.Called(dashboardId, orgId)
	return args.Error(0)
}
