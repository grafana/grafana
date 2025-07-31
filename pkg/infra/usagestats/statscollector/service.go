package statscollector

import (
	"context"
	"math/rand"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/infra/usagestats/validator"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/advisor"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/sandbox"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	minDelay = 30
	maxDelay = 120
)

type Service struct {
	settingsProvider   setting.SettingsProvider
	sqlstore           db.DB
	plugins            pluginstore.Store
	usageStats         usagestats.Service
	validator          validator.Service
	statsService       stats.Service
	features           *featuremgmt.FeatureManager
	datasources        datasources.DataSourceService
	httpClientProvider httpclient.Provider
	sandbox            sandbox.Sandbox
	advisor            advisor.AdvisorStats

	log log.Logger

	startTime                time.Time
	concurrentUserStatsCache memoConcurrentUserStats
	promFlavorCache          memoPrometheusFlavor
}

func ProvideService(
	us usagestats.Service,
	validator validator.Service,
	statsService stats.Service,
	settingsProvider setting.SettingsProvider,
	store db.DB,
	social social.Service,
	plugins pluginstore.Store,
	features *featuremgmt.FeatureManager,
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	sandbox sandbox.Sandbox,
	advisor advisor.AdvisorStats,
) *Service {
	s := &Service{
		settingsProvider:   settingsProvider,
		sqlstore:           store,
		plugins:            plugins,
		usageStats:         us,
		validator:          validator,
		statsService:       statsService,
		features:           features,
		datasources:        datasourceService,
		httpClientProvider: httpClientProvider,
		sandbox:            sandbox,
		advisor:            advisor,
		startTime:          time.Now(),
		log:                log.New("infra.usagestats.collector"),
	}

	collectors := []usagestats.MetricsFunc{
		s.collectSystemStats,
		s.collectConcurrentUsers,
		s.collectDatasourceStats,
		s.collectDatasourceAccess,
		s.collectAlertNotifierStats,
		s.collectPrometheusFlavors,
	}

	for _, c := range collectors {
		us.RegisterMetricsFunc(c)
	}

	return s
}

// RegisterProviders is called only once - during Grafana start up
func (s *Service) RegisterProviders(usageStatProviders []registry.ProvidesUsageStats) {
	s.log.Info("registering usage stat providers", "usageStatsProvidersLen", len(usageStatProviders))
	for _, usageStatProvider := range usageStatProviders {
		provider := usageStatProvider.GetUsageStats
		collector := func(ctx context.Context) (map[string]interface{}, error) {
			return provider(ctx), nil
		}

		s.usageStats.RegisterMetricsFunc(collector)
	}
}

func (s *Service) Run(ctx context.Context) error {
	cfg := s.settingsProvider.Get()
	sendInterval := time.Second * time.Duration(cfg.MetricsTotalStatsIntervalSeconds)
	nextSendInterval := time.Duration(rand.Intn(maxDelay-minDelay)+minDelay) * time.Second
	s.log.Debug("usage stats collector started", "sendInterval", sendInterval, "nextSendInterval", nextSendInterval)
	updateStatsTicker := time.NewTicker(nextSendInterval)
	defer updateStatsTicker.Stop()

	for {
		select {
		case <-updateStatsTicker.C:
			s.updateTotalStats(ctx)

			if nextSendInterval != sendInterval {
				nextSendInterval = sendInterval
				updateStatsTicker.Reset(nextSendInterval)
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *Service) collectSystemStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	statsResult, err := s.statsService.GetSystemStats(ctx, &stats.GetSystemStatsQuery{})
	if err != nil {
		s.log.Error("Failed to get system stats", "error", err)
		return nil, err
	}

	m["stats.dashboards.count"] = statsResult.Dashboards
	m["stats.dashboard_bytes.total"] = statsResult.DashboardBytesTotal
	m["stats.dashboard_bytes.max"] = statsResult.DashboardBytesMax
	m["stats.users.count"] = statsResult.Users
	m["stats.admins.count"] = statsResult.Admins
	m["stats.editors.count"] = statsResult.Editors
	m["stats.viewers.count"] = statsResult.Viewers
	m["stats.orgs.count"] = statsResult.Orgs
	m["stats.playlist.count"] = statsResult.Playlists
	m["stats.plugins.apps.count"] = s.appCount(ctx)
	m["stats.plugins.panels.count"] = s.panelCount(ctx)
	m["stats.plugins.datasources.count"] = s.dataSourceCount(ctx)
	m["stats.plugins.sandboxed_plugins.count"] = s.sandboxCount(ctx)
	m["stats.alerts.count"] = statsResult.Alerts
	m["stats.active_users.count"] = statsResult.ActiveUsers
	m["stats.active_admins.count"] = statsResult.ActiveAdmins
	m["stats.active_editors.count"] = statsResult.ActiveEditors
	m["stats.active_viewers.count"] = statsResult.ActiveViewers
	m["stats.active_sessions.count"] = statsResult.ActiveSessions
	m["stats.monthly_active_users.count"] = statsResult.MonthlyActiveUsers
	m["stats.daily_active_users.count"] = statsResult.DailyActiveUsers
	m["stats.daily_active_admins.count"] = statsResult.DailyActiveAdmins
	m["stats.daily_active_editors.count"] = statsResult.DailyActiveEditors
	m["stats.daily_active_viewers.count"] = statsResult.DailyActiveViewers
	m["stats.daily_active_sessions.count"] = statsResult.DailyActiveSessions
	m["stats.datasources.count"] = statsResult.Datasources
	m["stats.stars.count"] = statsResult.Stars
	m["stats.folders.count"] = statsResult.Folders
	m["stats.dashboard_permissions.count"] = statsResult.DashboardPermissions
	m["stats.folder_permissions.count"] = statsResult.FolderPermissions
	m["stats.provisioned_dashboards.count"] = statsResult.ProvisionedDashboards
	m["stats.snapshots.count"] = statsResult.Snapshots
	m["stats.teams.count"] = statsResult.Teams
	m["stats.total_auth_token.count"] = statsResult.AuthTokens
	m["stats.dashboard_versions.count"] = statsResult.DashboardVersions
	m["stats.annotations.count"] = statsResult.Annotations
	m["stats.alert_rules.count"] = statsResult.AlertRules
	m["stats.rule_groups.count"] = statsResult.RuleGroups
	m["stats.library_panels.count"] = statsResult.LibraryPanels
	m["stats.library_variables.count"] = statsResult.LibraryVariables
	m["stats.dashboards_viewers_can_edit.count"] = statsResult.DashboardsViewersCanEdit
	m["stats.dashboards_viewers_can_admin.count"] = statsResult.DashboardsViewersCanAdmin
	m["stats.folders_viewers_can_edit.count"] = statsResult.FoldersViewersCanEdit
	m["stats.folders_viewers_can_admin.count"] = statsResult.FoldersViewersCanAdmin
	m["stats.api_keys.count"] = statsResult.APIKeys
	m["stats.data_keys.count"] = statsResult.DataKeys
	m["stats.active_data_keys.count"] = statsResult.ActiveDataKeys
	m["stats.public_dashboards.count"] = statsResult.PublicDashboards
	m["stats.correlations.count"] = statsResult.Correlations
	if statsResult.DatabaseCreatedTime != nil {
		m["stats.database.created.time"] = statsResult.DatabaseCreatedTime.Unix()
	}
	if statsResult.DatabaseDriver != "" {
		m["stats.database.driver"] = statsResult.DatabaseDriver
	}

	ossEditionCount := 1
	enterpriseEditionCount := 0
	cfg := s.settingsProvider.Get()
	if cfg.IsEnterprise {
		enterpriseEditionCount = 1
		ossEditionCount = 0
	}
	m["stats.edition.oss.count"] = ossEditionCount
	m["stats.edition.enterprise.count"] = enterpriseEditionCount

	userCount := statsResult.Users
	avgAuthTokensPerUser := statsResult.AuthTokens
	if userCount != 0 {
		avgAuthTokensPerUser /= userCount
	}

	m["stats.avg_auth_token_per_user.count"] = avgAuthTokensPerUser
	m["stats.packaging."+cfg.Packaging+".count"] = 1
	m["stats.distributor."+cfg.ReportingDistributor+".count"] = 1

	m["stats.uptime"] = int64(time.Since(s.startTime).Seconds())

	report, err := s.advisor.ReportSummary(ctx)
	if err != nil {
		s.log.Error("Failed to get advisor usage stats", "error", err)
	} else {
		m["stats.plugins.advisor.outdated_plugins"] = report.PluginsOutdated
		m["stats.plugins.advisor.deprecated_plugins"] = report.PluginsDeprecated
		m["stats.plugins.advisor.unhealthy_datasources"] = report.DatasourcesUnhealthy
	}

	featureUsageStats := s.features.GetUsageStats(ctx)
	for k, v := range featureUsageStats {
		m[k] = v
	}

	return m, nil
}

func (s *Service) collectAlertNotifierStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}
	// get stats about alert notifier usage
	anResult, err := s.statsService.GetAlertNotifiersUsageStats(ctx, &stats.GetAlertNotifierUsageStatsQuery{})
	if err != nil {
		s.log.Error("Failed to get alert notification stats", "error", err)
		return nil, err
	}

	for _, stats := range anResult {
		m["stats.alert_notifiers."+stats.Type+".count"] = stats.Count
	}
	return m, nil
}

func (s *Service) collectDatasourceStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}
	dsResult, err := s.statsService.GetDataSourceStats(ctx, &stats.GetDataSourceStatsQuery{})
	if err != nil {
		s.log.Error("Failed to get datasource stats", "error", err)
		return nil, err
	}

	// send counters for each data source
	// but ignore any custom data sources
	// as sending that name could be sensitive information
	dsOtherCount := 0
	for _, dsStat := range dsResult {
		if s.validator.ShouldBeReported(ctx, dsStat.Type) {
			m["stats.ds."+dsStat.Type+".count"] = dsStat.Count
		} else {
			dsOtherCount += dsStat.Count
		}
	}
	m["stats.ds.other.count"] = dsOtherCount

	return m, nil
}

func (s *Service) collectDatasourceAccess(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	// fetch datasource access stats
	dsAccessResult, err := s.statsService.GetDataSourceAccessStats(ctx, &stats.GetDataSourceAccessStatsQuery{})
	if err != nil {
		s.log.Error("Failed to get datasource access stats", "error", err)
		return nil, err
	}

	// send access counters for each data source
	// but ignore any custom data sources
	// as sending that name could be sensitive information
	dsAccessOtherCount := make(map[string]int64)
	for _, dsAccessStat := range dsAccessResult {
		if dsAccessStat.Access == "" {
			continue
		}

		access := strings.ToLower(dsAccessStat.Access)

		if s.validator.ShouldBeReported(ctx, dsAccessStat.Type) {
			m["stats.ds_access."+dsAccessStat.Type+"."+access+".count"] = dsAccessStat.Count
		} else {
			old := dsAccessOtherCount[access]
			dsAccessOtherCount[access] = old + dsAccessStat.Count
		}
	}

	for access, count := range dsAccessOtherCount {
		m["stats.ds_access.other."+access+".count"] = count
	}
	return m, nil
}

func (s *Service) updateTotalStats(ctx context.Context) bool {
	cfg := s.settingsProvider.Get()
	if !cfg.MetricsEndpointEnabled || cfg.MetricsEndpointDisableTotalStats {
		return false
	}

	statsResult, err := s.statsService.GetSystemStats(ctx, &stats.GetSystemStatsQuery{})
	if err != nil {
		s.log.Error("Failed to get system stats", "error", err)
		return false
	}

	if statsResult == nil {
		s.log.Error("Cannot retrieve system stats")
		return false
	}

	metrics.MStatTotalDashboards.Set(float64(statsResult.Dashboards))
	metrics.MStatTotalFolders.Set(float64(statsResult.Folders))
	metrics.MStatTotalUsers.Set(float64(statsResult.Users))
	metrics.MStatTotalTeams.Set(float64(statsResult.Teams))
	metrics.MStatActiveUsers.Set(float64(statsResult.ActiveUsers))
	metrics.MStatTotalPlaylists.Set(float64(statsResult.Playlists))
	metrics.MStatTotalOrgs.Set(float64(statsResult.Orgs))
	metrics.StatsTotalViewers.Set(float64(statsResult.Viewers))
	metrics.StatsTotalActiveViewers.Set(float64(statsResult.ActiveViewers))
	metrics.StatsTotalEditors.Set(float64(statsResult.Editors))
	metrics.StatsTotalActiveEditors.Set(float64(statsResult.ActiveEditors))
	metrics.StatsTotalAdmins.Set(float64(statsResult.Admins))
	metrics.StatsTotalActiveAdmins.Set(float64(statsResult.ActiveAdmins))
	metrics.StatsTotalDashboardVersions.Set(float64(statsResult.DashboardVersions))
	metrics.StatsTotalAnnotations.Set(float64(statsResult.Annotations))
	metrics.StatsTotalAlertRules.Set(float64(statsResult.AlertRules))
	metrics.StatsTotalRuleGroups.Set(float64(statsResult.RuleGroups))
	metrics.StatsTotalLibraryPanels.Set(float64(statsResult.LibraryPanels))

	metrics.StatsTotalDataKeys.With(prometheus.Labels{"active": "true"}).Set(float64(statsResult.ActiveDataKeys))
	inactiveDataKeys := statsResult.DataKeys - statsResult.ActiveDataKeys
	metrics.StatsTotalDataKeys.With(prometheus.Labels{"active": "false"}).Set(float64(inactiveDataKeys))

	metrics.MStatTotalPublicDashboards.Set(float64(statsResult.PublicDashboards))

	metrics.MStatTotalCorrelations.Set(float64(statsResult.Correlations))

	s.usageStats.SetReadyToReport(ctx)

	dsResult, err := s.statsService.GetDataSourceStats(ctx, &stats.GetDataSourceStatsQuery{})
	if err != nil {
		s.log.Error("Failed to get datasource stats", "error", err)
		return true
	}

	for _, dsStat := range dsResult {
		metrics.StatsTotalDataSources.WithLabelValues(dsStat.Type).Set(float64(dsStat.Count))
	}
	return true
}

func (s *Service) appCount(ctx context.Context) int {
	return len(s.plugins.Plugins(ctx, plugins.TypeApp))
}

func (s *Service) panelCount(ctx context.Context) int {
	return len(s.plugins.Plugins(ctx, plugins.TypePanel))
}

func (s *Service) dataSourceCount(ctx context.Context) int {
	return len(s.plugins.Plugins(ctx, plugins.TypeDataSource))
}

func (s *Service) sandboxCount(ctx context.Context) int {
	ps, err := s.sandbox.Plugins(ctx)
	if err != nil {
		s.log.Error("Failed to get sandboxed plugin count", "error", err)
		return 0
	}
	return len(ps)
}
