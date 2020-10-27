package dashboards

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/gtime"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// DashboardService service for operating on dashboards
type DashboardService interface {
	SaveDashboard(dto *SaveDashboardDTO, allowUiUpdate bool) (*models.Dashboard, error)
	ImportDashboard(dto *SaveDashboardDTO) (*models.Dashboard, error)
	DeleteDashboard(dashboardId int64, orgId int64) error
}

// DashboardProvisioningService service for operating on provisioned dashboards
type DashboardProvisioningService interface {
	SaveProvisionedDashboard(dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	SaveFolderForProvisionedDashboards(*SaveDashboardDTO) (*models.Dashboard, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardID(DashboardId int64) (*models.DashboardProvisioning, error)
	UnprovisionDashboard(dashboardId int64) error
	DeleteProvisionedDashboard(dashboardId int64, orgId int64) error
}

// NewService factory for creating a new dashboard service
var NewService = func() DashboardService {
	return &dashboardServiceImpl{
		log: log.New("dashboard-service"),
	}
}

// NewProvisioningService factory for creating a new dashboard provisioning service
var NewProvisioningService = func() DashboardProvisioningService {
	return &dashboardServiceImpl{
		log: log.New("dashboard-provisioning-service"),
	}
}

type SaveDashboardDTO struct {
	OrgId     int64
	UpdatedAt time.Time
	User      *models.SignedInUser
	Message   string
	Overwrite bool
	Dashboard *models.Dashboard
}

type dashboardServiceImpl struct {
	orgId int64
	user  *models.SignedInUser
	log   log.Logger
}

func (dr *dashboardServiceImpl) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	cmd := &models.GetProvisionedDashboardDataQuery{Name: name}
	err := bus.Dispatch(cmd)
	if err != nil {
		return nil, err
	}

	return cmd.Result, nil
}

func (dr *dashboardServiceImpl) GetProvisionedDashboardDataByDashboardID(dashboardId int64) (*models.DashboardProvisioning, error) {
	cmd := &models.GetProvisionedDashboardDataByIdQuery{DashboardId: dashboardId}
	err := bus.Dispatch(cmd)
	if err != nil {
		return nil, err
	}

	return cmd.Result, nil
}

func (dr *dashboardServiceImpl) buildSaveDashboardCommand(dto *SaveDashboardDTO, validateAlerts bool, validateProvisionedDashboard bool) (*models.SaveDashboardCommand, error) {
	dash := dto.Dashboard

	dash.Title = strings.TrimSpace(dash.Title)
	dash.Data.Set("title", dash.Title)
	dash.SetUid(strings.TrimSpace(dash.Uid))

	if dash.Title == "" {
		return nil, models.ErrDashboardTitleEmpty
	}

	if dash.IsFolder && dash.FolderId > 0 {
		return nil, models.ErrDashboardFolderCannotHaveParent
	}

	if dash.IsFolder && strings.EqualFold(dash.Title, models.RootFolderName) {
		return nil, models.ErrDashboardFolderNameExists
	}

	if !util.IsValidShortUID(dash.Uid) {
		return nil, models.ErrDashboardInvalidUid
	} else if len(dash.Uid) > 40 {
		return nil, models.ErrDashboardUidTooLong
	}

	if err := validateDashboardRefreshInterval(dash); err != nil {
		return nil, err
	}

	if validateAlerts {
		validateAlertsCmd := models.ValidateDashboardAlertsCommand{
			OrgId:     dto.OrgId,
			Dashboard: dash,
			User:      dto.User,
		}

		if err := bus.Dispatch(&validateAlertsCmd); err != nil {
			return nil, err
		}
	}

	validateBeforeSaveCmd := models.ValidateDashboardBeforeSaveCommand{
		OrgId:     dto.OrgId,
		Dashboard: dash,
		Overwrite: dto.Overwrite,
	}

	if err := bus.Dispatch(&validateBeforeSaveCmd); err != nil {
		return nil, err
	}

	if validateBeforeSaveCmd.Result.IsParentFolderChanged {
		folderGuardian := guardian.New(dash.FolderId, dto.OrgId, dto.User)
		if canSave, err := folderGuardian.CanSave(); err != nil || !canSave {
			if err != nil {
				return nil, err
			}
			return nil, models.ErrDashboardUpdateAccessDenied
		}
	}

	if validateProvisionedDashboard {
		provisionedData, err := dr.GetProvisionedDashboardDataByDashboardID(dash.Id)
		if err != nil {
			return nil, err
		}

		if provisionedData != nil {
			return nil, models.ErrDashboardCannotSaveProvisionedDashboard
		}
	}

	guard := guardian.New(dash.GetDashboardIdForSavePermissionCheck(), dto.OrgId, dto.User)
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
		PluginId:  dash.PluginId,
	}

	if !dto.UpdatedAt.IsZero() {
		cmd.UpdatedAt = dto.UpdatedAt
	}

	return cmd, nil
}

func validateDashboardRefreshInterval(dash *models.Dashboard) error {
	if setting.MinRefreshInterval == "" {
		return nil
	}

	refresh := dash.Data.Get("refresh").MustString("")
	if refresh == "" {
		// since no refresh is set it is a valid refresh rate
		return nil
	}

	minRefreshInterval, err := gtime.ParseInterval(setting.MinRefreshInterval)
	if err != nil {
		return err
	}
	d, err := gtime.ParseInterval(refresh)
	if err != nil {
		return err
	}

	if d < minRefreshInterval {
		return models.ErrDashboardRefreshIntervalTooShort
	}

	return nil
}

func (dr *dashboardServiceImpl) updateAlerting(cmd *models.SaveDashboardCommand, dto *SaveDashboardDTO) error {
	alertCmd := models.UpdateDashboardAlertsCommand{
		OrgId:     dto.OrgId,
		Dashboard: cmd.Result,
		User:      dto.User,
	}

	return bus.Dispatch(&alertCmd)
}

func (dr *dashboardServiceImpl) SaveProvisionedDashboard(dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for provisioned dashboard to minimum refresh interval", "dashboardUid", dto.Dashboard.Uid, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval", setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	dto.User = &models.SignedInUser{
		UserId:  0,
		OrgRole: models.ROLE_ADMIN,
		OrgId:   dto.OrgId,
	}

	cmd, err := dr.buildSaveDashboardCommand(dto, true, false)
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

	// alerts
	err = dr.updateAlerting(cmd, dto)
	if err != nil {
		return nil, err
	}

	return cmd.Result, nil
}

func (dr *dashboardServiceImpl) SaveFolderForProvisionedDashboards(dto *SaveDashboardDTO) (*models.Dashboard, error) {
	dto.User = &models.SignedInUser{
		UserId:  0,
		OrgRole: models.ROLE_ADMIN,
	}
	cmd, err := dr.buildSaveDashboardCommand(dto, false, false)
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

func (dr *dashboardServiceImpl) SaveDashboard(dto *SaveDashboardDTO, allowUiUpdate bool) (*models.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval", "dashboardUid", dto.Dashboard.Uid, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval", setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	cmd, err := dr.buildSaveDashboardCommand(dto, true, !allowUiUpdate)
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

// DeleteDashboard removes dashboard from the DB. Errors out if the dashboard was provisioned. Should be used for
// operations by the user where we want to make sure user does not delete provisioned dashboard.
func (dr *dashboardServiceImpl) DeleteDashboard(dashboardId int64, orgId int64) error {
	return dr.deleteDashboard(dashboardId, orgId, true)
}

// DeleteProvisionedDashboard removes dashboard from the DB even if it is provisioned.
func (dr *dashboardServiceImpl) DeleteProvisionedDashboard(dashboardId int64, orgId int64) error {
	return dr.deleteDashboard(dashboardId, orgId, false)
}

func (dr *dashboardServiceImpl) deleteDashboard(dashboardId int64, orgId int64, validateProvisionedDashboard bool) error {
	if validateProvisionedDashboard {
		provisionedData, err := dr.GetProvisionedDashboardDataByDashboardID(dashboardId)
		if err != nil {
			return errutil.Wrap("failed to check if dashboard is provisioned", err)
		}

		if provisionedData != nil {
			return models.ErrDashboardCannotDeleteProvisionedDashboard
		}
	}
	cmd := &models.DeleteDashboardCommand{OrgId: orgId, Id: dashboardId}
	return bus.Dispatch(cmd)
}

func (dr *dashboardServiceImpl) ImportDashboard(dto *SaveDashboardDTO) (*models.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval", "dashboardUid", dto.Dashboard.Uid, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval", setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	cmd, err := dr.buildSaveDashboardCommand(dto, false, true)
	if err != nil {
		return nil, err
	}

	err = bus.Dispatch(cmd)
	if err != nil {
		return nil, err
	}

	return cmd.Result, nil
}

// UnprovisionDashboard removes info about dashboard being provisioned. Used after provisioning configs are changed
// and provisioned dashboards are left behind but not deleted.
func (dr *dashboardServiceImpl) UnprovisionDashboard(dashboardId int64) error {
	cmd := &models.UnprovisionDashboardCommand{Id: dashboardId}
	return bus.Dispatch(cmd)
}

type FakeDashboardService struct {
	SaveDashboardResult *models.Dashboard
	SaveDashboardError  error
	SavedDashboards     []*SaveDashboardDTO
}

func (s *FakeDashboardService) SaveDashboard(dto *SaveDashboardDTO, allowUiUpdate bool) (*models.Dashboard, error) {
	s.SavedDashboards = append(s.SavedDashboards, dto)

	if s.SaveDashboardResult == nil && s.SaveDashboardError == nil {
		s.SaveDashboardResult = dto.Dashboard
	}

	return s.SaveDashboardResult, s.SaveDashboardError
}

func (s *FakeDashboardService) ImportDashboard(dto *SaveDashboardDTO) (*models.Dashboard, error) {
	return s.SaveDashboard(dto, true)
}

func (s *FakeDashboardService) DeleteDashboard(dashboardId int64, orgId int64) error {
	for index, dash := range s.SavedDashboards {
		if dash.Dashboard.Id == dashboardId && dash.OrgId == orgId {
			s.SavedDashboards = append(s.SavedDashboards[:index], s.SavedDashboards[index+1:]...)
			break
		}
	}
	return nil
}

func MockDashboardService(mock *FakeDashboardService) {
	NewService = func() DashboardService {
		return mock
	}
}
