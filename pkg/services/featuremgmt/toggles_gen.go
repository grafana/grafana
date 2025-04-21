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

	// FlagPanelTitleSearch
	// Search for dashboards using panel title
	FlagPanelTitleSearch = "panelTitleSearch"

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

	// FlagCanvasPanelNesting
	// Allow elements nesting
	FlagCanvasPanelNesting = "canvasPanelNesting"

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

	// FlagNestedFolders
	// Enable folder nesting
	FlagNestedFolders = "nestedFolders"

	// FlagAlertingBacktesting
	// Rule backtesting API for alerting
	FlagAlertingBacktesting = "alertingBacktesting"

	// FlagEditPanelCSVDragAndDrop
	// Enables drag and drop for CSV and Excel files
	FlagEditPanelCSVDragAndDrop = "editPanelCSVDragAndDrop"

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

	// FlagInfluxdbBackendMigration
	// Query InfluxDB InfluxQL without the proxy
	FlagInfluxdbBackendMigration = "influxdbBackendMigration"

	// FlagInfluxqlStreamingParser
	// Enable streaming JSON parser for InfluxDB datasource InfluxQL query language
	FlagInfluxqlStreamingParser = "influxqlStreamingParser"

	// FlagInfluxdbRunQueriesInParallel
	// Enables running InfluxDB Influxql queries in parallel
	FlagInfluxdbRunQueriesInParallel = "influxdbRunQueriesInParallel"

	// FlagLokiLogsDataplane
	// Changes logs responses from Loki to be compliant with the dataplane specification.
	FlagLokiLogsDataplane = "lokiLogsDataplane"

	// FlagDataplaneFrontendFallback
	// Support dataplane contract field name change for transformations and field name matchers where the name is different
	FlagDataplaneFrontendFallback = "dataplaneFrontendFallback"

	// FlagDisableSSEDataplane
	// Disables dataplane specific processing in server side expressions.
	FlagDisableSSEDataplane = "disableSSEDataplane"

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

	// FlagDatasourceAPIServers
	// Expose some datasources as apiservers.
	FlagDatasourceAPIServers = "datasourceAPIServers"

	// FlagGrafanaAPIServerWithExperimentalAPIs
	// Register experimental APIs with the k8s API server, including all datasources
	FlagGrafanaAPIServerWithExperimentalAPIs = "grafanaAPIServerWithExperimentalAPIs"

	// FlagProvisioning
	// Next generation provisioning... and git
	FlagProvisioning = "provisioning"

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

	// FlagConfigurableSchedulerTick
	// Enable changing the scheduler base interval via configuration option unified_alerting.scheduler_tick_interval
	FlagConfigurableSchedulerTick = "configurableSchedulerTick"

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

	// FlagKubernetesPlaylists
	// Use the kubernetes API in the frontend for playlists, and route /api/playlist requests to k8s
	FlagKubernetesPlaylists = "kubernetesPlaylists"

	// FlagKubernetesSnapshots
	// Routes snapshot requests from /api to the /apis endpoint
	FlagKubernetesSnapshots = "kubernetesSnapshots"

	// FlagKubernetesDashboards
	// Use the kubernetes API in the frontend for dashboards
	FlagKubernetesDashboards = "kubernetesDashboards"

	// FlagKubernetesClientDashboardsFolders
	// Route the folder and dashboard service requests to k8s
	FlagKubernetesClientDashboardsFolders = "kubernetesClientDashboardsFolders"

	// FlagDashboardDisableSchemaValidationV1
	// Disable schema validation for dashboards/v1
	FlagDashboardDisableSchemaValidationV1 = "dashboardDisableSchemaValidationV1"

	// FlagDashboardDisableSchemaValidationV2
	// Disable schema validation for dashboards/v2
	FlagDashboardDisableSchemaValidationV2 = "dashboardDisableSchemaValidationV2"

	// FlagDashboardSchemaValidationLogging
	// Log schema validation errors so they can be analyzed later
	FlagDashboardSchemaValidationLogging = "dashboardSchemaValidationLogging"

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

	// FlagQueryServiceFromExplore
	// Routes explore requests to the new query service
	FlagQueryServiceFromExplore = "queryServiceFromExplore"

	// FlagCloudWatchBatchQueries
	// Runs CloudWatch metrics queries as separate batches
	FlagCloudWatchBatchQueries = "cloudWatchBatchQueries"

	// FlagRecoveryThreshold
	// Enables feature recovery threshold (aka hysteresis) for threshold server-side expression
	FlagRecoveryThreshold = "recoveryThreshold"

	// FlagLokiStructuredMetadata
	// Enables the loki data source to request structured metadata from the Loki server
	FlagLokiStructuredMetadata = "lokiStructuredMetadata"

	// FlagCachingOptimizeSerializationMemoryUsage
	// If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses.
	FlagCachingOptimizeSerializationMemoryUsage = "cachingOptimizeSerializationMemoryUsage"

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
	// Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group. Disables sequential evaluation if enabled.
	FlagJitterAlertRulesWithinGroups = "jitterAlertRulesWithinGroups"

	// FlagOnPremToCloudMigrations
	// Enable the Grafana Migration Assistant, which helps you easily migrate various on-prem resources to your Grafana Cloud stack.
	FlagOnPremToCloudMigrations = "onPremToCloudMigrations"

	// FlagSecretsManagementAppPlatform
	// Enable the secrets management API and services under app platform
	FlagSecretsManagementAppPlatform = "secretsManagementAppPlatform"

	// FlagAlertingSaveStatePeriodic
	// Writes the state periodically to the database, asynchronous to rule evaluation
	FlagAlertingSaveStatePeriodic = "alertingSaveStatePeriodic"

	// FlagAlertingSaveStateCompressed
	// Enables the compressed protobuf-based alert state storage
	FlagAlertingSaveStateCompressed = "alertingSaveStateCompressed"

	// FlagScopeApi
	// In-development feature flag for the scope api using the app platform.
	FlagScopeApi = "scopeApi"

	// FlagPromQLScope
	// In-development feature that will allow injection of labels into prometheus queries.
	FlagPromQLScope = "promQLScope"

	// FlagLogQLScope
	// In-development feature that will allow injection of labels into loki queries.
	FlagLogQLScope = "logQLScope"

	// FlagSqlExpressions
	// Enables SQL Expressions, which can execute SQL queries against data source results.
	FlagSqlExpressions = "sqlExpressions"

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

	// FlagAzureMonitorPrometheusExemplars
	// Allows configuration of Azure Monitor as a data source that can provide Prometheus exemplars
	FlagAzureMonitorPrometheusExemplars = "azureMonitorPrometheusExemplars"

	// FlagPinNavItems
	// Enables pinning of nav items
	FlagPinNavItems = "pinNavItems"

	// FlagAuthZGRPCServer
	// Enables the gRPC server for authorization
	FlagAuthZGRPCServer = "authZGRPCServer"

	// FlagSsoSettingsLDAP
	// Use the new SSO Settings API to configure LDAP
	FlagSsoSettingsLDAP = "ssoSettingsLDAP"

	// FlagFailWrongDSUID
	// Throws an error if a data source has an invalid UIDs
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

	// FlagCloudWatchRoundUpEndTime
	// Round up end time for metric queries to the next minute to avoid missing data
	FlagCloudWatchRoundUpEndTime = "cloudWatchRoundUpEndTime"

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

	// FlagTableNextGen
	// Allows access to the new react-data-grid based table component.
	FlagTableNextGen = "tableNextGen"

	// FlagLokiSendDashboardPanelNames
	// Send dashboard and panel names to Loki when querying
	FlagLokiSendDashboardPanelNames = "lokiSendDashboardPanelNames"

	// FlagAlertingPrometheusRulesPrimary
	// Uses Prometheus rules as the primary source of truth for ruler-enabled data sources
	FlagAlertingPrometheusRulesPrimary = "alertingPrometheusRulesPrimary"

	// FlagExploreLogsShardSplitting
	// Used in Logs Drilldown to split queries into multiple queries based on the number of shards
	FlagExploreLogsShardSplitting = "exploreLogsShardSplitting"

	// FlagExploreLogsAggregatedMetrics
	// Used in Logs Drilldown to query by aggregated metrics
	FlagExploreLogsAggregatedMetrics = "exploreLogsAggregatedMetrics"

	// FlagExploreLogsLimitedTimeRange
	// Used in Logs Drilldown to limit the time range
	FlagExploreLogsLimitedTimeRange = "exploreLogsLimitedTimeRange"

	// FlagHomeSetupGuide
	// Used in Home for users who want to return to the onboarding flow or quickly find popular config pages
	FlagHomeSetupGuide = "homeSetupGuide"

	// FlagAppPlatformGrpcClientAuth
	// Enables the gRPC client to authenticate with the App Platform by using ID &amp; access tokens
	FlagAppPlatformGrpcClientAuth = "appPlatformGrpcClientAuth"

	// FlagGroupAttributeSync
	// Enable the groupsync extension for managing Group Attribute Sync feature
	FlagGroupAttributeSync = "groupAttributeSync"

	// FlagAlertingQueryAndExpressionsStepMode
	// Enables step mode for alerting queries and expressions
	FlagAlertingQueryAndExpressionsStepMode = "alertingQueryAndExpressionsStepMode"

	// FlagImprovedExternalSessionHandling
	// Enables improved support for OAuth external sessions. After enabling this feature, users might need to re-authenticate themselves.
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

	// FlagUnifiedStorageSearchSprinkles
	// Enable sprinkles on unified storage search
	FlagUnifiedStorageSearchSprinkles = "unifiedStorageSearchSprinkles"

	// FlagUnifiedStorageSearchPermissionFiltering
	// Enable permission filtering on unified storage search
	FlagUnifiedStorageSearchPermissionFiltering = "unifiedStorageSearchPermissionFiltering"

	// FlagManagedDualWriter
	// Pick the dual write mode from database configs
	FlagManagedDualWriter = "managedDualWriter"

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
	// Use new **Combobox** component for Prometheus query editor
	FlagPrometheusUsesCombobox = "prometheusUsesCombobox"

	// FlagAzureMonitorDisableLogLimit
	// Disables the log limit restriction for Azure Monitor when true. The limit is enabled by default.
	FlagAzureMonitorDisableLogLimit = "azureMonitorDisableLogLimit"

	// FlagPreinstallAutoUpdate
	// Enables automatic updates for pre-installed plugins
	FlagPreinstallAutoUpdate = "preinstallAutoUpdate"

	// FlagPlaylistsReconciler
	// Enables experimental reconciler for playlists
	FlagPlaylistsReconciler = "playlistsReconciler"

	// FlagPasswordlessMagicLinkAuthentication
	// Enable passwordless login via magic link authentication
	FlagPasswordlessMagicLinkAuthentication = "passwordlessMagicLinkAuthentication"

	// FlagExploreMetricsRelatedLogs
	// Display Related Logs in Grafana Metrics Drilldown
	FlagExploreMetricsRelatedLogs = "exploreMetricsRelatedLogs"

	// FlagPrometheusSpecialCharsInLabelValues
	// Adds support for quotes and special characters in label values for Prometheus queries
	FlagPrometheusSpecialCharsInLabelValues = "prometheusSpecialCharsInLabelValues"

	// FlagEnableExtensionsAdminPage
	// Enables the extension admin page regardless of development mode
	FlagEnableExtensionsAdminPage = "enableExtensionsAdminPage"

	// FlagEnableSCIM
	// Enables SCIM support for user and group management
	FlagEnableSCIM = "enableSCIM"

	// FlagCrashDetection
	// Enables browser crash detection reporting to Faro.
	FlagCrashDetection = "crashDetection"

	// FlagJaegerBackendMigration
	// Enables querying the Jaeger data source without the proxy
	FlagJaegerBackendMigration = "jaegerBackendMigration"

	// FlagReportingUseRawTimeRange
	// Uses the original report or dashboard time range instead of making an absolute transformation
	FlagReportingUseRawTimeRange = "reportingUseRawTimeRange"

	// FlagAlertingUIOptimizeReducer
	// Enables removing the reducer from the alerting UI when creating a new alert rule and using instant query
	FlagAlertingUIOptimizeReducer = "alertingUIOptimizeReducer"

	// FlagAzureMonitorEnableUserAuth
	// Enables user auth for Azure Monitor datasource only
	FlagAzureMonitorEnableUserAuth = "azureMonitorEnableUserAuth"

	// FlagAlertingNotificationsStepMode
	// Enables simplified step mode in the notifications section
	FlagAlertingNotificationsStepMode = "alertingNotificationsStepMode"

	// FlagFeedbackButton
	// Enables a button to send feedback from the Grafana UI
	FlagFeedbackButton = "feedbackButton"

	// FlagUnifiedStorageSearchUI
	// Enable unified storage search UI
	FlagUnifiedStorageSearchUI = "unifiedStorageSearchUI"

	// FlagElasticsearchCrossClusterSearch
	// Enables cross cluster search in the Elasticsearch datasource
	FlagElasticsearchCrossClusterSearch = "elasticsearchCrossClusterSearch"

	// FlagUnifiedHistory
	// Displays the navigation history so the user can navigate back to previous pages
	FlagUnifiedHistory = "unifiedHistory"

	// FlagLokiLabelNamesQueryApi
	// Defaults to using the Loki `/labels` API instead of `/series`
	FlagLokiLabelNamesQueryApi = "lokiLabelNamesQueryApi"

	// FlagInvestigationsBackend
	// Enable the investigations backend API
	FlagInvestigationsBackend = "investigationsBackend"

	// FlagK8SFolderCounts
	// Enable folder&#39;s api server counts
	FlagK8SFolderCounts = "k8SFolderCounts"

	// FlagK8SFolderMove
	// Enable folder&#39;s api server move
	FlagK8SFolderMove = "k8SFolderMove"

	// FlagImprovedExternalSessionHandlingSAML
	// Enables improved support for SAML external sessions. Ensure the NameID format is correctly configured in Grafana for SAML Single Logout to function properly.
	FlagImprovedExternalSessionHandlingSAML = "improvedExternalSessionHandlingSAML"

	// FlagTeamHttpHeadersMimir
	// Enables LBAC for datasources for Mimir to apply LBAC filtering of metrics to the client requests for users in teams
	FlagTeamHttpHeadersMimir = "teamHttpHeadersMimir"

	// FlagABTestFeatureToggleA
	// Test feature toggle to see how cohorts could be set up AB testing
	FlagABTestFeatureToggleA = "ABTestFeatureToggleA"

	// FlagTemplateVariablesUsesCombobox
	// Use new **Combobox** component for template variables
	FlagTemplateVariablesUsesCombobox = "templateVariablesUsesCombobox"

	// FlagABTestFeatureToggleB
	// Test feature toggle to see how cohorts could be set up AB testing
	FlagABTestFeatureToggleB = "ABTestFeatureToggleB"

	// FlagGrafanaAdvisor
	// Enables Advisor app
	FlagGrafanaAdvisor = "grafanaAdvisor"

	// FlagElasticsearchImprovedParsing
	// Enables less memory intensive Elasticsearch result parsing
	FlagElasticsearchImprovedParsing = "elasticsearchImprovedParsing"

	// FlagDatasourceConnectionsTab
	// Shows defined connections for a data source in the plugins detail page
	FlagDatasourceConnectionsTab = "datasourceConnectionsTab"

	// FlagFetchRulesUsingPost
	// Use a POST request to list rules by passing down the namespaces user has access to
	FlagFetchRulesUsingPost = "fetchRulesUsingPost"

	// FlagNewLogsPanel
	// Enables the new logs panel in Explore
	FlagNewLogsPanel = "newLogsPanel"

	// FlagGrafanaconThemes
	// Enables the temporary themes for GrafanaCon
	FlagGrafanaconThemes = "grafanaconThemes"

	// FlagPluginsCDNSyncLoader
	// Loads plugins from CDN synchronously
	FlagPluginsCDNSyncLoader = "pluginsCDNSyncLoader"

	// FlagAlertingJiraIntegration
	// Enables the new Jira integration for contact points in cloud alert managers.
	FlagAlertingJiraIntegration = "alertingJiraIntegration"

	// FlagUseScopesNavigationEndpoint
	// Use the scopes navigation endpoint instead of the dashboardbindings endpoint
	FlagUseScopesNavigationEndpoint = "useScopesNavigationEndpoint"

	// FlagScopeSearchAllLevels
	// Enable scope search to include all levels of the scope node tree
	FlagScopeSearchAllLevels = "scopeSearchAllLevels"

	// FlagAlertingRuleVersionHistoryRestore
	// Enables the alert rule version history restore feature
	FlagAlertingRuleVersionHistoryRestore = "alertingRuleVersionHistoryRestore"

	// FlagNewShareReportDrawer
	// Enables the report creation drawer in a dashboard
	FlagNewShareReportDrawer = "newShareReportDrawer"

	// FlagRendererDisableAppPluginsPreload
	// Disable pre-loading app plugins when the request is coming from the renderer
	FlagRendererDisableAppPluginsPreload = "rendererDisableAppPluginsPreload"

	// FlagAssetSriChecks
	// Enables SRI checks for Grafana JavaScript assets
	FlagAssetSriChecks = "assetSriChecks"

	// FlagAlertRuleRestore
	// Enables the alert rule restore feature
	FlagAlertRuleRestore = "alertRuleRestore"

	// FlagGrafanaManagedRecordingRulesDatasources
	// Enables writing to data sources for Grafana-managed recording rules.
	FlagGrafanaManagedRecordingRulesDatasources = "grafanaManagedRecordingRulesDatasources"

	// FlagInfinityRunQueriesInParallel
	// Enables running Infinity queries in parallel
	FlagInfinityRunQueriesInParallel = "infinityRunQueriesInParallel"

	// FlagInviteUserExperimental
	// Renders invite user button along the app
	FlagInviteUserExperimental = "inviteUserExperimental"

	// FlagAlertingMigrationUI
	// Enables the alerting migration UI, to migrate datasource-managed rules to Grafana-managed rules
	FlagAlertingMigrationUI = "alertingMigrationUI"

	// FlagUnifiedStorageHistoryPruner
	// Enables the unified storage history pruner
	FlagUnifiedStorageHistoryPruner = "unifiedStorageHistoryPruner"

	// FlagAzureMonitorLogsBuilderEditor
	// Enables the logs builder mode for the Azure Monitor data source
	FlagAzureMonitorLogsBuilderEditor = "azureMonitorLogsBuilderEditor"

	// FlagLocaleFormatPreference
	// Specifies the locale so the correct format for numbers and dates can be shown
	FlagLocaleFormatPreference = "localeFormatPreference"

	// FlagUnifiedStorageGrpcConnectionPool
	// Enables the unified storage grpc connection pool
	FlagUnifiedStorageGrpcConnectionPool = "unifiedStorageGrpcConnectionPool"

	// FlagExtensionSidebar
	// Enables the extension sidebar
	FlagExtensionSidebar = "extensionSidebar"

	// FlagAlertingRulePermanentlyDelete
	// Enables UI functionality to permanently delete alert rules
	FlagAlertingRulePermanentlyDelete = "alertingRulePermanentlyDelete"

	// FlagAlertingRuleRecoverDeleted
	// Enables the UI functionality to recover and view deleted alert rules
	FlagAlertingRuleRecoverDeleted = "alertingRuleRecoverDeleted"

	// FlagXrayApplicationSignals
	// Support Application Signals queries in the X-Ray datasource
	FlagXrayApplicationSignals = "xrayApplicationSignals"

	// FlagMultiTenantTempCredentials
	// use multi-tenant path for awsTempCredentials
	FlagMultiTenantTempCredentials = "multiTenantTempCredentials"

	// FlagLocalizationForPlugins
	// Enables localization for plugins
	FlagLocalizationForPlugins = "localizationForPlugins"

	// FlagUnifiedNavbars
	// Enables unified navbars
	FlagUnifiedNavbars = "unifiedNavbars"

	// FlagLogsPanelControls
	// Enables a control component for the logs panel in Explore
	FlagLogsPanelControls = "logsPanelControls"

	// FlagMetricsFromProfiles
	// Enables creating metrics from profiles and storing them as recording rules
	FlagMetricsFromProfiles = "metricsFromProfiles"

	// FlagPluginsAutoUpdate
	// Enables auto-updating of users installed plugins
	FlagPluginsAutoUpdate = "pluginsAutoUpdate"
)
