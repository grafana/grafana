package usagedataimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/usagedata"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
	cfg   *setting.Cfg
	log   log.Logger
}

func ProvideService(db db.DB, cfg *setting.Cfg) (usagedata.Service, error) {
	log := log.New("usagedata service")
	s := &Service{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
			log:     log,
			cfg:     cfg,
		},
		cfg: cfg,
		log: log,
	}

	return s, nil
}

func (s *Service) GetDashboardsUsingDeprecatedPlugins(ctx context.Context, orgID int64) (usagedata.PluginInfoResponse, error) {
	return s.store.GetDashboardsUsingDepPlugs(ctx, orgID)
}

func (s *Service) GetUserData(ctx context.Context, orgId int64, loginId string, status string, useridentifier string) (usagedata.UserCountResponse, error) {
	return s.store.GetUserDataService(ctx, orgId, loginId, status, useridentifier)
}

func (s *Service) GetDashboardsReportScheduler(ctx context.Context, fromTime string, toTime string, orgID int64, lastDayScheduleDetails bool, allScheduleInfo bool) (usagedata.UsageDataResponse, error) {
	return s.store.GetDashboardsRepoSchedule(ctx, fromTime, toTime, orgID, lastDayScheduleDetails, allScheduleInfo)
}

func (s *Service) GetRolesAndPermissions(ctx context.Context, orgID int64, dashboardPermissionsService accesscontrol.DashboardPermissionsService, folderPermissionService accesscontrol.FolderPermissionsService, user_id string) (usagedata.RolesPermissionsResponse, error) {
	return s.store.GetRolesAndPermissionsService(ctx, orgID, dashboardPermissionsService, folderPermissionService, user_id)
}

func (s *Service) GetOrgLevelDashboardStats(ctx context.Context, fromTime string, toTime string, orgID int64) (usagedata.OrgLevelDashboardStatisticsResponse, error) {
	return s.store.GetOrgLevelDashboardStatistics(ctx, fromTime, toTime, orgID)
}

func (s *Service) GetIndividualDashboardStats(ctx context.Context, dashboardID int64, orgID int64) (usagedata.IndividualDashboardStatisticsResponse, error) {
	return s.store.GetIndividualDashboardStatistics(ctx, dashboardID, orgID)
}

func (s *Service) GetDashboardHits(ctx context.Context, fromTime string, toTime string, dashboardID int64, orgID int64) (usagedata.DashboardHitsResponse, error) {
	return s.store.GetDashboardHits(ctx, fromTime, toTime, dashboardID, orgID)
}

func (s *Service) GetDashboardLoadTimes(ctx context.Context, fromTime string, toTime string, dashboardID int64, orgID int64) (usagedata.DashboardLoadTimesResponse, error) {
	return s.store.GetDashboardLoadTimes(ctx, fromTime, toTime, dashboardID, orgID)
}

func (s *Service) GetDashboardHitsUserInfo(ctx context.Context, fromTime string, toTime string, orgID int64, user string, dashboard string) (usagedata.UsageDataResponse, error) {
	return s.store.GetDashboardHitsUserInfo(ctx, fromTime, toTime, orgID, user, dashboard)
}

func (s *Service) GetDashboardDetails(ctx context.Context, orgID int64, folder string, title string, status string) (usagedata.DashboardDetailsResponse, error) {
	return s.store.GetDashboardDetails(ctx, orgID, folder, title, status)
}

func (s *Service) GetReportSchedulerStaging(ctx context.Context, orgID int64, scheduleName string, fromTime string, toTime string, isDev bool) (usagedata.ScheduleStagingResponse, error) {
	return s.store.GetSchedulerStaging(ctx, orgID, scheduleName, fromTime, toTime, isDev)
}

func (s *Service) GetNextRunSchedules(ctx context.Context, orgID int64) (usagedata.ScheduleShortInfoResponse, error) {
	return s.store.GetNextSchedules(ctx, orgID)
}

func (s *Service) GetActiveDashboardsCount(ctx context.Context, orgID int64) (usagedata.ActiveDashboardsCountResponse, error) {
	return s.store.GetActiveDashboardsCount(ctx, orgID)
}

func (s *Service) GetDataVolume(ctx context.Context, orgID int64, datasourceID int64, fromTime string, toTime string) (usagedata.DataVolumeResponse, error) {
	return s.store.GetDataVolume(ctx, orgID, datasourceID, fromTime, toTime)
}

func (s *Service) GetIFValueRealization(ctx context.Context, orgID int64,userID int64, fromTime string, toTime string) (usagedata.IFValueRealizationResponse, error) {
	return s.store.GetIFValueRealization(ctx, orgID, userID, fromTime, toTime)
}

func (s *Service) GetIFDashboardCount(ctx context.Context, orgID int64,userID int64, fromTime string, toTime string) (usagedata.IFDashboardCountResponse, error) {
	return s.store.GetIFDashboardCount(ctx, orgID, userID, fromTime, toTime)
}
