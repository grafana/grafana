package metrics

import (
	"bytes"
	"encoding/json"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	M_Instance_Start                       Counter
	M_Page_Status_200                      Counter
	M_Page_Status_500                      Counter
	M_Page_Status_404                      Counter
	M_Page_Status_Unknown                  Counter
	M_Api_Status_200                       Counter
	M_Api_Status_404                       Counter
	M_Api_Status_500                       Counter
	M_Api_Status_Unknown                   Counter
	M_Proxy_Status_200                     Counter
	M_Proxy_Status_404                     Counter
	M_Proxy_Status_500                     Counter
	M_Proxy_Status_Unknown                 Counter
	M_Api_User_SignUpStarted               Counter
	M_Api_User_SignUpCompleted             Counter
	M_Api_User_SignUpInvite                Counter
	M_Api_Dashboard_Save                   Timer
	M_Api_Dashboard_Get                    Timer
	M_Api_Dashboard_Search                 Timer
	M_Api_Admin_User_Create                Counter
	M_Api_Login_Post                       Counter
	M_Api_Login_OAuth                      Counter
	M_Api_Org_Create                       Counter
	M_Api_Dashboard_Snapshot_Create        Counter
	M_Api_Dashboard_Snapshot_External      Counter
	M_Api_Dashboard_Snapshot_Get           Counter
	M_Models_Dashboard_Insert              Counter
	M_Alerting_Result_State_Alerting       Counter
	M_Alerting_Result_State_Ok             Counter
	M_Alerting_Result_State_Paused         Counter
	M_Alerting_Result_State_NoData         Counter
	M_Alerting_Result_State_Pending        Counter
	M_Alerting_Notification_Sent_Slack     Counter
	M_Alerting_Notification_Sent_Email     Counter
	M_Alerting_Notification_Sent_Webhook   Counter
	M_Alerting_Notification_Sent_DingDing  Counter
	M_Alerting_Notification_Sent_PagerDuty Counter
	M_Alerting_Notification_Sent_LINE      Counter
	M_Alerting_Notification_Sent_Victorops Counter
	M_Alerting_Notification_Sent_OpsGenie  Counter
	M_Alerting_Notification_Sent_Telegram  Counter
	M_Alerting_Notification_Sent_Threema   Counter
	M_Alerting_Notification_Sent_Sensu     Counter
	M_Alerting_Notification_Sent_Pushover  Counter
	M_Aws_CloudWatch_GetMetricStatistics   Counter
	M_Aws_CloudWatch_ListMetrics           Counter
	M_DB_DataSource_QueryById              Counter

	// Timers
	M_DataSource_ProxyReq_Timer Timer
	M_Alerting_Execution_Time   Timer

	// StatTotals
	M_Alerting_Active_Alerts Gauge
	M_StatTotal_Dashboards   Gauge
	M_StatTotal_Users        Gauge
	M_StatTotal_Orgs         Gauge
	M_StatTotal_Playlists    Gauge
)

func initMetricVars(settings *MetricSettings) {
	M_Instance_Start = RegCounter("instance_start")

	M_Page_Status_200 = RegCounter("page.resp_status", "code", "200")
	M_Page_Status_500 = RegCounter("page.resp_status", "code", "500")
	M_Page_Status_404 = RegCounter("page.resp_status", "code", "404")
	M_Page_Status_Unknown = RegCounter("page.resp_status", "code", "unknown")

	M_Api_Status_200 = RegCounter("api.resp_status", "code", "200")
	M_Api_Status_404 = RegCounter("api.resp_status", "code", "404")
	M_Api_Status_500 = RegCounter("api.resp_status", "code", "500")
	M_Api_Status_Unknown = RegCounter("api.resp_status", "code", "unknown")

	M_Proxy_Status_200 = RegCounter("proxy.resp_status", "code", "200")
	M_Proxy_Status_404 = RegCounter("proxy.resp_status", "code", "404")
	M_Proxy_Status_500 = RegCounter("proxy.resp_status", "code", "500")
	M_Proxy_Status_Unknown = RegCounter("proxy.resp_status", "code", "unknown")

	M_Api_User_SignUpStarted = RegCounter("api.user.signup_started")
	M_Api_User_SignUpCompleted = RegCounter("api.user.signup_completed")
	M_Api_User_SignUpInvite = RegCounter("api.user.signup_invite")

	M_Api_Dashboard_Save = RegTimer("api.dashboard.save")
	M_Api_Dashboard_Get = RegTimer("api.dashboard.get")
	M_Api_Dashboard_Search = RegTimer("api.dashboard.search")

	M_Api_Admin_User_Create = RegCounter("api.admin.user_create")
	M_Api_Login_Post = RegCounter("api.login.post")
	M_Api_Login_OAuth = RegCounter("api.login.oauth")
	M_Api_Org_Create = RegCounter("api.org.create")

	M_Api_Dashboard_Snapshot_Create = RegCounter("api.dashboard_snapshot.create")
	M_Api_Dashboard_Snapshot_External = RegCounter("api.dashboard_snapshot.external")
	M_Api_Dashboard_Snapshot_Get = RegCounter("api.dashboard_snapshot.get")

	M_Models_Dashboard_Insert = RegCounter("models.dashboard.insert")

	M_Alerting_Result_State_Alerting = RegCounter("alerting.result", "state", "alerting")
	M_Alerting_Result_State_Ok = RegCounter("alerting.result", "state", "ok")
	M_Alerting_Result_State_Paused = RegCounter("alerting.result", "state", "paused")
	M_Alerting_Result_State_NoData = RegCounter("alerting.result", "state", "no_data")
	M_Alerting_Result_State_Pending = RegCounter("alerting.result", "state", "pending")

	M_Alerting_Notification_Sent_Slack = RegCounter("alerting.notifications_sent", "type", "slack")
	M_Alerting_Notification_Sent_Email = RegCounter("alerting.notifications_sent", "type", "email")
	M_Alerting_Notification_Sent_Webhook = RegCounter("alerting.notifications_sent", "type", "webhook")
	M_Alerting_Notification_Sent_DingDing = RegCounter("alerting.notifications_sent", "type", "dingding")
	M_Alerting_Notification_Sent_PagerDuty = RegCounter("alerting.notifications_sent", "type", "pagerduty")
	M_Alerting_Notification_Sent_Victorops = RegCounter("alerting.notifications_sent", "type", "victorops")
	M_Alerting_Notification_Sent_OpsGenie = RegCounter("alerting.notifications_sent", "type", "opsgenie")
	M_Alerting_Notification_Sent_Telegram = RegCounter("alerting.notifications_sent", "type", "telegram")
	M_Alerting_Notification_Sent_Threema = RegCounter("alerting.notifications_sent", "type", "threema")
	M_Alerting_Notification_Sent_Sensu = RegCounter("alerting.notifications_sent", "type", "sensu")
	M_Alerting_Notification_Sent_LINE = RegCounter("alerting.notifications_sent", "type", "LINE")
	M_Alerting_Notification_Sent_Pushover = RegCounter("alerting.notifications_sent", "type", "pushover")

	M_Aws_CloudWatch_GetMetricStatistics = RegCounter("aws.cloudwatch.get_metric_statistics")
	M_Aws_CloudWatch_ListMetrics = RegCounter("aws.cloudwatch.list_metrics")

	M_DB_DataSource_QueryById = RegCounter("db.datasource.query_by_id")

	// Timers
	M_DataSource_ProxyReq_Timer = RegTimer("api.dataproxy.request.all")
	M_Alerting_Execution_Time = RegTimer("alerting.execution_time")

	// StatTotals
	M_Alerting_Active_Alerts = RegGauge("alerting.active_alerts")
	M_StatTotal_Dashboards = RegGauge("stat_totals", "stat", "dashboards")
	M_StatTotal_Users = RegGauge("stat_totals", "stat", "users")
	M_StatTotal_Orgs = RegGauge("stat_totals", "stat", "orgs")
	M_StatTotal_Playlists = RegGauge("stat_totals", "stat", "playlists")

	go instrumentationLoop(settings)
}

func instrumentationLoop(settings *MetricSettings) chan struct{} {
	M_Instance_Start.Inc(1)

	onceEveryDayTick := time.NewTicker(time.Hour * 24)
	secondTicker := time.NewTicker(time.Second * time.Duration(settings.IntervalSeconds))

	for {
		select {
		case <-onceEveryDayTick.C:
			sendUsageStats()
		case <-secondTicker.C:
			updateTotalStats()
		}
	}
}

func updateTotalStats() {
	// every interval also publish totals
	metricPublishCounter++
	if metricPublishCounter%10 == 0 {
		// get stats
		statsQuery := models.GetSystemStatsQuery{}
		if err := bus.Dispatch(&statsQuery); err != nil {
			metricsLogger.Error("Failed to get system stats", "error", err)
			return
		}

		M_StatTotal_Dashboards.Update(statsQuery.Result.Dashboards)
		M_StatTotal_Users.Update(statsQuery.Result.Users)
		M_StatTotal_Playlists.Update(statsQuery.Result.Playlists)
		M_StatTotal_Orgs.Update(statsQuery.Result.Orgs)
	}
}

func sendUsageStats() {
	if !setting.ReportingEnabled {
		return
	}

	metricsLogger.Debug("Sending anonymous usage stats to stats.grafana.org")

	version := strings.Replace(setting.BuildVersion, ".", "_", -1)

	metrics := map[string]interface{}{}
	report := map[string]interface{}{
		"version": version,
		"metrics": metrics,
		"os":      runtime.GOOS,
		"arch":    runtime.GOARCH,
	}

	statsQuery := models.GetSystemStatsQuery{}
	if err := bus.Dispatch(&statsQuery); err != nil {
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

	dsStats := models.GetDataSourceStatsQuery{}
	if err := bus.Dispatch(&dsStats); err != nil {
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

	out, _ := json.MarshalIndent(report, "", " ")
	data := bytes.NewBuffer(out)

	client := http.Client{Timeout: time.Duration(5 * time.Second)}
	go client.Post("https://stats.grafana.org/grafana-usage-report", "application/json", data)
}
