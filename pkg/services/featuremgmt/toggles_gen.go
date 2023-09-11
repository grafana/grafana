// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature flags, edit:
//  pkg/services/featuremgmt/registry.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go

package featuremgmt

const (
	// FlagTrimDefaults
	// Use cue schema to remove values that will be applied automatically
	FlagTrimDefaults = "trimDefaults"

	// FlagDisableEnvelopeEncryption
	// Disable envelope encryption (emergency only)
	FlagDisableEnvelopeEncryption = "disableEnvelopeEncryption"

	// FlagLiveServiceWebWorker
	// This will use a webworker thread to processes events rather than the main thread
	FlagLiveServiceWebWorker = "live-service-web-worker"

	// FlagQueryOverLive
	// Use Grafana Live WebSocket to execute backend queries
	FlagQueryOverLive = "queryOverLive"

	// FlagPanelTitleSearch
	// Search for dashboards using panel title
	FlagPanelTitleSearch = "panelTitleSearch"

	// FlagPublicDashboards
	// Enables public access to dashboards
	FlagPublicDashboards = "publicDashboards"

	// FlagPublicDashboardsEmailSharing
	// Enables public dashboard sharing to be restricted to only allowed emails
	FlagPublicDashboardsEmailSharing = "publicDashboardsEmailSharing"

	// FlagLokiExperimentalStreaming
	// Support new streaming approach for loki (prototype, needs special loki build)
	FlagLokiExperimentalStreaming = "lokiExperimentalStreaming"

	// FlagFeatureHighlights
	// Highlight Grafana Enterprise features
	FlagFeatureHighlights = "featureHighlights"

	// FlagMigrationLocking
	// Lock database during migrations
	FlagMigrationLocking = "migrationLocking"

	// FlagStorage
	// Configurable storage for dashboards, datasources, and resources
	FlagStorage = "storage"

	// FlagCorrelations
	// Correlations page
	FlagCorrelations = "correlations"

	// FlagDatasourceQueryMultiStatus
	// Introduce HTTP 207 Multi Status for api/ds/query
	FlagDatasourceQueryMultiStatus = "datasourceQueryMultiStatus"

	// FlagTraceToMetrics
	// Enable trace to metrics links
	FlagTraceToMetrics = "traceToMetrics"

	// FlagNewDBLibrary
	// Use jmoiron/sqlx rather than xorm for a few backend services
	FlagNewDBLibrary = "newDBLibrary"

	// FlagAutoMigrateOldPanels
	// Migrate old angular panels to supported versions (graph, table-old, worldmap, etc)
	FlagAutoMigrateOldPanels = "autoMigrateOldPanels"

	// FlagDisableAngular
	// Dynamic flag to disable angular at runtime. The preferred method is to set `angular_support_enabled` to `false` in the [security] settings, which allows you to change the state at runtime.
	FlagDisableAngular = "disableAngular"

	// FlagCanvasPanelNesting
	// Allow elements nesting
	FlagCanvasPanelNesting = "canvasPanelNesting"

	// FlagScenes
	// Experimental framework to build interactive dashboards
	FlagScenes = "scenes"

	// FlagDisableSecretsCompatibility
	// Disable duplicated secret storage in legacy tables
	FlagDisableSecretsCompatibility = "disableSecretsCompatibility"

	// FlagLogRequestsInstrumentedAsUnknown
	// Logs the path for requests that are instrumented as unknown
	FlagLogRequestsInstrumentedAsUnknown = "logRequestsInstrumentedAsUnknown"

	// FlagDataConnectionsConsole
	// Enables a new top-level page called Connections. This page is an experiment that provides a better experience when you install and configure data sources and other plugins.
	FlagDataConnectionsConsole = "dataConnectionsConsole"

	// FlagTopnav
	// Enables topnav support in external plugins. The new Grafana navigation cannot be disabled.
	FlagTopnav = "topnav"

	// FlagGrpcServer
	// Run the GRPC server
	FlagGrpcServer = "grpcServer"

	// FlagEntityStore
	// SQL-based entity store (requires storage flag also)
	FlagEntityStore = "entityStore"

	// FlagCloudWatchCrossAccountQuerying
	// Enables cross-account querying in CloudWatch datasources
	FlagCloudWatchCrossAccountQuerying = "cloudWatchCrossAccountQuerying"

	// FlagRedshiftAsyncQueryDataSupport
	// Enable async query data support for Redshift
	FlagRedshiftAsyncQueryDataSupport = "redshiftAsyncQueryDataSupport"

	// FlagAthenaAsyncQueryDataSupport
	// Enable async query data support for Athena
	FlagAthenaAsyncQueryDataSupport = "athenaAsyncQueryDataSupport"

	// FlagNewPanelChromeUI
	// Show updated look and feel of grafana-ui PanelChrome: panel header, icons, and menu
	FlagNewPanelChromeUI = "newPanelChromeUI"

	// FlagShowDashboardValidationWarnings
	// Show warnings when dashboards do not validate against the schema
	FlagShowDashboardValidationWarnings = "showDashboardValidationWarnings"

	// FlagMysqlAnsiQuotes
	// Use double quotes to escape keyword in a MySQL query
	FlagMysqlAnsiQuotes = "mysqlAnsiQuotes"

	// FlagAccessControlOnCall
	// Access control primitives for OnCall
	FlagAccessControlOnCall = "accessControlOnCall"

	// FlagNestedFolders
	// Enable folder nesting
	FlagNestedFolders = "nestedFolders"

	// FlagNestedFolderPicker
	// Enables the new folder picker to work with nested folders. Requires the nestedFolders feature flag
	FlagNestedFolderPicker = "nestedFolderPicker"

	// FlagAccessTokenExpirationCheck
	// Enable OAuth access_token expiration check and token refresh using the refresh_token
	FlagAccessTokenExpirationCheck = "accessTokenExpirationCheck"

	// FlagEmptyDashboardPage
	// Enable the redesigned user interface of a dashboard page that includes no panels
	FlagEmptyDashboardPage = "emptyDashboardPage"

	// FlagDisablePrometheusExemplarSampling
	// Disable Prometheus exemplar sampling
	FlagDisablePrometheusExemplarSampling = "disablePrometheusExemplarSampling"

	// FlagAlertingBacktesting
	// Rule backtesting API for alerting
	FlagAlertingBacktesting = "alertingBacktesting"

	// FlagEditPanelCSVDragAndDrop
	// Enables drag and drop for CSV and Excel files
	FlagEditPanelCSVDragAndDrop = "editPanelCSVDragAndDrop"

	// FlagAlertingNoNormalState
	// Stop maintaining state of alerts that are not firing
	FlagAlertingNoNormalState = "alertingNoNormalState"

	// FlagLogsContextDatasourceUi
	// Allow datasource to provide custom UI for context view
	FlagLogsContextDatasourceUi = "logsContextDatasourceUi"

	// FlagLokiQuerySplitting
	// Split large interval queries into subqueries with smaller time intervals
	FlagLokiQuerySplitting = "lokiQuerySplitting"

	// FlagLokiQuerySplittingConfig
	// Give users the option to configure split durations for Loki queries
	FlagLokiQuerySplittingConfig = "lokiQuerySplittingConfig"

	// FlagIndividualCookiePreferences
	// Support overriding cookie preferences per user
	FlagIndividualCookiePreferences = "individualCookiePreferences"

	// FlagGcomOnlyExternalOrgRoleSync
	// Prohibits a user from changing organization roles synced with Grafana Cloud auth provider
	FlagGcomOnlyExternalOrgRoleSync = "gcomOnlyExternalOrgRoleSync"

	// FlagPrometheusMetricEncyclopedia
	// Adds the metrics explorer component to the Prometheus query builder as an option in metric select
	FlagPrometheusMetricEncyclopedia = "prometheusMetricEncyclopedia"

	// FlagTimeSeriesTable
	// Enable time series table transformer &amp; sparkline cell type
	FlagTimeSeriesTable = "timeSeriesTable"

	// FlagPrometheusResourceBrowserCache
	// Displays browser caching options in Prometheus data source configuration
	FlagPrometheusResourceBrowserCache = "prometheusResourceBrowserCache"

	// FlagInfluxdbBackendMigration
	// Query InfluxDB InfluxQL without the proxy
	FlagInfluxdbBackendMigration = "influxdbBackendMigration"

	// FlagClientTokenRotation
	// Replaces the current in-request token rotation so that the client initiates the rotation
	FlagClientTokenRotation = "clientTokenRotation"

	// FlagPrometheusDataplane
	// Changes responses to from Prometheus to be compliant with the dataplane specification. In particular it sets the numeric Field.Name from &#39;Value&#39; to the value of the `__name__` label when present.
	FlagPrometheusDataplane = "prometheusDataplane"

	// FlagLokiMetricDataplane
	// Changes metric responses from Loki to be compliant with the dataplane specification.
	FlagLokiMetricDataplane = "lokiMetricDataplane"

	// FlagLokiLogsDataplane
	// Changes logs responses from Loki to be compliant with the dataplane specification.
	FlagLokiLogsDataplane = "lokiLogsDataplane"

	// FlagDataplaneFrontendFallback
	// Support dataplane contract field name change for transformations and field name matchers where the name is different
	FlagDataplaneFrontendFallback = "dataplaneFrontendFallback"

	// FlagDisableSSEDataplane
	// Disables dataplane specific processing in server side expressions.
	FlagDisableSSEDataplane = "disableSSEDataplane"

	// FlagAlertStateHistoryLokiSecondary
	// Enable Grafana to write alert state history to an external Loki instance in addition to Grafana annotations.
	FlagAlertStateHistoryLokiSecondary = "alertStateHistoryLokiSecondary"

	// FlagAlertingNotificationsPoliciesMatchingInstances
	// Enables the preview of matching instances for notification policies
	FlagAlertingNotificationsPoliciesMatchingInstances = "alertingNotificationsPoliciesMatchingInstances"

	// FlagAlertStateHistoryLokiPrimary
	// Enable a remote Loki instance as the primary source for state history reads.
	FlagAlertStateHistoryLokiPrimary = "alertStateHistoryLokiPrimary"

	// FlagAlertStateHistoryLokiOnly
	// Disable Grafana alerts from emitting annotations when a remote Loki instance is available.
	FlagAlertStateHistoryLokiOnly = "alertStateHistoryLokiOnly"

	// FlagUnifiedRequestLog
	// Writes error logs to the request logger
	FlagUnifiedRequestLog = "unifiedRequestLog"

	// FlagRenderAuthJWT
	// Uses JWT-based auth for rendering instead of relying on remote cache
	FlagRenderAuthJWT = "renderAuthJWT"

	// FlagExternalServiceAuth
	// Starts an OAuth2 authentication provider for external services
	FlagExternalServiceAuth = "externalServiceAuth"

	// FlagRefactorVariablesTimeRange
	// Refactor time range variables flow to reduce number of API calls made when query variables are chained
	FlagRefactorVariablesTimeRange = "refactorVariablesTimeRange"

	// FlagUseCachingService
	// When turned on, the new query and resource caching implementation using a wire service inject will be used in place of the previous middleware implementation
	FlagUseCachingService = "useCachingService"

	// FlagEnableElasticsearchBackendQuerying
	// Enable the processing of queries and responses in the Elasticsearch data source through backend
	FlagEnableElasticsearchBackendQuerying = "enableElasticsearchBackendQuerying"

	// FlagAdvancedDataSourcePicker
	// Enable a new data source picker with contextual information, recently used order and advanced mode
	FlagAdvancedDataSourcePicker = "advancedDataSourcePicker"

	// FlagFaroDatasourceSelector
	// Enable the data source selector within the Frontend Apps section of the Frontend Observability
	FlagFaroDatasourceSelector = "faroDatasourceSelector"

	// FlagEnableDatagridEditing
	// Enables the edit functionality in the datagrid panel
	FlagEnableDatagridEditing = "enableDatagridEditing"

	// FlagDataSourcePageHeader
	// Apply new pageHeader UI in data source edit page
	FlagDataSourcePageHeader = "dataSourcePageHeader"

	// FlagExtraThemes
	// Enables extra themes
	FlagExtraThemes = "extraThemes"

	// FlagLokiPredefinedOperations
	// Adds predefined query operations to Loki query editor
	FlagLokiPredefinedOperations = "lokiPredefinedOperations"

	// FlagPluginsFrontendSandbox
	// Enables the plugins frontend sandbox
	FlagPluginsFrontendSandbox = "pluginsFrontendSandbox"

	// FlagDashboardEmbed
	// Allow embedding dashboard for external use in Code editors
	FlagDashboardEmbed = "dashboardEmbed"

	// FlagFrontendSandboxMonitorOnly
	// Enables monitor only in the plugin frontend sandbox (if enabled)
	FlagFrontendSandboxMonitorOnly = "frontendSandboxMonitorOnly"

	// FlagSqlDatasourceDatabaseSelection
	// Enables previous SQL data source dataset dropdown behavior
	FlagSqlDatasourceDatabaseSelection = "sqlDatasourceDatabaseSelection"

	// FlagLokiFormatQuery
	// Enables the ability to format Loki queries
	FlagLokiFormatQuery = "lokiFormatQuery"

	// FlagCloudWatchLogsMonacoEditor
	// Enables the Monaco editor for CloudWatch Logs queries
	FlagCloudWatchLogsMonacoEditor = "cloudWatchLogsMonacoEditor"

	// FlagExploreScrollableLogsContainer
	// Improves the scrolling behavior of logs in Explore
	FlagExploreScrollableLogsContainer = "exploreScrollableLogsContainer"

	// FlagRecordedQueriesMulti
	// Enables writing multiple items from a single query within Recorded Queries
	FlagRecordedQueriesMulti = "recordedQueriesMulti"

	// FlagPluginsDynamicAngularDetectionPatterns
	// Enables fetching Angular detection patterns for plugins from GCOM and fallback to hardcoded ones
	FlagPluginsDynamicAngularDetectionPatterns = "pluginsDynamicAngularDetectionPatterns"

	// FlagAlertingLokiRangeToInstant
	// Rewrites eligible loki range queries to instant queries
	FlagAlertingLokiRangeToInstant = "alertingLokiRangeToInstant"

	// FlagVizAndWidgetSplit
	// Split panels between vizualizations and widgets
	FlagVizAndWidgetSplit = "vizAndWidgetSplit"

	// FlagPrometheusIncrementalQueryInstrumentation
	// Adds RudderStack events to incremental queries
	FlagPrometheusIncrementalQueryInstrumentation = "prometheusIncrementalQueryInstrumentation"

	// FlagLogsExploreTableVisualisation
	// A table visualisation for logs in Explore
	FlagLogsExploreTableVisualisation = "logsExploreTableVisualisation"

	// FlagAwsDatasourcesTempCredentials
	// Support temporary security credentials in AWS plugins for Grafana Cloud customers
	FlagAwsDatasourcesTempCredentials = "awsDatasourcesTempCredentials"

	// FlagTransformationsRedesign
	// Enables the transformations redesign
	FlagTransformationsRedesign = "transformationsRedesign"

	// FlagToggleLabelsInLogsUI
	// Enable toggleable filters in log details view
	FlagToggleLabelsInLogsUI = "toggleLabelsInLogsUI"

	// FlagMlExpressions
	// Enable support for Machine Learning in server-side expressions
	FlagMlExpressions = "mlExpressions"

	// FlagTraceQLStreaming
	// Enables response streaming of TraceQL queries of the Tempo data source
	FlagTraceQLStreaming = "traceQLStreaming"

	// FlagMetricsSummary
	// Enables metrics summary queries in the Tempo data source
	FlagMetricsSummary = "metricsSummary"

	// FlagGrafanaAPIServer
	// Enable Kubernetes API Server for Grafana resources
	FlagGrafanaAPIServer = "grafanaAPIServer"

	// FlagFeatureToggleAdminPage
	// Enable admin page for managing feature toggles from the Grafana front-end
	FlagFeatureToggleAdminPage = "featureToggleAdminPage"

	// FlagAwsAsyncQueryCaching
	// Enable caching for async queries for Redshift and Athena. Requires that the `useCachingService` feature toggle is enabled and the datasource has caching and async query support enabled
	FlagAwsAsyncQueryCaching = "awsAsyncQueryCaching"

	// FlagSplitScopes
	// Support faster dashboard and folder search by splitting permission scopes into parts
	FlagSplitScopes = "splitScopes"

	// FlagAzureMonitorDataplane
	// Adds dataplane compliant frame metadata in the Azure Monitor datasource
	FlagAzureMonitorDataplane = "azureMonitorDataplane"

	// FlagPermissionsFilterRemoveSubquery
	// Alternative permission filter implementation that does not use subqueries for fetching the dashboard folder
	FlagPermissionsFilterRemoveSubquery = "permissionsFilterRemoveSubquery"

	// FlagPrometheusConfigOverhaulAuth
	// Update the Prometheus configuration page with the new auth component
	FlagPrometheusConfigOverhaulAuth = "prometheusConfigOverhaulAuth"

	// FlagConfigurableSchedulerTick
	// Enable changing the scheduler base interval via configuration option unified_alerting.scheduler_tick_interval
	FlagConfigurableSchedulerTick = "configurableSchedulerTick"

	// FlagInfluxdbSqlSupport
	// Enable InfluxDB SQL query language support with new querying UI
	FlagInfluxdbSqlSupport = "influxdbSqlSupport"

	// FlagNoBasicRole
	// Enables a new role that has no permissions by default
	FlagNoBasicRole = "noBasicRole"

	// FlagAlertingNoDataErrorExecution
	// Changes how Alerting state manager handles execution of NoData/Error
	FlagAlertingNoDataErrorExecution = "alertingNoDataErrorExecution"

	// FlagAngularDeprecationUI
	// Display new Angular deprecation-related UI features
	FlagAngularDeprecationUI = "angularDeprecationUI"

	// FlagDashgpt
	// Enable AI powered features in dashboards
	FlagDashgpt = "dashgpt"

	// FlagReportingRetries
	// Enables rendering retries for the reporting feature
	FlagReportingRetries = "reportingRetries"

	// FlagNewBrowseDashboards
	// New browse/manage dashboards UI
	FlagNewBrowseDashboards = "newBrowseDashboards"

	// FlagSseGroupByDatasource
	// Send query to the same datasource in a single request when using server side expressions
	FlagSseGroupByDatasource = "sseGroupByDatasource"

	// FlagRequestInstrumentationStatusSource
	// Include a status source label for request metrics and logs
	FlagRequestInstrumentationStatusSource = "requestInstrumentationStatusSource"
)
