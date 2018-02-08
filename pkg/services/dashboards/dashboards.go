package dashboards

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

type Repository interface {
	SaveDashboard(*SaveDashboardDTO) (*models.Dashboard, error)
	SaveProvisionedDashboard(dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
}

var repositoryInstance Repository

func GetRepository() Repository {
	return repositoryInstance
}

func SetRepository(rep Repository) {
	repositoryInstance = rep
}

type SaveDashboardDTO struct {
	OrgId     int64
	UpdatedAt time.Time
	UserId    int64
	Message   string
	Overwrite bool
	Dashboard *models.Dashboard
}

type DashboardRepository struct{}

func (dr *DashboardRepository) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	cmd := &models.GetProvisionedDashboardDataQuery{Name: name}
	err := bus.Dispatch(cmd)
	if err != nil {
		return nil, err
	}

	return cmd.Result, nil
}

func (dr *DashboardRepository) buildSaveDashboardCommand(dto *SaveDashboardDTO) (*models.SaveDashboardCommand, error) {
	dashboard := dto.Dashboard

	if dashboard.Title == "" {
		return nil, models.ErrDashboardTitleEmpty
	}

	validateAlertsCmd := alerting.ValidateDashboardAlertsCommand{
		OrgId:     dto.OrgId,
		Dashboard: dashboard,
	}

	if err := bus.Dispatch(&validateAlertsCmd); err != nil {
		return nil, models.ErrDashboardContainsInvalidAlertData
	}

	cmd := &models.SaveDashboardCommand{
		Dashboard: dashboard.Data,
		Message:   dto.Message,
		OrgId:     dto.OrgId,
		Overwrite: dto.Overwrite,
		UserId:    dto.UserId,
		FolderId:  dashboard.FolderId,
		IsFolder:  dashboard.IsFolder,
	}

	if !dto.UpdatedAt.IsZero() {
		cmd.UpdatedAt = dto.UpdatedAt
	}

	return cmd, nil
}

func (dr *DashboardRepository) updateAlerting(cmd *models.SaveDashboardCommand, dto *SaveDashboardDTO) error {
	alertCmd := alerting.UpdateDashboardAlertsCommand{
		OrgId:     dto.OrgId,
		UserId:    dto.UserId,
		Dashboard: cmd.Result,
	}

	if err := bus.Dispatch(&alertCmd); err != nil {
		return models.ErrDashboardFailedToUpdateAlertData
	}

	return nil
}

func (dr *DashboardRepository) SaveProvisionedDashboard(dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	cmd, err := dr.buildSaveDashboardCommand(dto)
	if err != nil {
		return nil, err
	}

	saveCmd := &models.SaveProvisionedDashboardCommand{
		DashboardCmd:          cmd,
		DashboardProvisioning: provisioning,
	}

	// dashboard
	err = bus.Dispatch(saveCmd)
	if err != nil {
		return nil, err
	}

	//alerts
	err = dr.updateAlerting(cmd, dto)
	if err != nil {
		return nil, err
	}

	return cmd.Result, nil
}

func (dr *DashboardRepository) SaveDashboard(dto *SaveDashboardDTO) (*models.Dashboard, error) {
	cmd, err := dr.buildSaveDashboardCommand(dto)
	if err != nil {
		return nil, err
	}

	err = bus.Dispatch(cmd)
	if err != nil {
		return nil, err
	}

	err = dr.updateAlerting(cmd, dto)
	if err != nil {
		return nil, err
	}

	return cmd.Result, nil
}
