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

	// FlagPublicDashboardsScene
	// Enables public dashboard rendering using scenes
	FlagPublicDashboardsScene = "publicDashboardsScene"

	// FlagLokiExperimentalStreaming
	// Support new streaming approach for loki (prototype, needs special loki build)
	FlagLokiExperimentalStreaming = "lokiExperimentalStreaming"

	// FlagFeatureHighlights
	// Highlight Grafana Enterprise features
	FlagFeatureHighlights = "featureHighlights"

	// FlagStorage
	// Configurable storage for dashboards, datasources, and resources
	FlagStorage = "storage"

	// FlagCorrelations
	// Correlations page
	FlagCorrelations = "correlations"

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

	// FlagAutoMigrateXYChartPanel
	// Migrate old XYChart panel to new XYChart2 model
	FlagAutoMigrateXYChartPanel = "autoMigrateXYChartPanel"

	// FlagDisableAngular
	// Dynamic flag to disable angular at runtime. The preferred method is to set `angular_support_enabled` to `false` in the [security] settings, which allows you to change the state at runtime.
	FlagDisableAngular = "disableAngular"

	// FlagCanvasPanelNesting
	// Allow elements nesting
	FlagCanvasPanelNesting = "canvasPanelNesting"

	// FlagVizActions
	// Allow actions in visualizations
	FlagVizActions = "vizActions"

	// FlagDisableSecretsCompatibility
	// Disable duplicated secret storage in legacy tables
	FlagDisableSecretsCompatibility = "disableSecretsCompatibility"

	// FlagLogRequestsInstrumentedAsUnknown
	// Logs the path for requests that are instrumented as unknown
	FlagLogRequestsInstrumentedAsUnknown = "logRequestsInstrumentedAsUnknown"

	// FlagGrpcServer
	// Run the GRPC server
	FlagGrpcServer = "grpcServer"

	// FlagCloudWatchCrossAccountQuerying
	// Enables cross-account querying in CloudWatch datasources
	FlagCloudWatchCrossAccountQuerying = "cloudWatchCrossAccountQuerying"

	// FlagShowDashboardValidationWarnings
	// Show warnings when dashboards do not validate against the schema
	FlagShowDashboardValidationWarnings = "showDashboardValidationWarnings"

	// FlagMysqlAnsiQuotes
	// Use double quotes to escape keyword in a MySQL query
	FlagMysqlAnsiQuotes = "mysqlAnsiQuotes"

	// FlagMysqlParseTime
	// Ensure the parseTime flag is set for MySQL driver
	FlagMysqlParseTime = "mysqlParseTime"

	// FlagAccessControlOnCall
	// Access control primitives for OnCall
	FlagAccessControlOnCall = "accessControlOnCall"

	// FlagNestedFolders
	// Enable folder nesting
	FlagNestedFolders = "nestedFolders"

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

	// FlagLokiShardSplitting
	// Use stream shards to split queries into smaller subqueries
	FlagLokiShardSplitting = "lokiShardSplitting"

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

	// FlagPrometheusRunQueriesInParallel
	// Enables running Prometheus queries in parallel
	FlagPrometheusRunQueriesInParallel = "prometheusRunQueriesInParallel"

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

	// FlagFrontendSandboxMonitorOnly
	// Enables monitor only in the plugin frontend sandbox (if enabled)
	FlagFrontendSandboxMonitorOnly = "frontendSandboxMonitorOnly"

	// FlagPluginsDetailsRightPanel
	// Enables right panel for the plugins details page
	FlagPluginsDetailsRightPanel = "pluginsDetailsRightPanel"

	// FlagSqlDatasourceDatabaseSelection
	// Enables previous SQL data source dataset dropdown behavior
	FlagSqlDatasourceDatabaseSelection = "sqlDatasourceDatabaseSelection"

	// FlagRecordedQueriesMulti
	// Enables writing multiple items from a single query within Recorded Queries
	FlagRecordedQueriesMulti = "recordedQueriesMulti"

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

	// FlagDatasourceAPIServers
	// Expose some datasources as apiservers.
	FlagDatasourceAPIServers = "datasourceAPIServers"

	// FlagGrafanaAPIServerWithExperimentalAPIs
	// Register experimental APIs with the k8s API server, including all datasources
	FlagGrafanaAPIServerWithExperimentalAPIs = "grafanaAPIServerWithExperimentalAPIs"

	// FlagGrafanaAPIServerEnsureKubectlAccess
	// Start an additional https handler and write kubectl options
	FlagGrafanaAPIServerEnsureKubectlAccess = "grafanaAPIServerEnsureKubectlAccess"

	// FlagFeatureToggleAdminPage
	// Enable admin page for managing feature toggles from the Grafana front-end. Grafana Cloud only.
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

	// FlagExternalServiceAccounts
	// Automatic service account and token setup for plugins
	FlagExternalServiceAccounts = "externalServiceAccounts"

	// FlagPanelMonitoring
	// Enables panel monitoring through logs and measurements
	FlagPanelMonitoring = "panelMonitoring"

	// FlagEnableNativeHTTPHistogram
	// Enables native HTTP Histograms
	FlagEnableNativeHTTPHistogram = "enableNativeHTTPHistogram"

	// FlagDisableClassicHTTPHistogram
	// Disables classic HTTP Histogram (use with enableNativeHTTPHistogram)
	FlagDisableClassicHTTPHistogram = "disableClassicHTTPHistogram"

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

	// FlagKubernetesDashboards
	// Use the kubernetes API in the frontend for dashboards
	FlagKubernetesDashboards = "kubernetesDashboards"

	// FlagKubernetesDashboardsAPI
	// Use the kubernetes API in the backend for dashboards
	FlagKubernetesDashboardsAPI = "kubernetesDashboardsAPI"

	// FlagKubernetesFolders
	// Use the kubernetes API in the frontend for folders, and route /api/folders requests to k8s
	FlagKubernetesFolders = "kubernetesFolders"

	// FlagGrafanaAPIServerTestingWithExperimentalAPIs
	// Facilitate integration testing of experimental APIs
	FlagGrafanaAPIServerTestingWithExperimentalAPIs = "grafanaAPIServerTestingWithExperimentalAPIs"

	// FlagDatasourceQueryTypes
	// Show query type endpoints in datasource API servers (currently hardcoded for testdata, expressions, and prometheus)
	FlagDatasourceQueryTypes = "datasourceQueryTypes"

	// FlagQueryService
	// Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query
	FlagQueryService = "queryService"

	// FlagQueryServiceRewrite
	// Rewrite requests targeting /ds/query to the query service
	FlagQueryServiceRewrite = "queryServiceRewrite"

	// FlagQueryServiceFromUI
	// Routes requests to the new query service
	FlagQueryServiceFromUI = "queryServiceFromUI"

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
	// Enables LBAC for datasources to apply LogQL filtering of logs to the client requests for users in teams
	FlagTeamHttpHeaders = "teamHttpHeaders"

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

	// FlagPrometheusCodeModeMetricNamesSearch
	// Enables search for metric names in Code Mode, to improve performance when working with an enormous number of metric names
	FlagPrometheusCodeModeMetricNamesSearch = "prometheusCodeModeMetricNamesSearch"

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
	// Change the way annotation permissions work by scoping them to folders and dashboards.
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

	// FlagDashboardNewLayouts
	// Enables experimental new dashboard layouts
	FlagDashboardNewLayouts = "dashboardNewLayouts"

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

	// FlagExploreMetrics
	// Enables the new Explore Metrics core app
	FlagExploreMetrics = "exploreMetrics"

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
	// Enable the Grafana Migration Assistant, which helps you easily migrate on-prem dashboards, folders, and data source configurations to your Grafana Cloud stack.
	FlagOnPremToCloudMigrations = "onPremToCloudMigrations"

	// FlagOnPremToCloudMigrationsAlerts
	// Enables the migration of alerts and its child resources to your Grafana Cloud stack. Requires `onPremToCloudMigrations` to be enabled in conjunction.
	FlagOnPremToCloudMigrationsAlerts = "onPremToCloudMigrationsAlerts"

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
	// New implementation for the dashboard-to-PDF rendering
	FlagNewPDFRendering = "newPDFRendering"

	// FlagTlsMemcached
	// Use TLS-enabled memcached in the enterprise caching feature
	FlagTlsMemcached = "tlsMemcached"

	// FlagKubernetesAggregator
	// Enable grafana&#39;s embedded kube-aggregator
	FlagKubernetesAggregator = "kubernetesAggregator"

	// FlagExpressionParser
	// Enable new expression parser
	FlagExpressionParser = "expressionParser"

	// FlagGroupByVariable
	// Enable groupBy variable support in scenes dashboards
	FlagGroupByVariable = "groupByVariable"

	// FlagAuthAPIAccessTokenAuth
	// Enables the use of Auth API access tokens for authentication
	FlagAuthAPIAccessTokenAuth = "authAPIAccessTokenAuth"

	// FlagScopeFilters
	// Enables the use of scope filters in Grafana
	FlagScopeFilters = "scopeFilters"

	// FlagSsoSettingsSAML
	// Use the new SSO Settings API to configure the SAML connector
	FlagSsoSettingsSAML = "ssoSettingsSAML"

	// FlagOauthRequireSubClaim
	// Require that sub claims is present in oauth tokens.
	FlagOauthRequireSubClaim = "oauthRequireSubClaim"

	// FlagNewDashboardWithFiltersAndGroupBy
	// Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering.
	FlagNewDashboardWithFiltersAndGroupBy = "newDashboardWithFiltersAndGroupBy"

	// FlagCloudWatchNewLabelParsing
	// Updates CloudWatch label parsing to be more accurate
	FlagCloudWatchNewLabelParsing = "cloudWatchNewLabelParsing"

	// FlagAccessActionSets
	// Introduces action sets for resource permissions. Also ensures that all folder editors and admins can create subfolders without needing any additional permissions.
	FlagAccessActionSets = "accessActionSets"

	// FlagDisableNumericMetricsSortingInExpressions
	// In server-side expressions, disable the sorting of numeric-kind metrics by their metric name or labels.
	FlagDisableNumericMetricsSortingInExpressions = "disableNumericMetricsSortingInExpressions"

	// FlagGrafanaManagedRecordingRules
	// Enables Grafana-managed recording rules.
	FlagGrafanaManagedRecordingRules = "grafanaManagedRecordingRules"

	// FlagQueryLibrary
	// Enables Query Library feature in Explore
	FlagQueryLibrary = "queryLibrary"

	// FlagLogsExploreTableDefaultVisualization
	// Sets the logs table as default visualisation in logs explore
	FlagLogsExploreTableDefaultVisualization = "logsExploreTableDefaultVisualization"

	// FlagNewDashboardSharingComponent
	// Enables the new sharing drawer design
	FlagNewDashboardSharingComponent = "newDashboardSharingComponent"

	// FlagAlertingListViewV2
	// Enables the new alert list view design
	FlagAlertingListViewV2 = "alertingListViewV2"

	// FlagNotificationBanner
	// Enables the notification banner UI and API
	FlagNotificationBanner = "notificationBanner"

	// FlagDashboardRestore
	// Enables deleted dashboard restore feature
	FlagDashboardRestore = "dashboardRestore"

	// FlagDatasourceProxyDisableRBAC
	// Disables applying a plugin route&#39;s ReqAction field to authorization
	FlagDatasourceProxyDisableRBAC = "datasourceProxyDisableRBAC"

	// FlagAlertingDisableSendAlertsExternal
	// Disables the ability to send alerts to an external Alertmanager datasource.
	FlagAlertingDisableSendAlertsExternal = "alertingDisableSendAlertsExternal"

	// FlagPreserveDashboardStateWhenNavigating
	// Enables possibility to preserve dashboard variables and time range when navigating between dashboards
	FlagPreserveDashboardStateWhenNavigating = "preserveDashboardStateWhenNavigating"

	// FlagAlertingCentralAlertHistory
	// Enables the new central alert history.
	FlagAlertingCentralAlertHistory = "alertingCentralAlertHistory"

	// FlagPluginProxyPreserveTrailingSlash
	// Preserve plugin proxy trailing slash.
	FlagPluginProxyPreserveTrailingSlash = "pluginProxyPreserveTrailingSlash"

	// FlagSqlQuerybuilderFunctionParameters
	// Enables SQL query builder function parameters
	FlagSqlQuerybuilderFunctionParameters = "sqlQuerybuilderFunctionParameters"

	// FlagAzureMonitorPrometheusExemplars
	// Allows configuration of Azure Monitor as a data source that can provide Prometheus exemplars
	FlagAzureMonitorPrometheusExemplars = "azureMonitorPrometheusExemplars"

	// FlagPinNavItems
	// Enables pinning of nav items
	FlagPinNavItems = "pinNavItems"

	// FlagAuthZGRPCServer
	// Enables the gRPC server for authorization
	FlagAuthZGRPCServer = "authZGRPCServer"

	// FlagOpenSearchBackendFlowEnabled
	// Enables the backend query flow for Open Search datasource plugin
	FlagOpenSearchBackendFlowEnabled = "openSearchBackendFlowEnabled"

	// FlagSsoSettingsLDAP
	// Use the new SSO Settings API to configure LDAP
	FlagSsoSettingsLDAP = "ssoSettingsLDAP"

	// FlagFailWrongDSUID
	// Throws an error if a datasource has an invalid UIDs
	FlagFailWrongDSUID = "failWrongDSUID"

	// FlagZanzana
	// Use openFGA as authorization engine.
	FlagZanzana = "zanzana"

	// FlagReloadDashboardsOnParamsChange
	// Enables reload of dashboards on scopes, time range and variables changes
	FlagReloadDashboardsOnParamsChange = "reloadDashboardsOnParamsChange"

	// FlagEnableScopesInMetricsExplore
	// Enables the scopes usage in Metrics Explore
	FlagEnableScopesInMetricsExplore = "enableScopesInMetricsExplore"

	// FlagAlertingApiServer
	// Register Alerting APIs with the K8s API server
	FlagAlertingApiServer = "alertingApiServer"

	// FlagCloudWatchRoundUpEndTime
	// Round up end time for metric queries to the next minute to avoid missing data
	FlagCloudWatchRoundUpEndTime = "cloudWatchRoundUpEndTime"

	// FlagCloudwatchMetricInsightsCrossAccount
	// Enables cross account observability for Cloudwatch Metric Insights query builder
	FlagCloudwatchMetricInsightsCrossAccount = "cloudwatchMetricInsightsCrossAccount"

	// FlagPrometheusAzureOverrideAudience
	// Deprecated. Allow override default AAD audience for Azure Prometheus endpoint. Enabled by default. This feature should no longer be used and will be removed in the future.
	FlagPrometheusAzureOverrideAudience = "prometheusAzureOverrideAudience"

	// FlagAlertingFilterV2
	// Enable the new alerting search experience
	FlagAlertingFilterV2 = "alertingFilterV2"

	// FlagDataplaneAggregator
	// Enable grafana dataplane aggregator
	FlagDataplaneAggregator = "dataplaneAggregator"

	// FlagNewFiltersUI
	// Enables new combobox style UI for the Ad hoc filters variable in scenes architecture
	FlagNewFiltersUI = "newFiltersUI"

	// FlagLokiSendDashboardPanelNames
	// Send dashboard and panel names to Loki when querying
	FlagLokiSendDashboardPanelNames = "lokiSendDashboardPanelNames"

	// FlagAlertingPrometheusRulesPrimary
	// Uses Prometheus rules as the primary source of truth for ruler-enabled data sources
	FlagAlertingPrometheusRulesPrimary = "alertingPrometheusRulesPrimary"

	// FlagSingleTopNav
	// Unifies the top search bar and breadcrumb bar into one
	FlagSingleTopNav = "singleTopNav"

	// FlagExploreLogsShardSplitting
	// Used in Explore Logs to split queries into multiple queries based on the number of shards
	FlagExploreLogsShardSplitting = "exploreLogsShardSplitting"

	// FlagExploreLogsAggregatedMetrics
	// Used in Explore Logs to query by aggregated metrics
	FlagExploreLogsAggregatedMetrics = "exploreLogsAggregatedMetrics"

	// FlagExploreLogsLimitedTimeRange
	// Used in Explore Logs to limit the time range
	FlagExploreLogsLimitedTimeRange = "exploreLogsLimitedTimeRange"

	// FlagHomeSetupGuide
	// Used in Home for users who want to return to the onboarding flow or quickly find popular config pages
	FlagHomeSetupGuide = "homeSetupGuide"

	// FlagAppPlatformGrpcClientAuth
	// Enables the gRPC client to authenticate with the App Platform by using ID &amp; access tokens
	FlagAppPlatformGrpcClientAuth = "appPlatformGrpcClientAuth"

	// FlagAppSidecar
	// Enable the app sidecar feature that allows rendering 2 apps at the same time
	FlagAppSidecar = "appSidecar"

	// FlagGroupAttributeSync
	// Enable the groupsync extension for managing Group Attribute Sync feature
	FlagGroupAttributeSync = "groupAttributeSync"

	// FlagAlertingQueryAndExpressionsStepMode
	// Enables step mode for alerting queries and expressions
	FlagAlertingQueryAndExpressionsStepMode = "alertingQueryAndExpressionsStepMode"

	// FlagImprovedExternalSessionHandling
	// Enable improved support for external sessions in Grafana
	FlagImprovedExternalSessionHandling = "improvedExternalSessionHandling"

	// FlagUseSessionStorageForRedirection
	// Use session storage for handling the redirection after login
	FlagUseSessionStorageForRedirection = "useSessionStorageForRedirection"

	// FlagRolePickerDrawer
	// Enables the new role picker drawer design
	FlagRolePickerDrawer = "rolePickerDrawer"

	// FlagUnifiedStorageSearch
	// Enable unified storage search
	FlagUnifiedStorageSearch = "unifiedStorageSearch"

	// FlagPluginsSriChecks
	// Enables SRI checks for plugin assets
	FlagPluginsSriChecks = "pluginsSriChecks"

	// FlagUnifiedStorageBigObjectsSupport
	// Enables to save big objects in blob storage
	FlagUnifiedStorageBigObjectsSupport = "unifiedStorageBigObjectsSupport"

	// FlagTimeRangeProvider
	// Enables time pickers sync
	FlagTimeRangeProvider = "timeRangeProvider"

	// FlagPrometheusUsesCombobox
	// Use new combobox component for Prometheus query editor
	FlagPrometheusUsesCombobox = "prometheusUsesCombobox"

	// FlagAzureMonitorDisableLogLimit
	// Disables the log limit restriction for Azure Monitor when true. The limit is enabled by default.
	FlagAzureMonitorDisableLogLimit = "azureMonitorDisableLogLimit"

	// FlagDashboardSchemaV2
	// Enables the new dashboard schema version 2, implementing changes necessary for dynamic dashboards and dashboards as code.
	FlagDashboardSchemaV2 = "dashboardSchemaV2"

	// FlagPlaylistsWatcher
	// Enables experimental watcher for playlists
	FlagPlaylistsWatcher = "playlistsWatcher"

	// FlagExploreMetricsRelatedLogs
	// Display Related Logs in Explore Metrics
	FlagExploreMetricsRelatedLogs = "exploreMetricsRelatedLogs"

	// FlagEnableExtensionsAdminPage
	// Enables the extension admin page regardless of development mode
	FlagEnableExtensionsAdminPage = "enableExtensionsAdminPage"
)
