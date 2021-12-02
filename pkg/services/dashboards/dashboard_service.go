package dashboards

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/dashboards"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// DashboardService is a service for operating on dashboards.
type DashboardService interface {
	SaveDashboard(ctx context.Context, dto *SaveDashboardDTO, allowUiUpdate bool) (*models.Dashboard, error)
	ImportDashboard(ctx context.Context, dto *SaveDashboardDTO) (*models.Dashboard, error)
	DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error
	MakeUserAdmin(ctx context.Context, orgID int64, userID, dashboardID int64, setViewAndEditPermissions bool) error
}

// DashboardProvisioningService is a service for operating on provisioned dashboards.
type DashboardProvisioningService interface {
	SaveProvisionedDashboard(ctx context.Context, dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	SaveFolderForProvisionedDashboards(context.Context, *SaveDashboardDTO) (*models.Dashboard, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	UnprovisionDashboard(dashboardID int64) error
	DeleteProvisionedDashboard(ctx context.Context, dashboardID int64, orgID int64) error
}

// NewService is a factory for creating a new dashboard service.
var NewService = func(store dashboards.Store) DashboardService {
	return &dashboardServiceImpl{
		dashboardStore: store,
		log:            log.New("dashboard-service"),
	}
}

// NewProvisioningService is a factory for creating a new dashboard provisioning service.
var NewProvisioningService = func(store dashboards.Store) DashboardProvisioningService {
	return NewService(store).(*dashboardServiceImpl)
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
	dashboardStore dashboards.Store
	orgId          int64
	user           *models.SignedInUser
	log            log.Logger
}

func (dr *dashboardServiceImpl) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	return dr.dashboardStore.GetProvisionedDashboardData(name)
}

// GetProvisionedData gets provisioned dashboard data.
//
// Stubbable by tests.
var GetProvisionedData = func(store dashboards.Store, dashboardID int64) (*models.DashboardProvisioning, error) {
	return store.GetProvisionedDataByDashboardID(dashboardID)
}

func (dr *dashboardServiceImpl) GetProvisionedDashboardDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error) {
	return GetProvisionedData(dr.dashboardStore, dashboardID)
}

func (dr *dashboardServiceImpl) buildSaveDashboardCommand(ctx context.Context, dto *SaveDashboardDTO, shouldValidateAlerts bool,
	validateProvisionedDashboard bool) (*models.SaveDashboardCommand, error) {
	dash := dto.Dashboard

	dash.OrgId = dto.OrgId
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
	} else if util.IsShortUIDTooLong(dash.Uid) {
		return nil, models.ErrDashboardUidTooLong
	}

	if err := validateDashboardRefreshInterval(dash); err != nil {
		return nil, err
	}

	if shouldValidateAlerts {
		if err := validateAlerts(ctx, dash, dto.User); err != nil {
			return nil, err
		}
	}

	isParentFolderChanged, err := dr.dashboardStore.ValidateDashboardBeforeSave(dash, dto.Overwrite)
	if err != nil {
		return nil, err
	}

	if isParentFolderChanged {
		folderGuardian := guardian.New(context.TODO(), dash.FolderId, dto.OrgId, dto.User)
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

	guard := guardian.New(context.TODO(), dash.GetDashboardIdForSavePermissionCheck(), dto.OrgId, dto.User)
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

var validateAlerts = func(ctx context.Context, dash *models.Dashboard, user *models.SignedInUser) error {
	extractor := alerting.NewDashAlertExtractor(dash, dash.OrgId, user)
	return extractor.ValidateAlerts(ctx)
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

	minRefreshInterval, err := gtime.ParseDuration(setting.MinRefreshInterval)
	if err != nil {
		return fmt.Errorf("parsing min refresh interval %q failed: %w", setting.MinRefreshInterval, err)
	}
	d, err := gtime.ParseDuration(refresh)
	if err != nil {
		return fmt.Errorf("parsing refresh duration %q failed: %w", refresh, err)
	}

	if d < minRefreshInterval {
		return models.ErrDashboardRefreshIntervalTooShort
	}

	return nil
}

// UpdateAlerting updates alerting.
//
// Stubbable by tests.
var UpdateAlerting = func(ctx context.Context, store dashboards.Store, orgID int64, dashboard *models.Dashboard, user *models.SignedInUser) error {
	extractor := alerting.NewDashAlertExtractor(dashboard, orgID, user)
	alerts, err := extractor.GetAlerts(ctx)
	if err != nil {
		return err
	}

	return store.SaveAlerts(ctx, dashboard.Id, alerts)
}

func (dr *dashboardServiceImpl) SaveProvisionedDashboard(ctx context.Context, dto *SaveDashboardDTO,
	provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for provisioned dashboard to minimum refresh interval", "dashboardUid",
			dto.Dashboard.Uid, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval", setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	dto.User = &models.SignedInUser{
		UserId:  0,
		OrgRole: models.ROLE_ADMIN,
		OrgId:   dto.OrgId,
	}

	cmd, err := dr.buildSaveDashboardCommand(ctx, dto, true, false)
	if err != nil {
		return nil, err
	}

	// dashboard
	dash, err := dr.dashboardStore.SaveProvisionedDashboard(*cmd, provisioning)
	if err != nil {
		return nil, err
	}

	// alerts
	if err := UpdateAlerting(ctx, dr.dashboardStore, dto.OrgId, dash, dto.User); err != nil {
		return nil, err
	}

	return dash, nil
}

func (dr *dashboardServiceImpl) SaveFolderForProvisionedDashboards(ctx context.Context, dto *SaveDashboardDTO) (*models.Dashboard, error) {
	dto.User = &models.SignedInUser{
		UserId:  0,
		OrgRole: models.ROLE_ADMIN,
	}
	cmd, err := dr.buildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(*cmd)
	if err != nil {
		return nil, err
	}

	if err := UpdateAlerting(ctx, dr.dashboardStore, dto.OrgId, dash, dto.User); err != nil {
		return nil, err
	}

	return dash, nil
}

func (dr *dashboardServiceImpl) SaveDashboard(ctx context.Context, dto *SaveDashboardDTO,
	allowUiUpdate bool) (*models.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.Uid, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval",
			setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	cmd, err := dr.buildSaveDashboardCommand(ctx, dto, true, !allowUiUpdate)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(*cmd)
	if err != nil {
		return nil, fmt.Errorf("saving dashboard failed: %w", err)
	}

	if err := UpdateAlerting(ctx, dr.dashboardStore, dto.OrgId, dash, dto.User); err != nil {
		return nil, err
	}

	return dash, nil
}

// DeleteDashboard removes dashboard from the DB. Errors out if the dashboard was provisioned. Should be used for
// operations by the user where we want to make sure user does not delete provisioned dashboard.
func (dr *dashboardServiceImpl) DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	return dr.deleteDashboard(ctx, dashboardId, orgId, true)
}

// DeleteProvisionedDashboard removes dashboard from the DB even if it is provisioned.
func (dr *dashboardServiceImpl) DeleteProvisionedDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	return dr.deleteDashboard(ctx, dashboardId, orgId, false)
}

func (dr *dashboardServiceImpl) deleteDashboard(ctx context.Context, dashboardId int64, orgId int64, validateProvisionedDashboard bool) error {
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
	return bus.DispatchCtx(ctx, cmd)
}

func (dr *dashboardServiceImpl) ImportDashboard(ctx context.Context, dto *SaveDashboardDTO) (
	*models.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.Uid, "dashboardTitle", dto.Dashboard.Title,
			"minRefreshInterval", setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	cmd, err := dr.buildSaveDashboardCommand(ctx, dto, false, true)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(*cmd)
	if err != nil {
		return nil, err
	}

	return dash, nil
}

// UnprovisionDashboard removes info about dashboard being provisioned. Used after provisioning configs are changed
// and provisioned dashboards are left behind but not deleted.
func (dr *dashboardServiceImpl) UnprovisionDashboard(dashboardId int64) error {
	cmd := &models.UnprovisionDashboardCommand{Id: dashboardId}
	return bus.Dispatch(cmd)
}

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
	return s.SaveDashboard(context.Background(), dto, true)
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

func MockDashboardService(mock *FakeDashboardService) {
	NewService = func(dashboards.Store) DashboardService {
		return mock
	}
}
