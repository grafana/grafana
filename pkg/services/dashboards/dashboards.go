package dashboards

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/guardian"
)

type Repository interface {
	SaveDashboard(dto *SaveDashboardDTO) (*models.Dashboard, error)
	SaveProvisionedDashboard(dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	SaveFolderForProvisionedDashboards(*SaveDashboardDTO) (*models.Dashboard, error)
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
	User      *models.SignedInUser
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
	dash := dto.Dashboard

	dash.Title = strings.TrimSpace(dash.Title)
	dash.Data.Set("title", dash.Title)
	dash.Uid = strings.TrimSpace(dash.Uid)
	dash.Data.Set("uid", dash.Uid)

	if dash.Title == "" {
		return nil, models.ErrDashboardTitleEmpty
	}

	if dash.IsFolder && dash.FolderId > 0 {
		return nil, models.ErrDashboardFolderCannotHaveParent
	}

	if dash.IsFolder && strings.ToLower(dash.Title) == strings.ToLower(models.RootFolderName) {
		return nil, models.ErrDashboardFolderNameExists
	}

	validateAlertsCmd := alerting.ValidateDashboardAlertsCommand{
		OrgId:     dto.OrgId,
		Dashboard: dash,
	}

	if err := bus.Dispatch(&validateAlertsCmd); err != nil {
		return nil, models.ErrDashboardContainsInvalidAlertData
	}

	validateDashForUpdateCmd := models.ValidateDashboardForUpdateCommand{
		OrgId:     dto.OrgId,
		Dashboard: dash,
		Overwrite: dto.Overwrite,
	}

	if err := bus.Dispatch(&validateDashForUpdateCmd); err != nil {
		return nil, err
	}

	dashId := dash.Id

	if dashId == 0 {
		dashId = dash.FolderId
	}

	guard := guardian.NewDashboardGuardian(dashId, dto.OrgId, dto.User)
	if canSave, err := guard.CanSave(); err != nil || !canSave {
		if err != nil {
			return nil, err
		}
		return nil, models.ErrDashboardUpdateAccessDenied
	}

	cmd := &models.SaveDashboardCommand{
		Dashboard: dash.Data,
		Message:   dto.Message,
		OrgId:     dto.OrgId,
		Overwrite: dto.Overwrite,
		UserId:    dto.User.UserId,
		FolderId:  dash.FolderId,
		IsFolder:  dash.IsFolder,
	}

	if !dto.UpdatedAt.IsZero() {
		cmd.UpdatedAt = dto.UpdatedAt
	}

	return cmd, nil
}

func (dr *DashboardRepository) updateAlerting(cmd *models.SaveDashboardCommand, dto *SaveDashboardDTO) error {
	alertCmd := alerting.UpdateDashboardAlertsCommand{
		OrgId:     dto.OrgId,
		UserId:    dto.User.UserId,
		Dashboard: cmd.Result,
	}

	if err := bus.Dispatch(&alertCmd); err != nil {
		return models.ErrDashboardFailedToUpdateAlertData
	}

	return nil
}

func (dr *DashboardRepository) SaveProvisionedDashboard(dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	dto.User = &models.SignedInUser{
		UserId:  0,
		OrgRole: models.ROLE_ADMIN,
	}
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

func (dr *DashboardRepository) SaveFolderForProvisionedDashboards(dto *SaveDashboardDTO) (*models.Dashboard, error) {
	dto.User = &models.SignedInUser{
		UserId:  0,
		OrgRole: models.ROLE_ADMIN,
	}
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
