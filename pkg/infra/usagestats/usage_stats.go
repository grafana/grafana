package usagestats

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var usageStatsURL = "https://stats.grafana.org/grafana-usage-report"

func (uss *UsageStatsService) sendUsageStats(oauthProviders map[string]bool) {
	if !setting.ReportingEnabled {
		return
	}

	metricsLogger.Debug(fmt.Sprintf("Sending anonymous usage stats to %s", usageStatsURL))

	version := strings.Replace(setting.BuildVersion, ".", "_", -1)

	metrics := map[string]interface{}{}
	report := map[string]interface{}{
		"version":         version,
		"metrics":         metrics,
		"os":              runtime.GOOS,
		"arch":            runtime.GOARCH,
		"edition":         getEdition(),
		"hasValidLicense": uss.License.HasValidLicense(),
		"packaging":       setting.Packaging,
	}

	statsQuery := models.GetSystemStatsQuery{}
	if err := uss.Bus.Dispatch(&statsQuery); err != nil {
		metricsLogger.Error("Failed to get system stats", "error", err)
		return
	}

	metrics["stats.dashboards.count"] = statsQuery.Result.Dashboards
	metrics["stats.users.count"] = statsQuery.Result.Users
	metrics["stats.orgs.count"] = statsQuery.Result.Orgs
	metrics["stats.playlist.count"] = statsQuery.Result.Playlists
	metrics["stats.plugins.apps.count"] = len(plugins.Apps)
	metrics["stats.plugins.panels.count"] = len(plugins.Panels)
	metrics["stats.plugins.datasources.count"] = len(plugins.DataSources)
	metrics["stats.alerts.count"] = statsQuery.Result.Alerts
	metrics["stats.active_users.count"] = statsQuery.Result.ActiveUsers
	metrics["stats.datasources.count"] = statsQuery.Result.Datasources
	metrics["stats.stars.count"] = statsQuery.Result.Stars
	metrics["stats.folders.count"] = statsQuery.Result.Folders
	metrics["stats.dashboard_permissions.count"] = statsQuery.Result.DashboardPermissions
	metrics["stats.folder_permissions.count"] = statsQuery.Result.FolderPermissions
	metrics["stats.provisioned_dashboards.count"] = statsQuery.Result.ProvisionedDashboards
	metrics["stats.snapshots.count"] = statsQuery.Result.Snapshots
	metrics["stats.teams.count"] = statsQuery.Result.Teams
	metrics["stats.total_auth_token.count"] = statsQuery.Result.AuthTokens
	metrics["stats.dashboard_versions.count"] = statsQuery.Result.DashboardVersions
	metrics["stats.annotations.count"] = statsQuery.Result.Annotations
	metrics["stats.valid_license.count"] = getValidLicenseCount(uss.License.HasValidLicense())
	metrics["stats.edition.oss.count"] = getOssEditionCount()
	metrics["stats.edition.enterprise.count"] = getEnterpriseEditionCount()

	userCount := statsQuery.Result.Users
	avgAuthTokensPerUser := statsQuery.Result.AuthTokens
	if userCount != 0 {
		avgAuthTokensPerUser /= userCount
	}

	metrics["stats.avg_auth_token_per_user.count"] = avgAuthTokensPerUser

	dsStats := models.GetDataSourceStatsQuery{}
	if err := uss.Bus.Dispatch(&dsStats); err != nil {
		metricsLogger.Error("Failed to get datasource stats", "error", err)
		return
	}

	// send counters for each data source
	// but ignore any custom data sources
	// as sending that name could be sensitive information
	dsOtherCount := 0
	for _, dsStat := range dsStats.Result {
		if models.IsKnownDataSourcePlugin(dsStat.Type) {
			metrics["stats.ds."+dsStat.Type+".count"] = dsStat.Count
		} else {
			dsOtherCount += dsStat.Count
		}
	}
	metrics["stats.ds.other.count"] = dsOtherCount

	metrics["stats.packaging."+setting.Packaging+".count"] = 1

	// Alerting stats
	alertingUsageStats, err := uss.AlertingUsageStats.QueryUsageStats()
	if err != nil {
		uss.log.Error("Failed to get alerting usage stats", "error", err)
		return
	}

	var addAlertingUsageStats = func(dsType string, usageCount int) {
		metrics[fmt.Sprintf("stats.alerting.ds.%s.count", dsType)] = usageCount
	}

	alertingOtherCount := 0
	for dsType, usageCount := range alertingUsageStats.DatasourceUsage {
		if models.IsKnownDataSourcePlugin(dsType) {
			addAlertingUsageStats(dsType, usageCount)
		} else {
			alertingOtherCount += usageCount
		}
	}

	addAlertingUsageStats("other", alertingOtherCount)

	// fetch datasource access stats
	dsAccessStats := models.GetDataSourceAccessStatsQuery{}
	if err := uss.Bus.Dispatch(&dsAccessStats); err != nil {
		metricsLogger.Error("Failed to get datasource access stats", "error", err)
		return
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

		if models.IsKnownDataSourcePlugin(dsAccessStat.Type) {
			metrics["stats.ds_access."+dsAccessStat.Type+"."+access+".count"] = dsAccessStat.Count
		} else {
			old := dsAccessOtherCount[access]
			dsAccessOtherCount[access] = old + dsAccessStat.Count
		}
	}

	for access, count := range dsAccessOtherCount {
		metrics["stats.ds_access.other."+access+".count"] = count
	}

	// get stats about alert notifier usage
	anStats := models.GetAlertNotifierUsageStatsQuery{}
	if err := uss.Bus.Dispatch(&anStats); err != nil {
		metricsLogger.Error("Failed to get alert notification stats", "error", err)
		return
	}

	for _, stats := range anStats.Result {
		metrics["stats.alert_notifiers."+stats.Type+".count"] = stats.Count
	}

	// Add stats about auth configuration
	authTypes := map[string]bool{}
	authTypes["anonymous"] = setting.AnonymousEnabled
	authTypes["basic_auth"] = setting.BasicAuthEnabled
	authTypes["ldap"] = setting.LDAPEnabled
	authTypes["auth_proxy"] = setting.AuthProxyEnabled

	for provider, enabled := range oauthProviders {
		authTypes["oauth_"+provider] = enabled
	}

	for authType, enabled := range authTypes {
		enabledValue := 0
		if enabled {
			enabledValue = 1
		}
		metrics["stats.auth_enabled."+authType+".count"] = enabledValue
	}

	out, _ := json.MarshalIndent(report, "", " ")
	data := bytes.NewBuffer(out)

	client := http.Client{Timeout: 5 * time.Second}
	go func() {
		resp, err := client.Post(usageStatsURL, "application/json", data)
		if err != nil {
			metricsLogger.Error("Failed to send usage stats", "err", err)
			return
		}
		resp.Body.Close()
	}()
}

func (uss *UsageStatsService) updateTotalStats() {
	if !uss.Cfg.MetricsEndpointEnabled || uss.Cfg.MetricsEndpointDisableTotalStats {
		return
	}

	statsQuery := models.GetSystemStatsQuery{}
	if err := uss.Bus.Dispatch(&statsQuery); err != nil {
		metricsLogger.Error("Failed to get system stats", "error", err)
		return
	}

	metrics.MStatTotalDashboards.Set(float64(statsQuery.Result.Dashboards))
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

	dsStats := models.GetDataSourceStatsQuery{}
	if err := uss.Bus.Dispatch(&dsStats); err != nil {
		metricsLogger.Error("Failed to get datasource stats", "error", err)
		return
	}

	for _, dsStat := range dsStats.Result {
		metrics.StatsTotalDataSources.WithLabelValues(dsStat.Type).Set(float64(dsStat.Count))
	}
}

func getEdition() string {
	edition := "oss"
	if setting.IsEnterprise {
		edition = "enterprise"
	}

	return edition
}

func getEnterpriseEditionCount() int {
	if setting.IsEnterprise {
		return 1
	}
	return 0
}

func getOssEditionCount() int {
	if setting.IsEnterprise {
		return 0
	}
	return 1
}

func getValidLicenseCount(validLicense bool) int {
	if validLicense {
		return 1
	}
	return 0
}
