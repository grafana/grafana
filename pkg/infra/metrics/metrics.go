package metrics

import (
	"runtime"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/prometheus/client_golang/prometheus"
)

const exporterName = "grafana"

var (
	MInstanceStart       prometheus.Counter
	MPageStatus          *prometheus.CounterVec
	MApiStatus           *prometheus.CounterVec
	MProxyStatus         *prometheus.CounterVec
	MHttpRequestTotal   *prometheus.CounterVec
	MHttpRequestSummary *prometheus.SummaryVec

	MApiUserSignUpStarted   prometheus.Counter
	MApiUserSignUpCompleted prometheus.Counter
	MApiUserSignUpInvite    prometheus.Counter
	MApiDashboardSave       prometheus.Summary
	MApiDashboardGet        prometheus.Summary
	MApiDashboardSearch     prometheus.Summary
	MApiAdminUserCreate    prometheus.Counter
	MApiLoginPost           prometheus.Counter
	MApiLoginOAuth          prometheus.Counter
	MApiOrgCreate           prometheus.Counter

	MApiDashboardSnapshotCreate      prometheus.Counter
	MApiDashboardSnapshotExternal    prometheus.Counter
	MApiDashboardSnapshotGet         prometheus.Counter
	MApiDashboardInsert               prometheus.Counter
	MAlertingResultState              *prometheus.CounterVec
	MAlertingNotificationSent         *prometheus.CounterVec
	MAwsCloudWatchGetMetricStatistics prometheus.Counter
	MAwsCloudWatchListMetrics         prometheus.Counter
	MAwsCloudWatchGetMetricData       prometheus.Counter
	MDBDataSourceQueryById            prometheus.Counter

	// LDAPUsersSyncExecutionTime is a metric for
	// how much time it took to sync the LDAP users
	LDAPUsersSyncExecutionTime prometheus.Summary

	// Timers
	MDataSourceProxyReqTimer prometheus.Summary
	MAlertingExecutionTime   prometheus.Summary
)

// StatTotals
var (
	MAlertingActiveAlerts prometheus.Gauge
	MStatTotalDashboards   prometheus.Gauge
	MStatTotalUsers        prometheus.Gauge
	MStatActiveUsers       prometheus.Gauge
	MStatTotalOrgs         prometheus.Gauge
	MStatTotalPlaylists    prometheus.Gauge

	StatsTotalViewers       prometheus.Gauge
	StatsTotalEditors       prometheus.Gauge
	StatsTotalAdmins        prometheus.Gauge
	StatsTotalActiveViewers prometheus.Gauge
	StatsTotalActiveEditors prometheus.Gauge
	StatsTotalActiveAdmins  prometheus.Gauge

	// grafanaBuildVersion is a gauge that contains build info about this binary
	grafanaBuildVersion *prometheus.GaugeVec
)

func init() {
	MInstanceStart = prometheus.NewCounter(prometheus.CounterOpts{
		Name:      "instance_start_total",
		Help:      "counter for started instances",
		Namespace: exporterName,
	})

	httpStatusCodes := []string{"200", "404", "500", "unknown"}
	MPageStatus = newCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Name:      "page_response_status_total",
			Help:      "page http response status",
			Namespace: exporterName,
		}, []string{"code"}, httpStatusCodes...)

	MApiStatus = newCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Name:      "api_response_status_total",
			Help:      "api http response status",
			Namespace: exporterName,
		}, []string{"code"}, httpStatusCodes...)

	MProxyStatus = newCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Name:      "proxy_response_status_total",
			Help:      "proxy http response status",
			Namespace: exporterName,
		}, []string{"code"}, httpStatusCodes...)

	MHttpRequestTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_request_total",
			Help: "http request counter",
		},
		[]string{"handler", "statuscode", "method"},
	)

	MHttpRequestSummary = prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name: "http_request_duration_milliseconds",
			Help: "http request summary",
		},
		[]string{"handler", "statuscode", "method"},
	)

	MApiUserSignUpStarted = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_user_signup_started_total",
		Help:      "amount of users who started the signup flow",
		Namespace: exporterName,
	})

	MApiUserSignUpCompleted = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_user_signup_completed_total",
		Help:      "amount of users who completed the signup flow",
		Namespace: exporterName,
	})

	MApiUserSignUpInvite = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_user_signup_invite_total",
		Help:      "amount of users who have been invited",
		Namespace: exporterName,
	})

	MApiDashboardSave = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:      "api_dashboard_save_milliseconds",
		Help:      "summary for dashboard save duration",
		Namespace: exporterName,
	})

	MApiDashboardGet = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:      "api_dashboard_get_milliseconds",
		Help:      "summary for dashboard get duration",
		Namespace: exporterName,
	})

	MApiDashboardSearch = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:      "api_dashboard_search_milliseconds",
		Help:      "summary for dashboard search duration",
		Namespace: exporterName,
	})

	MApiAdminUserCreate = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_admin_user_created_total",
		Help:      "api admin user created counter",
		Namespace: exporterName,
	})

	MApiLoginPost = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_login_post_total",
		Help:      "api login post counter",
		Namespace: exporterName,
	})

	MApiLoginOAuth = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_login_oauth_total",
		Help:      "api login oauth counter",
		Namespace: exporterName,
	})

	MApiOrgCreate = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_org_create_total",
		Help:      "api org created counter",
		Namespace: exporterName,
	})

	MApiDashboardSnapshotCreate = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_dashboard_snapshot_create_total",
		Help:      "dashboard snapshots created",
		Namespace: exporterName,
	})

	MApiDashboardSnapshotExternal = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_dashboard_snapshot_external_total",
		Help:      "external dashboard snapshots created",
		Namespace: exporterName,
	})

	MApiDashboardSnapshotGet = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_dashboard_snapshot_get_total",
		Help:      "loaded dashboards",
		Namespace: exporterName,
	})

	MApiDashboardInsert = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_models_dashboard_insert_total",
		Help:      "dashboards inserted ",
		Namespace: exporterName,
	})

	MAlertingResultState = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name:      "alerting_result_total",
		Help:      "alert execution result counter",
		Namespace: exporterName,
	}, []string{"state"})

	MAlertingNotificationSent = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name:      "alerting_notification_sent_total",
		Help:      "counter for how many alert notifications been sent",
		Namespace: exporterName,
	}, []string{"type"})

	MAwsCloudWatchGetMetricStatistics = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "aws_cloudwatch_get_metric_statistics_total",
		Help:      "counter for getting metric statistics from aws",
		Namespace: exporterName,
	})

	MAwsCloudWatchListMetrics = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "aws_cloudwatch_list_metrics_total",
		Help:      "counter for getting list of metrics from aws",
		Namespace: exporterName,
	})

	MAwsCloudWatchGetMetricData = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "aws_cloudwatch_get_metric_data_total",
		Help:      "counter for getting metric data time series from aws",
		Namespace: exporterName,
	})

	MDBDataSourceQueryById = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "db_datasource_query_by_id_total",
		Help:      "counter for getting datasource by id",
		Namespace: exporterName,
	})

	LDAPUsersSyncExecutionTime = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:      "ldap_users_sync_execution_time",
		Help:      "summary for LDAP users sync execution duration",
		Namespace: exporterName,
	})

	MDataSourceProxyReqTimer = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:      "api_dataproxy_request_all_milliseconds",
		Help:      "summary for dataproxy request duration",
		Namespace: exporterName,
	})

	MAlertingExecutionTime = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:      "alerting_execution_time_milliseconds",
		Help:      "summary of alert exeuction duration",
		Namespace: exporterName,
	})

	MAlertingActiveAlerts = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "alerting_active_alerts",
		Help:      "amount of active alerts",
		Namespace: exporterName,
	})

	MStatTotalDashboards = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_dashboard",
		Help:      "total amount of dashboards",
		Namespace: exporterName,
	})

	MStatTotalUsers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_users",
		Help:      "total amount of users",
		Namespace: exporterName,
	})

	MStatActiveUsers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_active_users",
		Help:      "number of active users",
		Namespace: exporterName,
	})

	MStatTotalOrgs = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_orgs",
		Help:      "total amount of orgs",
		Namespace: exporterName,
	})

	MStatTotalPlaylists = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_playlists",
		Help:      "total amount of playlists",
		Namespace: exporterName,
	})

	StatsTotalViewers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_viewers",
		Help:      "total amount of viewers",
		Namespace: exporterName,
	})

	StatsTotalEditors = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_editors",
		Help:      "total amount of editors",
		Namespace: exporterName,
	})

	StatsTotalAdmins = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_admins",
		Help:      "total amount of admins",
		Namespace: exporterName,
	})

	StatsTotalActiveViewers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_active_viewers",
		Help:      "total amount of viewers",
		Namespace: exporterName,
	})

	StatsTotalActiveEditors = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_active_editors",
		Help:      "total amount of active editors",
		Namespace: exporterName,
	})

	StatsTotalActiveAdmins = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_active_admins",
		Help:      "total amount of active admins",
		Namespace: exporterName,
	})

	grafanaBuildVersion = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "build_info",
		Help:      "A metric with a constant '1' value labeled by version, revision, branch, and goversion from which Grafana was built.",
		Namespace: exporterName,
	}, []string{"version", "revision", "branch", "goversion", "edition"})
}

// SetBuildInformation sets the build information for this binary
func SetBuildInformation(version, revision, branch string) {
	edition := "oss"
	if setting.IsEnterprise {
		edition = "enterprise"
	}

	grafanaBuildVersion.WithLabelValues(version, revision, branch, runtime.Version(), edition).Set(1)
}

func initMetricVars() {
	prometheus.MustRegister(
		MInstanceStart,
		MPageStatus,
		MApiStatus,
		MProxyStatus,
		MHttpRequestTotal,
		MHttpRequestSummary,
		MApiUserSignUpStarted,
		MApiUserSignUpCompleted,
		MApiUserSignUpInvite,
		MApiDashboardSave,
		MApiDashboardGet,
		MApiDashboardSearch,
		MDataSourceProxyReqTimer,
		MAlertingExecutionTime,
		MApiAdminUserCreate,
		MApiLoginPost,
		MApiLoginOAuth,
		MApiOrgCreate,
		MApiDashboardSnapshotCreate,
		MApiDashboardSnapshotExternal,
		MApiDashboardSnapshotGet,
		MApiDashboardInsert,
		MAlertingResultState,
		MAlertingNotificationSent,
		MAwsCloudWatchGetMetricStatistics,
		MAwsCloudWatchListMetrics,
		MAwsCloudWatchGetMetricData,
		MDBDataSourceQueryById,
		LDAPUsersSyncExecutionTime,
		MAlertingActiveAlerts,
		MStatTotalDashboards,
		MStatTotalUsers,
		MStatActiveUsers,
		MStatTotalOrgs,
		MStatTotalPlaylists,
		StatsTotalViewers,
		StatsTotalEditors,
		StatsTotalAdmins,
		StatsTotalActiveViewers,
		StatsTotalActiveEditors,
		StatsTotalActiveAdmins,
		grafanaBuildVersion,
	)

}

func newCounterVecStartingAtZero(opts prometheus.CounterOpts, labels []string, labelValues ...string) *prometheus.CounterVec {
	counter := prometheus.NewCounterVec(opts, labels)

	for _, label := range labelValues {
		counter.WithLabelValues(label).Add(0)
	}

	return counter
}

func newCounterStartingAtZero(opts prometheus.CounterOpts, labelValues ...string) prometheus.Counter {
	counter := prometheus.NewCounter(opts)
	counter.Add(0)

	return counter
}
