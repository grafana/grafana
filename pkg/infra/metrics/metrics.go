package metrics

import (
	"runtime"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	pubdash "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/setting"
)

// ExporterName is used as namespace for exposing prometheus metrics
const ExporterName = "grafana"

var (
	// MInstanceStart is a metric counter for started instances
	MInstanceStart prometheus.Counter

	// MPageStatus is a metric page http response status
	MPageStatus *prometheus.CounterVec

	// MApiStatus is a metric api http response status
	MApiStatus *prometheus.CounterVec

	// MProxyStatus is a metric proxy http response status
	MProxyStatus *prometheus.CounterVec

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

	// MRenderingRequestTotal is a metric counter for image rendering requests
	MRenderingRequestTotal *prometheus.CounterVec

	// MRenderingQueue is a metric gauge for image rendering queue size
	MRenderingQueue prometheus.Gauge

	// MAccessEvaluationCount is a metric gauge for total number of evaluation requests
	MAccessEvaluationCount prometheus.Counter

	// MPublicDashboardRequestCount is a metric counter for public dashboards requests
	MPublicDashboardRequestCount prometheus.Counter

	// MPublicDashboardDatasourceQuerySuccess is a metric counter for successful queries labelled by datasource
	MPublicDashboardDatasourceQuerySuccess *prometheus.CounterVec
)

// Timers
var (
	// MDataSourceProxyReqTimer is a metric summary for dataproxy request duration
	MDataSourceProxyReqTimer prometheus.Summary

	// MAlertingExecutionTime is a metric summary of alert execution duration
	MAlertingExecutionTime prometheus.Summary

	// MRenderingSummary is a metric summary for image rendering request duration
	MRenderingSummary *prometheus.SummaryVec

	// MRenderingUserLookupSummary is a metric summary for image rendering user lookup duration
	MRenderingUserLookupSummary *prometheus.SummaryVec

	// MAccessPermissionsSummary is a metric summary for loading permissions request duration when evaluating access
	MAccessPermissionsSummary prometheus.Histogram

	// MAccessEvaluationsSummary is a metric summary for loading permissions request duration when evaluating access
	MAccessEvaluationsSummary prometheus.Histogram
)

// StatTotals
var (
	// MAlertingActiveAlerts is a metric amount of active alerts
	MAlertingActiveAlerts prometheus.Gauge

	// MStatTotalDashboards is a metric total amount of dashboards
	MStatTotalDashboards prometheus.Gauge

	// MStatTotalFolders is a metric total amount of folders
	MStatTotalFolders prometheus.Gauge

	// MStatTotalUsers is a metric total amount of users
	MStatTotalUsers prometheus.Gauge

	// MStatTotalTeams is a metric total amount of teams
	MStatTotalTeams prometheus.Gauge

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

	// StatsTotalDataSources is a metric total number of defined datasources, labeled by pluginId
	StatsTotalDataSources *prometheus.GaugeVec

	// StatsTotalAnnotations is a metric of total number of annotations stored in Grafana.
	StatsTotalAnnotations prometheus.Gauge

	// StatsTotalAlertRules is a metric of total number of alert rules stored in Grafana.
	StatsTotalAlertRules prometheus.Gauge

	// StatsTotalDashboardVersions is a metric of total number of dashboard versions stored in Grafana.
	StatsTotalDashboardVersions prometheus.Gauge

	grafanaPluginBuildInfoDesc *prometheus.GaugeVec

	// StatsTotalLibraryPanels is a metric of total number of library panels stored in Grafana.
	StatsTotalLibraryPanels prometheus.Gauge

	// StatsTotalLibraryVariables is a metric of total number of library variables stored in Grafana.
	StatsTotalLibraryVariables prometheus.Gauge

	// StatsTotalDataKeys is a metric of total number of data keys stored in Grafana.
	StatsTotalDataKeys *prometheus.GaugeVec

	// MStatTotalPublicDashboards is a metric total amount of public dashboards
	MStatTotalPublicDashboards prometheus.Gauge
)

func init() {
	httpStatusCodes := []string{"200", "404", "500", "unknown"}
	objectiveMap := map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001}

	MInstanceStart = prometheus.NewCounter(prometheus.CounterOpts{
		Name:      "instance_start_total",
		Help:      "counter for started instances",
		Namespace: ExporterName,
	})

	MPageStatus = metricutil.NewCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Name:      "page_response_status_total",
			Help:      "page http response status",
			Namespace: ExporterName,
		}, []string{"code"}, map[string][]string{"code": httpStatusCodes})

	MApiStatus = metricutil.NewCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Name:      "api_response_status_total",
			Help:      "api http response status",
			Namespace: ExporterName,
		}, []string{"code"}, map[string][]string{"code": httpStatusCodes})

	MProxyStatus = metricutil.NewCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Name:      "proxy_response_status_total",
			Help:      "proxy http response status",
			Namespace: ExporterName,
		}, []string{"code"}, map[string][]string{"code": httpStatusCodes})

	MApiUserSignUpStarted = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_user_signup_started_total",
		Help:      "amount of users who started the signup flow",
		Namespace: ExporterName,
	})

	MApiUserSignUpCompleted = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_user_signup_completed_total",
		Help:      "amount of users who completed the signup flow",
		Namespace: ExporterName,
	})

	MApiUserSignUpInvite = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_user_signup_invite_total",
		Help:      "amount of users who have been invited",
		Namespace: ExporterName,
	})

	MApiDashboardSave = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dashboard_save_milliseconds",
		Help:       "summary for dashboard save duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MApiDashboardGet = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dashboard_get_milliseconds",
		Help:       "summary for dashboard get duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MApiDashboardSearch = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dashboard_search_milliseconds",
		Help:       "summary for dashboard search duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MApiAdminUserCreate = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_admin_user_created_total",
		Help:      "api admin user created counter",
		Namespace: ExporterName,
	})

	MApiLoginPost = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_login_post_total",
		Help:      "api login post counter",
		Namespace: ExporterName,
	})

	MApiLoginOAuth = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_login_oauth_total",
		Help:      "api login oauth counter",
		Namespace: ExporterName,
	})

	MApiLoginSAML = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_login_saml_total",
		Help:      "api login saml counter",
		Namespace: ExporterName,
	})

	MApiOrgCreate = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_org_create_total",
		Help:      "api org created counter",
		Namespace: ExporterName,
	})

	MApiDashboardSnapshotCreate = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_dashboard_snapshot_create_total",
		Help:      "dashboard snapshots created",
		Namespace: ExporterName,
	})

	MApiDashboardSnapshotExternal = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_dashboard_snapshot_external_total",
		Help:      "external dashboard snapshots created",
		Namespace: ExporterName,
	})

	MApiDashboardSnapshotGet = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_dashboard_snapshot_get_total",
		Help:      "loaded dashboards",
		Namespace: ExporterName,
	})

	MApiDashboardInsert = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_models_dashboard_insert_total",
		Help:      "dashboards inserted ",
		Namespace: ExporterName,
	})

	MAlertingResultState = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name:      "alerting_result_total",
		Help:      "alert execution result counter",
		Namespace: ExporterName,
	}, []string{"state"})

	MAlertingNotificationSent = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name:      "alerting_notification_sent_total",
		Help:      "counter for how many alert notifications have been sent",
		Namespace: ExporterName,
	}, []string{"type"})

	MAlertingNotificationFailed = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name:      "alerting_notification_failed_total",
		Help:      "counter for how many alert notifications have failed",
		Namespace: ExporterName,
	}, []string{"type"})

	MAwsCloudWatchGetMetricStatistics = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "aws_cloudwatch_get_metric_statistics_total",
		Help:      "counter for getting metric statistics from aws",
		Namespace: ExporterName,
	})

	MAwsCloudWatchListMetrics = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "aws_cloudwatch_list_metrics_total",
		Help:      "counter for getting list of metrics from aws",
		Namespace: ExporterName,
	})

	MAwsCloudWatchGetMetricData = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "aws_cloudwatch_get_metric_data_total",
		Help:      "counter for getting metric data time series from aws",
		Namespace: ExporterName,
	})

	MDBDataSourceQueryByID = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "db_datasource_query_by_id_total",
		Help:      "counter for getting datasource by id",
		Namespace: ExporterName,
	})

	LDAPUsersSyncExecutionTime = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "ldap_users_sync_execution_time",
		Help:       "summary for LDAP users sync execution duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MRenderingRequestTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "rendering_request_total",
			Help:      "counter for rendering requests",
			Namespace: ExporterName,
		},
		[]string{"status", "type"},
	)

	MRenderingSummary = prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name:       "rendering_request_duration_milliseconds",
			Help:       "summary of rendering request duration",
			Objectives: objectiveMap,
			Namespace:  ExporterName,
		},
		[]string{"status", "type"},
	)

	MRenderingUserLookupSummary = prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name:       "rendering_user_lookup_duration_milliseconds",
			Help:       "summary of rendering user lookup duration",
			Objectives: objectiveMap,
			Namespace:  ExporterName,
		},
		[]string{"success", "from"},
	)

	MRenderingQueue = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "rendering_queue_size",
		Help:      "size of rendering queue",
		Namespace: ExporterName,
	})

	MDataSourceProxyReqTimer = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dataproxy_request_all_milliseconds",
		Help:       "summary for dataproxy request duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MAlertingExecutionTime = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "alerting_execution_time_milliseconds",
		Help:       "summary of alert execution duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MAlertingActiveAlerts = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "alerting_active_alerts",
		Help:      "amount of active alerts",
		Namespace: ExporterName,
	})

	MPublicDashboardRequestCount = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "public_dashboard_request_count",
		Help:      "counter for public dashboards requests",
		Namespace: ExporterName,
	})

	MPublicDashboardDatasourceQuerySuccess = metricutil.NewCounterVecStartingAtZero(prometheus.CounterOpts{
		Name:      "public_dashboard_datasource_query_success",
		Help:      "counter for queries to public dashboard datasources labelled by datasource type and success status success/failed",
		Namespace: ExporterName,
	}, []string{"datasource", "status"}, map[string][]string{"status": pubdash.QueryResultStatuses})

	MStatTotalDashboards = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_dashboard",
		Help:      "total amount of dashboards",
		Namespace: ExporterName,
	})

	MStatTotalFolders = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_folder",
		Help:      "total amount of folders",
		Namespace: ExporterName,
	})

	MStatTotalUsers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_users",
		Help:      "total amount of users",
		Namespace: ExporterName,
	})

	MStatTotalTeams = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_teams",
		Help:      "total amount of teams",
		Namespace: ExporterName,
	})

	MStatActiveUsers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_active_users",
		Help:      "number of active users",
		Namespace: ExporterName,
	})

	MStatTotalOrgs = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_orgs",
		Help:      "total amount of orgs",
		Namespace: ExporterName,
	})

	MStatTotalPlaylists = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_playlists",
		Help:      "total amount of playlists",
		Namespace: ExporterName,
	})

	StatsTotalViewers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_viewers",
		Help:      "total amount of viewers",
		Namespace: ExporterName,
	})

	StatsTotalEditors = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_editors",
		Help:      "total amount of editors",
		Namespace: ExporterName,
	})

	StatsTotalAdmins = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_admins",
		Help:      "total amount of admins",
		Namespace: ExporterName,
	})

	StatsTotalActiveViewers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_active_viewers",
		Help:      "total amount of viewers",
		Namespace: ExporterName,
	})

	StatsTotalActiveEditors = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_active_editors",
		Help:      "total amount of active editors",
		Namespace: ExporterName,
	})

	StatsTotalActiveAdmins = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_active_admins",
		Help:      "total amount of active admins",
		Namespace: ExporterName,
	})

	StatsTotalDataSources = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "stat_totals_datasource",
		Help:      "total number of defined datasources, labeled by pluginId",
		Namespace: ExporterName,
	}, []string{"plugin_id"})

	grafanaPluginBuildInfoDesc = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "plugin_build_info",
		Help:      "A metric with a constant '1' value labeled by pluginId, pluginType and version from which Grafana plugin was built",
		Namespace: ExporterName,
	}, []string{"plugin_id", "plugin_type", "version", "signature_status"})

	StatsTotalDashboardVersions = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_dashboard_versions",
		Help:      "total amount of dashboard versions in the database",
		Namespace: ExporterName,
	})

	StatsTotalAnnotations = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_annotations",
		Help:      "total amount of annotations in the database",
		Namespace: ExporterName,
	})

	StatsTotalAlertRules = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_alert_rules",
		Help:      "total amount of alert rules in the database",
		Namespace: ExporterName,
	})

	MAccessPermissionsSummary = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "access_permissions_duration",
		Help:    "Histogram for the runtime of permissions check function.",
		Buckets: prometheus.ExponentialBuckets(0.00001, 4, 10),
	})

	MAccessEvaluationsSummary = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "access_evaluation_duration",
		Help:    "Histogram for the runtime of evaluation function.",
		Buckets: prometheus.ExponentialBuckets(0.00001, 4, 10),
	})

	MAccessEvaluationCount = prometheus.NewCounter(prometheus.CounterOpts{
		Name:      "access_evaluation_count",
		Help:      "number of evaluation calls",
		Namespace: ExporterName,
	})

	StatsTotalLibraryPanels = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_library_panels",
		Help:      "total amount of library panels in the database",
		Namespace: ExporterName,
	})

	StatsTotalLibraryVariables = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_library_variables",
		Help:      "total amount of library variables in the database",
		Namespace: ExporterName,
	})

	StatsTotalDataKeys = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "stat_totals_data_keys",
		Help:      "total amount of data keys in the database",
		Namespace: ExporterName,
	}, []string{"active"})

	MStatTotalPublicDashboards = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_public_dashboard",
		Help:      "total amount of public dashboards",
		Namespace: ExporterName,
	})
}

// SetBuildInformation sets the build information for this binary
func SetBuildInformation(version, revision, branch string, buildTimestamp int64) {
	edition := "oss"
	if setting.IsEnterprise {
		edition = "enterprise"
	}

	grafanaBuildVersion := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "build_info",
		Help:      "A metric with a constant '1' value labeled by version, revision, branch, and goversion from which Grafana was built",
		Namespace: ExporterName,
	}, []string{"version", "revision", "branch", "goversion", "edition"})

	grafanaBuildTimestamp := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "build_timestamp",
		Help:      "A metric exposing when the binary was built in epoch",
		Namespace: ExporterName,
	}, []string{"version", "revision", "branch", "goversion", "edition"})

	prometheus.MustRegister(grafanaBuildVersion, grafanaBuildTimestamp)

	grafanaBuildVersion.WithLabelValues(version, revision, branch, runtime.Version(), edition).Set(1)
	grafanaBuildTimestamp.WithLabelValues(version, revision, branch, runtime.Version(), edition).Set(float64(buildTimestamp))
}

// SetEnvironmentInformation exposes environment values provided by the operators as an `_info` metric.
// If there are no environment metrics labels configured, this metric will not be exposed.
func SetEnvironmentInformation(labels map[string]string) error {
	if len(labels) == 0 {
		return nil
	}

	grafanaEnvironmentInfo := prometheus.NewGauge(prometheus.GaugeOpts{
		Name:        "environment_info",
		Help:        "A metric with a constant '1' value labeled by environment information about the running instance.",
		Namespace:   ExporterName,
		ConstLabels: labels,
	})

	prometheus.MustRegister(grafanaEnvironmentInfo)

	grafanaEnvironmentInfo.Set(1)
	return nil
}

func SetPluginBuildInformation(pluginID, pluginType, version, signatureStatus string) {
	grafanaPluginBuildInfoDesc.WithLabelValues(pluginID, pluginType, version, signatureStatus).Set(1)
}

func initMetricVars() {
	prometheus.MustRegister(
		MInstanceStart,
		MPageStatus,
		MApiStatus,
		MProxyStatus,
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
		MRenderingRequestTotal,
		MRenderingSummary,
		MRenderingUserLookupSummary,
		MRenderingQueue,
		MAccessPermissionsSummary,
		MAccessEvaluationsSummary,
		MAlertingActiveAlerts,
		MStatTotalDashboards,
		MStatTotalFolders,
		MStatTotalUsers,
		MStatTotalTeams,
		MStatActiveUsers,
		MStatTotalOrgs,
		MStatTotalPlaylists,
		StatsTotalViewers,
		StatsTotalEditors,
		StatsTotalAdmins,
		StatsTotalActiveViewers,
		StatsTotalActiveEditors,
		StatsTotalActiveAdmins,
		StatsTotalDataSources,
		grafanaPluginBuildInfoDesc,
		StatsTotalDashboardVersions,
		StatsTotalAnnotations,
		MAccessEvaluationCount,
		StatsTotalLibraryPanels,
		StatsTotalLibraryVariables,
		StatsTotalDataKeys,
		MStatTotalPublicDashboards,
		MPublicDashboardRequestCount,
		MPublicDashboardDatasourceQuerySuccess,
	)
}
