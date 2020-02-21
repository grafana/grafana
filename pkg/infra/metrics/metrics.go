package metrics

import (
	"runtime"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/setting"
)

const exporterName = "grafana"

var (
	// MInstanceStart is a metric counter for started instances
	MInstanceStart prometheus.Counter

	// MPageStatus is a metric page http response status
	MPageStatus *prometheus.CounterVec

	// MApiStatus is a metric api http response status
	MApiStatus *prometheus.CounterVec

	// MProxyStatus is a metric proxy http response status
	MProxyStatus *prometheus.CounterVec

	// MHttpRequestTotal is a metric http request counter
	MHttpRequestTotal *prometheus.CounterVec

	// MHttpRequestSummary is a metric http request summary
	MHttpRequestSummary *prometheus.SummaryVec

	// MApiUserSignUpStarted is a metric amount of users who started the signup flow
	MApiUserSignUpStarted prometheus.Counter

	// MApiUserSignUpCompleted is a metric amount of users who completed the signup flow
	MApiUserSignUpCompleted prometheus.Counter

	// MApiUserSignUpInvite is a metric amount of users who have been invited
	MApiUserSignUpInvite prometheus.Counter

	// MApiDashboardSave is a metric summary for dashboard save duration
	MApiDashboardSave prometheus.Summary

	// MApiDashboardGet is a metric summary for dashboard get duration
	MApiDashboardGet prometheus.Summary

	// MApiDashboardSearch is a metric summary for dashboard search duration
	MApiDashboardSearch prometheus.Summary

	// MApiAdminUserCreate is a metric api admin user created counter
	MApiAdminUserCreate prometheus.Counter

	// MApiLoginPost is a metric api login post counter
	MApiLoginPost prometheus.Counter

	// MApiLoginOAuth is a metric api login oauth counter
	MApiLoginOAuth prometheus.Counter

	// MApiLoginSAML is a metric api login SAML counter
	MApiLoginSAML prometheus.Counter

	// MApiOrgCreate is a metric api org created counter
	MApiOrgCreate prometheus.Counter

	// MApiDashboardSnapshotCreate is a metric dashboard snapshots created
	MApiDashboardSnapshotCreate prometheus.Counter

	// MApiDashboardSnapshotExternal is a metric external dashboard snapshots created
	MApiDashboardSnapshotExternal prometheus.Counter

	// MApiDashboardSnapshotGet is a metric loaded dashboards
	MApiDashboardSnapshotGet prometheus.Counter

	// MApiDashboardInsert is a metric dashboards inserted
	MApiDashboardInsert prometheus.Counter

	// MAlertingResultState is a metric alert execution result counter
	MAlertingResultState *prometheus.CounterVec

	// MAlertingNotificationSent is a metric counter for how many alert notifications been sent
	MAlertingNotificationSent *prometheus.CounterVec

	// MAlertingNotificationSent is a metric counter for how many alert notifications that failed
	MAlertingNotificationFailed *prometheus.CounterVec

	// MAwsCloudWatchGetMetricStatistics is a metric counter for getting metric statistics from aws
	MAwsCloudWatchGetMetricStatistics prometheus.Counter

	// MAwsCloudWatchListMetrics is a metric counter for getting list of metrics from aws
	MAwsCloudWatchListMetrics prometheus.Counter

	// MAwsCloudWatchGetMetricData is a metric counter for getting metric data time series from aws
	MAwsCloudWatchGetMetricData prometheus.Counter

	// MDBDataSourceQueryByID is a metric counter for getting datasource by id
	MDBDataSourceQueryByID prometheus.Counter

	// LDAPUsersSyncExecutionTime is a metric summary for LDAP users sync execution duration
	LDAPUsersSyncExecutionTime prometheus.Summary
)

// Timers
var (
	// MDataSourceProxyReqTimer is a metric summary for dataproxy request duration
	MDataSourceProxyReqTimer prometheus.Summary

	// MAlertingExecutionTime is a metric summary of alert exeuction duration
	MAlertingExecutionTime prometheus.Summary
)

// StatTotals
var (
	// MAlertingActiveAlerts is a metric amount of active alerts
	MAlertingActiveAlerts prometheus.Gauge

	// MStatTotalDashboards is a metric total amount of dashboards
	MStatTotalDashboards prometheus.Gauge

	// MStatTotalUsers is a metric total amount of users
	MStatTotalUsers prometheus.Gauge

	// MStatActiveUsers is a metric number of active users
	MStatActiveUsers prometheus.Gauge

	// MStatTotalOrgs is a metric total amount of orgs
	MStatTotalOrgs prometheus.Gauge

	// MStatTotalPlaylists is a metric total amount of playlists
	MStatTotalPlaylists prometheus.Gauge

	// StatsTotalViewers is a metric total amount of viewers
	StatsTotalViewers prometheus.Gauge

	// StatsTotalEditors is a metric total amount of editors
	StatsTotalEditors prometheus.Gauge

	// StatsTotalAdmins is a metric total amount of admins
	StatsTotalAdmins prometheus.Gauge

	// StatsTotalActiveViewers is a metric total amount of viewers
	StatsTotalActiveViewers prometheus.Gauge

	// StatsTotalActiveEditors is a metric total amount of active editors
	StatsTotalActiveEditors prometheus.Gauge

	// StatsTotalActiveAdmins is a metric total amount of active admins
	StatsTotalActiveAdmins prometheus.Gauge

	// grafanaBuildVersion is a metric with a constant '1' value labeled by version, revision, branch, and goversion from which Grafana was built
	grafanaBuildVersion *prometheus.GaugeVec

	grafanPluginBuildInfoDesc *prometheus.GaugeVec
)

func init() {
	httpStatusCodes := []string{"200", "404", "500", "unknown"}
	objectiveMap := map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001}

	MInstanceStart = prometheus.NewCounter(prometheus.CounterOpts{
		Name:      "instance_start_total",
		Help:      "counter for started instances",
		Namespace: exporterName,
	})

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
			Name:       "http_request_duration_milliseconds",
			Help:       "http request summary",
			Objectives: objectiveMap,
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
		Name:       "api_dashboard_save_milliseconds",
		Help:       "summary for dashboard save duration",
		Objectives: objectiveMap,
		Namespace:  exporterName,
	})

	MApiDashboardGet = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dashboard_get_milliseconds",
		Help:       "summary for dashboard get duration",
		Objectives: objectiveMap,
		Namespace:  exporterName,
	})

	MApiDashboardSearch = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dashboard_search_milliseconds",
		Help:       "summary for dashboard search duration",
		Objectives: objectiveMap,
		Namespace:  exporterName,
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

	MApiLoginSAML = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_login_saml_total",
		Help:      "api login saml counter",
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
		Help:      "counter for how many alert notifications have been sent",
		Namespace: exporterName,
	}, []string{"type"})

	MAlertingNotificationFailed = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name:      "alerting_notification_failed_total",
		Help:      "counter for how many alert notifications have failed",
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

	MDBDataSourceQueryByID = newCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "db_datasource_query_by_id_total",
		Help:      "counter for getting datasource by id",
		Namespace: exporterName,
	})

	LDAPUsersSyncExecutionTime = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "ldap_users_sync_execution_time",
		Help:       "summary for LDAP users sync execution duration",
		Objectives: objectiveMap,
		Namespace:  exporterName,
	})

	MDataSourceProxyReqTimer = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dataproxy_request_all_milliseconds",
		Help:       "summary for dataproxy request duration",
		Objectives: objectiveMap,
		Namespace:  exporterName,
	})

	MAlertingExecutionTime = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "alerting_execution_time_milliseconds",
		Help:       "summary of alert exeuction duration",
		Objectives: objectiveMap,
		Namespace:  exporterName,
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
		Help:      "A metric with a constant '1' value labeled by version, revision, branch, and goversion from which Grafana was built",
		Namespace: exporterName,
	}, []string{"version", "revision", "branch", "goversion", "edition"})

	grafanPluginBuildInfoDesc = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "plugin_build_info",
		Help:      "A metric with a constant '1' value labeled by pluginId, pluginType and version from which Grafana plugin was built",
		Namespace: exporterName,
	}, []string{"plugin_id", "plugin_type", "version"})
}

// SetBuildInformation sets the build information for this binary
func SetBuildInformation(version, revision, branch string) {
	edition := "oss"
	if setting.IsEnterprise {
		edition = "enterprise"
	}

	grafanaBuildVersion.WithLabelValues(version, revision, branch, runtime.Version(), edition).Set(1)
}

func SetPluginBuildInformation(pluginID, pluginType, version string) {
	grafanPluginBuildInfoDesc.WithLabelValues(pluginID, pluginType, version).Set(1)
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
		MApiLoginSAML,
		MApiOrgCreate,
		MApiDashboardSnapshotCreate,
		MApiDashboardSnapshotExternal,
		MApiDashboardSnapshotGet,
		MApiDashboardInsert,
		MAlertingResultState,
		MAlertingNotificationSent,
		MAlertingNotificationFailed,
		MAwsCloudWatchGetMetricStatistics,
		MAwsCloudWatchListMetrics,
		MAwsCloudWatchGetMetricData,
		MDBDataSourceQueryByID,
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
		grafanPluginBuildInfoDesc,
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
