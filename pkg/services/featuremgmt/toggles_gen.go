// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature flags, edit:
//  pkg/services/featuremgmt/registry.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go

package featuremgmt

const (
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
	// [Deprecated] Public dashboards are now enabled by default; to disable them, use the configuration setting. This feature toggle will be removed in the next major version.
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

	// FlagExploreContentOutline
	// Content outline sidebar
	FlagExploreContentOutline = "exploreContentOutline"

	// FlagDatasourceQueryMultiStatus
	// Introduce HTTP 207 Multi Status for api/ds/query
	FlagDatasourceQueryMultiStatus = "datasourceQueryMultiStatus"

	// FlagAutoMigrateOldPanels
	// Migrate old angular panels to supported versions (graph, table-old, worldmap, etc)
	FlagAutoMigrateOldPanels = "autoMigrateOldPanels"

	// FlagAutoMigrateGraphPanel
	// Migrate old graph panel to supported time series panel - broken out from autoMigrateOldPanels to enable granular tracking
	FlagAutoMigrateGraphPanel = "autoMigrateGraphPanel"

	// FlagAutoMigrateTablePanel
	// Migrate old table panel to supported table panel - broken out from autoMigrateOldPanels to enable granular tracking
	FlagAutoMigrateTablePanel = "autoMigrateTablePanel"

	// FlagAutoMigratePiechartPanel
	// Migrate old piechart panel to supported piechart panel - broken out from autoMigrateOldPanels to enable granular tracking
	FlagAutoMigratePiechartPanel = "autoMigratePiechartPanel"

	// FlagAutoMigrateWorldmapPanel
	// Migrate old worldmap panel to supported geomap panel - broken out from autoMigrateOldPanels to enable granular tracking
	FlagAutoMigrateWorldmapPanel = "autoMigrateWorldmapPanel"

	// FlagAutoMigrateStatPanel
	// Migrate old stat panel to supported stat panel - broken out from autoMigrateOldPanels to enable granular tracking
	FlagAutoMigrateStatPanel = "autoMigrateStatPanel"

	// FlagDisableAngular
	// Dynamic flag to disable angular at runtime. The preferred method is to set `angular_support_enabled` to `false` in the [security] settings, which allows you to change the state at runtime.
	FlagDisableAngular = "disableAngular"

	// FlagCanvasPanelNesting
	// Allow elements nesting
	FlagCanvasPanelNesting = "canvasPanelNesting"

	// FlagNewVizTooltips
	// New visualizations tooltips UX
	FlagNewVizTooltips = "newVizTooltips"

	// FlagScenes
	// Experimental framework to build interactive dashboards
	FlagScenes = "scenes"

	// FlagDisableSecretsCompatibility
	// Disable duplicated secret storage in legacy tables
	FlagDisableSecretsCompatibility = "disableSecretsCompatibility"

	// FlagLogRequestsInstrumentedAsUnknown
	// Logs the path for requests that are instrumented as unknown
	FlagLogRequestsInstrumentedAsUnknown = "logRequestsInstrumentedAsUnknown"

	// FlagTopnav
	// Enables topnav support in external plugins. The new Grafana navigation cannot be disabled.
	FlagTopnav = "topnav"

	// FlagReturnToPrevious
	// Enables the return to previous context functionality
	FlagReturnToPrevious = "returnToPrevious"

	// FlagGrpcServer
	// Run the GRPC server
	FlagGrpcServer = "grpcServer"

	// FlagUnifiedStorage
	// SQL-based k8s storage
	FlagUnifiedStorage = "unifiedStorage"

	// FlagCloudWatchCrossAccountQuerying
	// Enables cross-account querying in CloudWatch datasources
	FlagCloudWatchCrossAccountQuerying = "cloudWatchCrossAccountQuerying"

	// FlagRedshiftAsyncQueryDataSupport
	// Enable async query data support for Redshift
	FlagRedshiftAsyncQueryDataSupport = "redshiftAsyncQueryDataSupport"

	// FlagAthenaAsyncQueryDataSupport
	// Enable async query data support for Athena
	FlagAthenaAsyncQueryDataSupport = "athenaAsyncQueryDataSupport"

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
	// Enables the new folder picker to work with nested folders. Requires the nestedFolders feature toggle
	FlagNestedFolderPicker = "nestedFolderPicker"

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

	// FlagPrometheusMetricEncyclopedia
	// Adds the metrics explorer component to the Prometheus query builder as an option in metric select
	FlagPrometheusMetricEncyclopedia = "prometheusMetricEncyclopedia"

	// FlagInfluxdbBackendMigration
	// Query InfluxDB InfluxQL without the proxy
	FlagInfluxdbBackendMigration = "influxdbBackendMigration"

	// FlagInfluxqlStreamingParser
	// Enable streaming JSON parser for InfluxDB datasource InfluxQL query language
	FlagInfluxqlStreamingParser = "influxqlStreamingParser"

	// FlagInfluxdbRunQueriesInParallel
	// Enables running InfluxDB Influxql queries in parallel
	FlagInfluxdbRunQueriesInParallel = "influxdbRunQueriesInParallel"

	// FlagPrometheusDataplane
	// Changes responses to from Prometheus to be compliant with the dataplane specification. In particular, when this feature toggle is active, the numeric `Field.Name` is set from &#39;Value&#39; to the value of the `__name__` label.
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

	// FlagRefactorVariablesTimeRange
	// Refactor time range variables flow to reduce number of API calls made when query variables are chained
	FlagRefactorVariablesTimeRange = "refactorVariablesTimeRange"

	// FlagEnableElasticsearchBackendQuerying
	// Enable the processing of queries and responses in the Elasticsearch data source through backend
	FlagEnableElasticsearchBackendQuerying = "enableElasticsearchBackendQuerying"

	// FlagFaroDatasourceSelector
	// Enable the data source selector within the Frontend Apps section of the Frontend Observability
	FlagFaroDatasourceSelector = "faroDatasourceSelector"

	// FlagEnableDatagridEditing
	// Enables the edit functionality in the datagrid panel
	FlagEnableDatagridEditing = "enableDatagridEditing"

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

	// FlagRecordedQueriesMulti
	// Enables writing multiple items from a single query within Recorded Queries
	FlagRecordedQueriesMulti = "recordedQueriesMulti"

	// FlagPluginsDynamicAngularDetectionPatterns
	// Enables fetching Angular detection patterns for plugins from GCOM and fallback to hardcoded ones
	FlagPluginsDynamicAngularDetectionPatterns = "pluginsDynamicAngularDetectionPatterns"

	// FlagVizAndWidgetSplit
	// Split panels between visualizations and widgets
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

	// FlagMlExpressions
	// Enable support for Machine Learning in server-side expressions
	FlagMlExpressions = "mlExpressions"

	// FlagTraceQLStreaming
	// Enables response streaming of TraceQL queries of the Tempo data source
	FlagTraceQLStreaming = "traceQLStreaming"

	// FlagMetricsSummary
	// Enables metrics summary queries in the Tempo data source
	FlagMetricsSummary = "metricsSummary"

	// FlagGrafanaAPIServerWithExperimentalAPIs
	// Register experimental APIs with the k8s API server
	FlagGrafanaAPIServerWithExperimentalAPIs = "grafanaAPIServerWithExperimentalAPIs"

	// FlagGrafanaAPIServerEnsureKubectlAccess
	// Start an additional https handler and write kubectl options
	FlagGrafanaAPIServerEnsureKubectlAccess = "grafanaAPIServerEnsureKubectlAccess"

	// FlagFeatureToggleAdminPage
	// Enable admin page for managing feature toggles from the Grafana front-end
	FlagFeatureToggleAdminPage = "featureToggleAdminPage"

	// FlagAwsAsyncQueryCaching
	// Enable caching for async queries for Redshift and Athena. Requires that the datasource has caching and async query support enabled
	FlagAwsAsyncQueryCaching = "awsAsyncQueryCaching"

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

	// FlagAlertingNoDataErrorExecution
	// Changes how Alerting state manager handles execution of NoData/Error
	FlagAlertingNoDataErrorExecution = "alertingNoDataErrorExecution"

	// FlagAngularDeprecationUI
	// Display Angular warnings in dashboards and panels
	FlagAngularDeprecationUI = "angularDeprecationUI"

	// FlagDashgpt
	// Enable AI powered features in dashboards
	FlagDashgpt = "dashgpt"

	// FlagAiGeneratedDashboardChanges
	// Enable AI powered features for dashboards to auto-summary changes when saving
	FlagAiGeneratedDashboardChanges = "aiGeneratedDashboardChanges"

	// FlagReportingRetries
	// Enables rendering retries for the reporting feature
	FlagReportingRetries = "reportingRetries"

	// FlagSseGroupByDatasource
	// Send query to the same datasource in a single request when using server side expressions. The `cloudWatchBatchQueries` feature toggle should be enabled if this used with CloudWatch.
	FlagSseGroupByDatasource = "sseGroupByDatasource"

	// FlagLibraryPanelRBAC
	// Enables RBAC support for library panels
	FlagLibraryPanelRBAC = "libraryPanelRBAC"

	// FlagLokiRunQueriesInParallel
	// Enables running Loki queries in parallel
	FlagLokiRunQueriesInParallel = "lokiRunQueriesInParallel"

	// FlagWargamesTesting
	// Placeholder feature flag for internal testing
	FlagWargamesTesting = "wargamesTesting"

	// FlagAlertingInsights
	// Show the new alerting insights landing page
	FlagAlertingInsights = "alertingInsights"

	// FlagExternalCorePlugins
	// Allow core plugins to be loaded as external
	FlagExternalCorePlugins = "externalCorePlugins"

	// FlagPluginsAPIMetrics
	// Sends metrics of public grafana packages usage by plugins
	FlagPluginsAPIMetrics = "pluginsAPIMetrics"

	// FlagIdForwarding
	// Generate signed id token for identity that can be forwarded to plugins and external services
	FlagIdForwarding = "idForwarding"

	// FlagCloudWatchWildCardDimensionValues
	// Fetches dimension values from CloudWatch to correctly label wildcard dimensions
	FlagCloudWatchWildCardDimensionValues = "cloudWatchWildCardDimensionValues"

	// FlagExternalServiceAccounts
	// Automatic service account and token setup for plugins
	FlagExternalServiceAccounts = "externalServiceAccounts"

	// FlagPanelMonitoring
	// Enables panel monitoring through logs and measurements
	FlagPanelMonitoring = "panelMonitoring"

	// FlagEnableNativeHTTPHistogram
	// Enables native HTTP Histograms
	FlagEnableNativeHTTPHistogram = "enableNativeHTTPHistogram"

	// FlagFormatString
	// Enable format string transformer
	FlagFormatString = "formatString"

	// FlagTransformationsVariableSupport
	// Allows using variables in transformations
	FlagTransformationsVariableSupport = "transformationsVariableSupport"

	// FlagKubernetesPlaylists
	// Use the kubernetes API in the frontend for playlists, and route /api/playlist requests to k8s
	FlagKubernetesPlaylists = "kubernetesPlaylists"

	// FlagKubernetesSnapshots
	// Routes snapshot requests from /api to the /apis endpoint
	FlagKubernetesSnapshots = "kubernetesSnapshots"

	// FlagKubernetesQueryServiceRewrite
	// Rewrite requests targeting /ds/query to the query service
	FlagKubernetesQueryServiceRewrite = "kubernetesQueryServiceRewrite"

	// FlagCloudWatchBatchQueries
	// Runs CloudWatch metrics queries as separate batches
	FlagCloudWatchBatchQueries = "cloudWatchBatchQueries"

	// FlagRecoveryThreshold
	// Enables feature recovery threshold (aka hysteresis) for threshold server-side expression
	FlagRecoveryThreshold = "recoveryThreshold"

	// FlagLokiStructuredMetadata
	// Enables the loki data source to request structured metadata from the Loki server
	FlagLokiStructuredMetadata = "lokiStructuredMetadata"

	// FlagTeamHttpHeaders
	// Enables Team LBAC for datasources to apply team headers to the client requests
	FlagTeamHttpHeaders = "teamHttpHeaders"

	// FlagAwsDatasourcesNewFormStyling
	// Applies new form styling for configuration and query editors in AWS plugins
	FlagAwsDatasourcesNewFormStyling = "awsDatasourcesNewFormStyling"

	// FlagCachingOptimizeSerializationMemoryUsage
	// If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses.
	FlagCachingOptimizeSerializationMemoryUsage = "cachingOptimizeSerializationMemoryUsage"

	// FlagPanelTitleSearchInV1
	// Enable searching for dashboards using panel title in search v1
	FlagPanelTitleSearchInV1 = "panelTitleSearchInV1"

	// FlagManagedPluginsInstall
	// Install managed plugins directly from plugins catalog
	FlagManagedPluginsInstall = "managedPluginsInstall"

	// FlagPrometheusPromQAIL
	// Prometheus and AI/ML to assist users in creating a query
	FlagPrometheusPromQAIL = "prometheusPromQAIL"

	// FlagAddFieldFromCalculationStatFunctions
	// Add cumulative and window functions to the add field from calculation transformation
	FlagAddFieldFromCalculationStatFunctions = "addFieldFromCalculationStatFunctions"

	// FlagAlertmanagerRemoteSecondary
	// Enable Grafana to sync configuration and state with a remote Alertmanager.
	FlagAlertmanagerRemoteSecondary = "alertmanagerRemoteSecondary"

	// FlagAlertmanagerRemotePrimary
	// Enable Grafana to have a remote Alertmanager instance as the primary Alertmanager.
	FlagAlertmanagerRemotePrimary = "alertmanagerRemotePrimary"

	// FlagAlertmanagerRemoteOnly
	// Disable the internal Alertmanager and only use the external one defined.
	FlagAlertmanagerRemoteOnly = "alertmanagerRemoteOnly"

	// FlagAnnotationPermissionUpdate
	// Separate annotation permissions from dashboard permissions to allow for more granular control.
	FlagAnnotationPermissionUpdate = "annotationPermissionUpdate"

	// FlagExtractFieldsNameDeduplication
	// Make sure extracted field names are unique in the dataframe
	FlagExtractFieldsNameDeduplication = "extractFieldsNameDeduplication"

	// FlagDashboardSceneForViewers
	// Enables dashboard rendering using Scenes for viewer roles
	FlagDashboardSceneForViewers = "dashboardSceneForViewers"

	// FlagDashboardSceneSolo
	// Enables rendering dashboards using scenes for solo panels
	FlagDashboardSceneSolo = "dashboardSceneSolo"

	// FlagDashboardScene
	// Enables dashboard rendering using scenes for all roles
	FlagDashboardScene = "dashboardScene"

	// FlagPanelFilterVariable
	// Enables use of the `systemPanelFilterVar` variable to filter panels in a dashboard
	FlagPanelFilterVariable = "panelFilterVariable"

	// FlagPdfTables
	// Enables generating table data as PDF in reporting
	FlagPdfTables = "pdfTables"

	// FlagSsoSettingsApi
	// Enables the SSO settings API and the OAuth configuration UIs in Grafana
	FlagSsoSettingsApi = "ssoSettingsApi"

	// FlagCanvasPanelPanZoom
	// Allow pan and zoom in canvas panel
	FlagCanvasPanelPanZoom = "canvasPanelPanZoom"

	// FlagLogsInfiniteScrolling
	// Enables infinite scrolling for the Logs panel in Explore and Dashboards
	FlagLogsInfiniteScrolling = "logsInfiniteScrolling"

	// FlagFlameGraphItemCollapsing
	// Allow collapsing of flame graph items
	FlagFlameGraphItemCollapsing = "flameGraphItemCollapsing"

	// FlagDatatrails
	// Enables the new core app datatrails
	FlagDatatrails = "datatrails"

	// FlagAlertingSimplifiedRouting
	// Enables users to easily configure alert notifications by specifying a contact point directly when editing or creating an alert rule
	FlagAlertingSimplifiedRouting = "alertingSimplifiedRouting"

	// FlagLogRowsPopoverMenu
	// Enable filtering menu displayed when text of a log line is selected
	FlagLogRowsPopoverMenu = "logRowsPopoverMenu"

	// FlagPluginsSkipHostEnvVars
	// Disables passing host environment variable to plugin processes
	FlagPluginsSkipHostEnvVars = "pluginsSkipHostEnvVars"

	// FlagTableSharedCrosshair
	// Enables shared crosshair in table panel
	FlagTableSharedCrosshair = "tableSharedCrosshair"

	// FlagRegressionTransformation
	// Enables regression analysis transformation
	FlagRegressionTransformation = "regressionTransformation"

	// FlagLokiQueryHints
	// Enables query hints for Loki
	FlagLokiQueryHints = "lokiQueryHints"

	// FlagKubernetesFeatureToggles
	// Use the kubernetes API for feature toggle management in the frontend
	FlagKubernetesFeatureToggles = "kubernetesFeatureToggles"

	// FlagEnablePluginsTracingByDefault
	// Enable plugin tracing for all external plugins
	FlagEnablePluginsTracingByDefault = "enablePluginsTracingByDefault"

	// FlagCloudRBACRoles
	// Enabled grafana cloud specific RBAC roles
	FlagCloudRBACRoles = "cloudRBACRoles"

	// FlagAlertingQueryOptimization
	// Optimizes eligible queries in order to reduce load on datasources
	FlagAlertingQueryOptimization = "alertingQueryOptimization"

	// FlagNewFolderPicker
	// Enables the nested folder picker without having nested folders enabled
	FlagNewFolderPicker = "newFolderPicker"

	// FlagJitterAlertRulesWithinGroups
	// Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group
	FlagJitterAlertRulesWithinGroups = "jitterAlertRulesWithinGroups"

	// FlagOnPremToCloudMigrations
	// In-development feature that will allow users to easily migrate their on-prem Grafana instances to Grafana Cloud.
	FlagOnPremToCloudMigrations = "onPremToCloudMigrations"

	// FlagAlertingSaveStatePeriodic
	// Writes the state periodically to the database, asynchronous to rule evaluation
	FlagAlertingSaveStatePeriodic = "alertingSaveStatePeriodic"

	// FlagPromQLScope
	// In-development feature that will allow injection of labels into prometheus queries.
	FlagPromQLScope = "promQLScope"

	// FlagSqlExpressions
	// Enables using SQL and DuckDB functions as Expressions.
	FlagSqlExpressions = "sqlExpressions"

	// FlagNodeGraphDotLayout
	// Changed the layout algorithm for the node graph
	FlagNodeGraphDotLayout = "nodeGraphDotLayout"

	// FlagGroupToNestedTableTransformation
	// Enables the group to nested table transformation
	FlagGroupToNestedTableTransformation = "groupToNestedTableTransformation"

	// FlagNewPDFRendering
	// New implementation for the dashboard to PDF rendering
	FlagNewPDFRendering = "newPDFRendering"

	// FlagKubernetesAggregator
	// Enable grafana aggregator
	FlagKubernetesAggregator = "kubernetesAggregator"

	// FlagExpressionParser
	// Enable new expression parser
	FlagExpressionParser = "expressionParser"

	// FlagGroupByVariable
	// Enable groupBy variable support in scenes dashboards
	FlagGroupByVariable = "groupByVariable"

	// FlagBetterPageScrolling
	// Removes CustomScrollbar from the UI, relying on native browser scrollbars
	FlagBetterPageScrolling = "betterPageScrolling"

	// FlagScopeFilters
	// Enables the use of scope filters in Grafana
	FlagScopeFilters = "scopeFilters"

	// FlagEmailVerificationEnforcement
	// Force email verification for users, even when authenticating through sso.
	FlagEmailVerificationEnforcement = "emailVerificationEnforcement"

	// FlagSsoSettingsSAML
	// Use the new SSO Settings API to configure the SAML connector
	FlagSsoSettingsSAML = "ssoSettingsSAML"
)
