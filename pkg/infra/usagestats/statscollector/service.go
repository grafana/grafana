package statscollector

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

type Service struct {
	cfg                *setting.Cfg
	sqlstore           sqlstore.Store
	plugins            plugins.Store
	social             social.Service
	usageStats         usagestats.Service
	features           *featuremgmt.FeatureManager
	datasources        datasources.DataSourceService
	httpClientProvider httpclient.Provider

	log log.Logger

	startTime                time.Time
	concurrentUserStatsCache memoConcurrentUserStats
	promFlavorCache          memoPrometheusFlavor
	usageStatProviders       []registry.ProvidesUsageStats
}

func ProvideService(
	usagestats usagestats.Service,
	cfg *setting.Cfg,
	store sqlstore.Store,
	social social.Service,
	plugins plugins.Store,
	features *featuremgmt.FeatureManager,
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
) *Service {
	s := &Service{
		cfg:                cfg,
		sqlstore:           store,
		plugins:            plugins,
		social:             social,
		usageStats:         usagestats,
		features:           features,
		datasources:        datasourceService,
		httpClientProvider: httpClientProvider,

		startTime: time.Now(),
		log:       log.New("infra.usagestats.collector"),
	}

	usagestats.RegisterMetricsFunc(s.collect)

	return s
}

// RegisterProviders is called only once - during Grafana start up
func (s *Service) RegisterProviders(usageStatProviders []registry.ProvidesUsageStats) {
	s.log.Info("registering usage stat providers", "usageStatsProvidersLen", len(usageStatProviders))
	s.usageStatProviders = usageStatProviders
}

func (s *Service) Run(ctx context.Context) error {
	s.updateTotalStats(ctx)
	updateStatsTicker := time.NewTicker(time.Minute * 30)
	defer updateStatsTicker.Stop()

	for {
		select {
		case <-updateStatsTicker.C:
			s.updateTotalStats(ctx)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *Service) collect(ctx context.Context) (map[string]interface{}, error) {
	m := map[string]interface{}{}

	statsQuery := models.GetSystemStatsQuery{}
	if err := s.sqlstore.GetSystemStats(ctx, &statsQuery); err != nil {
		s.log.Error("Failed to get system stats", "error", err)
		return nil, err
	}

	m["stats.dashboards.count"] = statsQuery.Result.Dashboards
	m["stats.users.count"] = statsQuery.Result.Users
	m["stats.admins.count"] = statsQuery.Result.Admins
	m["stats.editors.count"] = statsQuery.Result.Editors
	m["stats.viewers.count"] = statsQuery.Result.Viewers
	m["stats.orgs.count"] = statsQuery.Result.Orgs
	m["stats.playlist.count"] = statsQuery.Result.Playlists
	m["stats.plugins.apps.count"] = s.appCount(ctx)
	m["stats.plugins.panels.count"] = s.panelCount(ctx)
	m["stats.plugins.datasources.count"] = s.dataSourceCount(ctx)
	m["stats.alerts.count"] = statsQuery.Result.Alerts
	m["stats.active_users.count"] = statsQuery.Result.ActiveUsers
	m["stats.active_admins.count"] = statsQuery.Result.ActiveAdmins
	m["stats.active_editors.count"] = statsQuery.Result.ActiveEditors
	m["stats.active_viewers.count"] = statsQuery.Result.ActiveViewers
	m["stats.active_sessions.count"] = statsQuery.Result.ActiveSessions
	m["stats.monthly_active_users.count"] = statsQuery.Result.MonthlyActiveUsers
	m["stats.daily_active_users.count"] = statsQuery.Result.DailyActiveUsers
	m["stats.daily_active_admins.count"] = statsQuery.Result.DailyActiveAdmins
	m["stats.daily_active_editors.count"] = statsQuery.Result.DailyActiveEditors
	m["stats.daily_active_viewers.count"] = statsQuery.Result.DailyActiveViewers
	m["stats.daily_active_sessions.count"] = statsQuery.Result.DailyActiveSessions
	m["stats.datasources.count"] = statsQuery.Result.Datasources
	m["stats.stars.count"] = statsQuery.Result.Stars
	m["stats.folders.count"] = statsQuery.Result.Folders
	m["stats.dashboard_permissions.count"] = statsQuery.Result.DashboardPermissions
	m["stats.folder_permissions.count"] = statsQuery.Result.FolderPermissions
	m["stats.provisioned_dashboards.count"] = statsQuery.Result.ProvisionedDashboards
	m["stats.snapshots.count"] = statsQuery.Result.Snapshots
	m["stats.teams.count"] = statsQuery.Result.Teams
	m["stats.total_auth_token.count"] = statsQuery.Result.AuthTokens
	m["stats.dashboard_versions.count"] = statsQuery.Result.DashboardVersions
	m["stats.annotations.count"] = statsQuery.Result.Annotations
	m["stats.alert_rules.count"] = statsQuery.Result.AlertRules
	m["stats.library_panels.count"] = statsQuery.Result.LibraryPanels
	m["stats.library_variables.count"] = statsQuery.Result.LibraryVariables
	m["stats.dashboards_viewers_can_edit.count"] = statsQuery.Result.DashboardsViewersCanEdit
	m["stats.dashboards_viewers_can_admin.count"] = statsQuery.Result.DashboardsViewersCanAdmin
	m["stats.folders_viewers_can_edit.count"] = statsQuery.Result.FoldersViewersCanEdit
	m["stats.folders_viewers_can_admin.count"] = statsQuery.Result.FoldersViewersCanAdmin
	m["stats.api_keys.count"] = statsQuery.Result.APIKeys
	m["stats.data_keys.count"] = statsQuery.Result.DataKeys
	m["stats.active_data_keys.count"] = statsQuery.Result.ActiveDataKeys

	ossEditionCount := 1
	enterpriseEditionCount := 0
	if s.cfg.IsEnterprise {
		enterpriseEditionCount = 1
		ossEditionCount = 0
	}
	m["stats.edition.oss.count"] = ossEditionCount
	m["stats.edition.enterprise.count"] = enterpriseEditionCount

	userCount := statsQuery.Result.Users
	avgAuthTokensPerUser := statsQuery.Result.AuthTokens
	if userCount != 0 {
		avgAuthTokensPerUser /= userCount
	}

	m["stats.avg_auth_token_per_user.count"] = avgAuthTokensPerUser

	dsStats := models.GetDataSourceStatsQuery{}
	if err := s.sqlstore.GetDataSourceStats(ctx, &dsStats); err != nil {
		s.log.Error("Failed to get datasource stats", "error", err)
		return nil, err
	}

	// send counters for each data source
	// but ignore any custom data sources
	// as sending that name could be sensitive information
	dsOtherCount := 0
	for _, dsStat := range dsStats.Result {
		if s.usageStats.ShouldBeReported(ctx, dsStat.Type) {
			m["stats.ds."+dsStat.Type+".count"] = dsStat.Count
		} else {
			dsOtherCount += dsStat.Count
		}
	}
	m["stats.ds.other.count"] = dsOtherCount

	esDataSourcesQuery := models.GetDataSourcesByTypeQuery{Type: models.DS_ES}
	if err := s.sqlstore.GetDataSourcesByType(ctx, &esDataSourcesQuery); err != nil {
		s.log.Error("Failed to get elasticsearch json data", "error", err)
		return nil, err
	}

	for _, data := range esDataSourcesQuery.Result {
		esVersion, err := data.JsonData.Get("esVersion").Int()
		if err != nil {
			continue
		}

		statName := fmt.Sprintf("stats.ds.elasticsearch.v%d.count", esVersion)

		count, _ := m[statName].(int64)

		m[statName] = count + 1
	}

	m["stats.packaging."+s.cfg.Packaging+".count"] = 1
	m["stats.distributor."+s.cfg.ReportingDistributor+".count"] = 1

	// fetch datasource access stats
	dsAccessStats := models.GetDataSourceAccessStatsQuery{}
	if err := s.sqlstore.GetDataSourceAccessStats(ctx, &dsAccessStats); err != nil {
		s.log.Error("Failed to get datasource access stats", "error", err)
		return nil, err
	}

	variants, err := s.detectPrometheusVariants(ctx)
	if err != nil {
		return nil, err
	}

	for variant, count := range variants {
		m["stats.ds.prometheus.flavor."+variant+".count"] = count
	}

	// send access counters for each data source
	// but ignore any custom data sources
	// as sending that name could be sensitive information
	dsAccessOtherCount := make(map[string]int64)
	for _, dsAccessStat := range dsAccessStats.Result {
		if dsAccessStat.Access == "" {
			continue
		}

		access := strings.ToLower(dsAccessStat.Access)

		if s.usageStats.ShouldBeReported(ctx, dsAccessStat.Type) {
			m["stats.ds_access."+dsAccessStat.Type+"."+access+".count"] = dsAccessStat.Count
		} else {
			old := dsAccessOtherCount[access]
			dsAccessOtherCount[access] = old + dsAccessStat.Count
		}
	}

	for access, count := range dsAccessOtherCount {
		m["stats.ds_access.other."+access+".count"] = count
	}

	// get stats about alert notifier usage
	anStats := models.GetAlertNotifierUsageStatsQuery{}
	if err := s.sqlstore.GetAlertNotifiersUsageStats(ctx, &anStats); err != nil {
		s.log.Error("Failed to get alert notification stats", "error", err)
		return nil, err
	}

	for _, stats := range anStats.Result {
		m["stats.alert_notifiers."+stats.Type+".count"] = stats.Count
	}

	// Add stats about auth configuration
	authTypes := map[string]bool{}
	authTypes["anonymous"] = s.cfg.AnonymousEnabled
	authTypes["basic_auth"] = s.cfg.BasicAuthEnabled
	authTypes["ldap"] = s.cfg.LDAPEnabled
	authTypes["auth_proxy"] = s.cfg.AuthProxyEnabled

	for provider, enabled := range s.social.GetOAuthProviders() {
		authTypes["oauth_"+provider] = enabled
	}

	for authType, enabled := range authTypes {
		enabledValue := 0
		if enabled {
			enabledValue = 1
		}
		m["stats.auth_enabled."+authType+".count"] = enabledValue
	}

	// Get concurrent users stats as histogram
	concurrentUsersStats, err := s.concurrentUsers(ctx)
	if err != nil {
		s.log.Error("Failed to get concurrent users stats", "error", err)
		return nil, err
	}

	// Histogram is cumulative and metric name has a postfix of le_"<upper inclusive bound>"
	m["stats.auth_token_per_user_le_3"] = concurrentUsersStats.BucketLE3
	m["stats.auth_token_per_user_le_6"] = concurrentUsersStats.BucketLE6
	m["stats.auth_token_per_user_le_9"] = concurrentUsersStats.BucketLE9
	m["stats.auth_token_per_user_le_12"] = concurrentUsersStats.BucketLE12
	m["stats.auth_token_per_user_le_15"] = concurrentUsersStats.BucketLE15
	m["stats.auth_token_per_user_le_inf"] = concurrentUsersStats.BucketLEInf

	m["stats.uptime"] = int64(time.Since(s.startTime).Seconds())

	featureUsageStats := s.features.GetUsageStats(ctx)
	for k, v := range featureUsageStats {
		m[k] = v
	}

	for _, usageStatProvider := range s.usageStatProviders {
		stats := usageStatProvider.GetUsageStats(ctx)
		for k, v := range stats {
			m[k] = v
		}
	}

	return m, nil
}

func (s *Service) updateTotalStats(ctx context.Context) bool {
	if !s.cfg.MetricsEndpointEnabled || s.cfg.MetricsEndpointDisableTotalStats {
		return false
	}

	statsQuery := models.GetSystemStatsQuery{}
	if err := s.sqlstore.GetSystemStats(ctx, &statsQuery); err != nil {
		s.log.Error("Failed to get system stats", "error", err)
		return false
	}

	metrics.MStatTotalDashboards.Set(float64(statsQuery.Result.Dashboards))
	metrics.MStatTotalFolders.Set(float64(statsQuery.Result.Folders))
	metrics.MStatTotalUsers.Set(float64(statsQuery.Result.Users))
	metrics.MStatActiveUsers.Set(float64(statsQuery.Result.ActiveUsers))
	metrics.MStatTotalPlaylists.Set(float64(statsQuery.Result.Playlists))
	metrics.MStatTotalOrgs.Set(float64(statsQuery.Result.Orgs))
	metrics.StatsTotalViewers.Set(float64(statsQuery.Result.Viewers))
	metrics.StatsTotalActiveViewers.Set(float64(statsQuery.Result.ActiveViewers))
	metrics.StatsTotalEditors.Set(float64(statsQuery.Result.Editors))
	metrics.StatsTotalActiveEditors.Set(float64(statsQuery.Result.ActiveEditors))
	metrics.StatsTotalAdmins.Set(float64(statsQuery.Result.Admins))
	metrics.StatsTotalActiveAdmins.Set(float64(statsQuery.Result.ActiveAdmins))
	metrics.StatsTotalDashboardVersions.Set(float64(statsQuery.Result.DashboardVersions))
	metrics.StatsTotalAnnotations.Set(float64(statsQuery.Result.Annotations))
	metrics.StatsTotalAlertRules.Set(float64(statsQuery.Result.AlertRules))
	metrics.StatsTotalLibraryPanels.Set(float64(statsQuery.Result.LibraryPanels))
	metrics.StatsTotalLibraryVariables.Set(float64(statsQuery.Result.LibraryVariables))

	metrics.StatsTotalDataKeys.With(prometheus.Labels{"active": "true"}).Set(float64(statsQuery.Result.ActiveDataKeys))
	inactiveDataKeys := statsQuery.Result.DataKeys - statsQuery.Result.ActiveDataKeys
	metrics.StatsTotalDataKeys.With(prometheus.Labels{"active": "false"}).Set(float64(inactiveDataKeys))

	dsStats := models.GetDataSourceStatsQuery{}
	if err := s.sqlstore.GetDataSourceStats(ctx, &dsStats); err != nil {
		s.log.Error("Failed to get datasource stats", "error", err)
		return true
	}

	for _, dsStat := range dsStats.Result {
		metrics.StatsTotalDataSources.WithLabelValues(dsStat.Type).Set(float64(dsStat.Count))
	}
	return true
}

func (s *Service) appCount(ctx context.Context) int {
	return len(s.plugins.Plugins(ctx, plugins.App))
}

func (s *Service) panelCount(ctx context.Context) int {
	return len(s.plugins.Plugins(ctx, plugins.Panel))
}

func (s *Service) dataSourceCount(ctx context.Context) int {
	return len(s.plugins.Plugins(ctx, plugins.DataSource))
}
