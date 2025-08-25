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

	// FlagPluginsFrontendSandbox
	// Enables the plugins frontend sandbox
	FlagPluginsFrontendSandbox = "pluginsFrontendSandbox"

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

	// FlagLokiRunQueriesInParallel
	// Enables running Loki queries in parallel
	FlagLokiRunQueriesInParallel = "lokiRunQueriesInParallel"

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

	// FlagKubernetesSnapshots
	// Routes snapshot requests from /api to the /apis endpoint
	FlagKubernetesSnapshots = "kubernetesSnapshots"

	// FlagKubernetesLibraryPanels
	// Routes library panel requests from /api to the /apis endpoint
	FlagKubernetesLibraryPanels = "kubernetesLibraryPanels"

	// FlagKubernetesDashboards
	// Use the kubernetes API in the frontend for dashboards
	FlagKubernetesDashboards = "kubernetesDashboards"

	// FlagKubernetesShortURLs
	// Routes short url requests from /api to the /apis endpoint
	FlagKubernetesShortURLs = "kubernetesShortURLs"

	// FlagKubernetesAlertingRules
	// Adds support for Kubernetes alerting and recording rules
	FlagKubernetesAlertingRules = "kubernetesAlertingRules"

	// FlagDashboardDisableSchemaValidationV1
	// Disable schema validation for dashboards/v1
	FlagDashboardDisableSchemaValidationV1 = "dashboardDisableSchemaValidationV1"

	// FlagDashboardDisableSchemaValidationV2
	// Disable schema validation for dashboards/v2
	FlagDashboardDisableSchemaValidationV2 = "dashboardDisableSchemaValidationV2"

	// FlagDashboardSchemaValidationLogging
	// Log schema validation errors so they can be analyzed later
	FlagDashboardSchemaValidationLogging = "dashboardSchemaValidationLogging"

	// FlagScanRowInvalidDashboardParseFallbackEnabled
	// Enable fallback parsing behavior when scan row encounters invalid dashboard JSON
	FlagScanRowInvalidDashboardParseFallbackEnabled = "scanRowInvalidDashboardParseFallbackEnabled"

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

	// FlagCachingOptimizeSerializationMemoryUsage
	// If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses.
	FlagCachingOptimizeSerializationMemoryUsage = "cachingOptimizeSerializationMemoryUsage"

	// FlagAddFieldFromCalculationStatFunctions
	// Add cumulative and window functions to the add field from calculation transformation
	FlagAddFieldFromCalculationStatFunctions = "addFieldFromCalculationStatFunctions"

	// FlagAlertmanagerRemoteSecondary
	// Enable Grafana to sync configuration and state with a remote Alertmanager.
	FlagAlertmanagerRemoteSecondary = "alertmanagerRemoteSecondary"

	// FlagAlertingProvenanceLockWrites
	// Enables a feature to avoid issues with concurrent writes to the alerting provenance table in MySQL
	FlagAlertingProvenanceLockWrites = "alertingProvenanceLockWrites"

	// FlagAlertmanagerRemotePrimary
	// Enable Grafana to have a remote Alertmanager instance as the primary Alertmanager.
	FlagAlertmanagerRemotePrimary = "alertmanagerRemotePrimary"

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

	// FlagCanvasPanelPanZoom
	// Allow pan and zoom in canvas panel
	FlagCanvasPanelPanZoom = "canvasPanelPanZoom"

	// FlagTimeComparison
	// Enables time comparison option in supported panels
	FlagTimeComparison = "timeComparison"

	// FlagLogsInfiniteScrolling
	// Enables infinite scrolling for the Logs panel in Explore and Dashboards
	FlagLogsInfiniteScrolling = "logsInfiniteScrolling"

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

	// FlagKubernetesFeatureToggles
	// Use the kubernetes API for feature toggle management in the frontend
	FlagKubernetesFeatureToggles = "kubernetesFeatureToggles"

	// FlagCloudRBACRoles
	// Enabled grafana cloud specific RBAC roles
	FlagCloudRBACRoles = "cloudRBACRoles"

	// FlagAlertingQueryOptimization
	// Optimizes eligible queries in order to reduce load on datasources
	FlagAlertingQueryOptimization = "alertingQueryOptimization"

	// FlagJitterAlertRulesWithinGroups
	// Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group. Disables sequential evaluation if enabled.
	FlagJitterAlertRulesWithinGroups = "jitterAlertRulesWithinGroups"

	// FlagOnPremToCloudMigrations
	// Enable the Grafana Migration Assistant, which helps you easily migrate various on-prem resources to your Grafana Cloud stack.
	FlagOnPremToCloudMigrations = "onPremToCloudMigrations"

	// FlagSecretsManagementAppPlatform
	// Enable the secrets management API and services under app platform
	FlagSecretsManagementAppPlatform = "secretsManagementAppPlatform"

	// FlagSecretsManagementAppPlatformUI
	// Enable the secrets management app platform UI
	FlagSecretsManagementAppPlatformUI = "secretsManagementAppPlatformUI"

	// FlagAlertingSaveStatePeriodic
	// Writes the state periodically to the database, asynchronous to rule evaluation
	FlagAlertingSaveStatePeriodic = "alertingSaveStatePeriodic"

	// FlagAlertingSaveStateCompressed
	// Enables the compressed protobuf-based alert state storage
	FlagAlertingSaveStateCompressed = "alertingSaveStateCompressed"

	// FlagScopeApi
	// In-development feature flag for the scope api using the app platform.
	FlagScopeApi = "scopeApi"

	// FlagUseScopeSingleNodeEndpoint
	// Use the single node endpoint for the scope api. This is used to fetch the scope parent node.
	FlagUseScopeSingleNodeEndpoint = "useScopeSingleNodeEndpoint"

	// FlagPromQLScope
	// In-development feature that will allow injection of labels into prometheus queries.
	FlagPromQLScope = "promQLScope"

	// FlagLogQLScope
	// In-development feature that will allow injection of labels into loki queries.
	FlagLogQLScope = "logQLScope"

	// FlagSqlExpressions
	// Enables SQL Expressions, which can execute SQL queries against data source results.
	FlagSqlExpressions = "sqlExpressions"

	// FlagSqlExpressionsColumnAutoComplete
	// Enables column autocomplete for SQL Expressions
	FlagSqlExpressionsColumnAutoComplete = "sqlExpressionsColumnAutoComplete"

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

	// FlagKubernetesAggregatorCapTokenAuth
	// Enable CAP token based authentication in grafana&#39;s embedded kube-aggregator
	FlagKubernetesAggregatorCapTokenAuth = "kubernetesAggregatorCapTokenAuth"

	// FlagGroupByVariable
	// Enable groupBy variable support in scenes dashboards
	FlagGroupByVariable = "groupByVariable"

	// FlagScopeFilters
	// Enables the use of scope filters in Grafana
	FlagScopeFilters = "scopeFilters"

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
	// Renamed feature toggle, enables Saved queries feature
	FlagQueryLibrary = "queryLibrary"

	// FlagSavedQueries
	// Enables Saved Queries feature
	FlagSavedQueries = "savedQueries"

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

	// FlagVizActionsAuth
	// Allows authenticated API calls in actions
	FlagVizActionsAuth = "vizActionsAuth"

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

	// FlagAlertingUIOptimizeReducer
	// Enables removing the reducer from the alerting UI when creating a new alert rule and using instant query
	FlagAlertingUIOptimizeReducer = "alertingUIOptimizeReducer"

	// FlagAzureMonitorEnableUserAuth
	// Enables user auth for Azure Monitor datasource only
	FlagAzureMonitorEnableUserAuth = "azureMonitorEnableUserAuth"

	// FlagAlertingAIGenAlertRules
	// Enable AI-generated alert rules.
	FlagAlertingAIGenAlertRules = "alertingAIGenAlertRules"

	// FlagAlertingAIFeedback
	// Enable AI-generated feedback from the Grafana UI.
	FlagAlertingAIFeedback = "alertingAIFeedback"

	// FlagAlertingAIImproveAlertRules
	// Enable AI-improve alert rules labels and annotations.
	FlagAlertingAIImproveAlertRules = "alertingAIImproveAlertRules"

	// FlagAlertingAIGenTemplates
	// Enable AI-generated alerting templates.
	FlagAlertingAIGenTemplates = "alertingAIGenTemplates"

	// FlagAlertingEnrichmentPerRule
	// Enable enrichment per rule in the alerting UI.
	FlagAlertingEnrichmentPerRule = "alertingEnrichmentPerRule"

	// FlagAlertingAIAnalyzeCentralStateHistory
	// Enable AI-analyze central state history.
	FlagAlertingAIAnalyzeCentralStateHistory = "alertingAIAnalyzeCentralStateHistory"

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
	// Enables cross cluster search in the Elasticsearch data source
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

	// FlagTeamHttpHeadersTempo
	// Enables LBAC for datasources for Tempo to apply LBAC filtering of traces to the client requests for users in teams
	FlagTeamHttpHeadersTempo = "teamHttpHeadersTempo"

	// FlagTemplateVariablesUsesCombobox
	// Use new **Combobox** component for template variables
	FlagTemplateVariablesUsesCombobox = "templateVariablesUsesCombobox"

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

	// FlagInfinityRunQueriesInParallel
	// Enables running Infinity queries in parallel
	FlagInfinityRunQueriesInParallel = "infinityRunQueriesInParallel"

	// FlagInviteUserExperimental
	// Renders invite user button along the app
	FlagInviteUserExperimental = "inviteUserExperimental"

	// FlagAlertingMigrationUI
	// Enables the alerting migration UI, to migrate data source-managed rules to Grafana-managed rules
	FlagAlertingMigrationUI = "alertingMigrationUI"

	// FlagAlertingImportYAMLUI
	// Enables a UI feature for importing rules from a Prometheus file to Grafana-managed rules
	FlagAlertingImportYAMLUI = "alertingImportYAMLUI"

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

	// FlagAlertingRulePermanentlyDelete
	// Enables UI functionality to permanently delete alert rules
	FlagAlertingRulePermanentlyDelete = "alertingRulePermanentlyDelete"

	// FlagAlertingRuleRecoverDeleted
	// Enables the UI functionality to recover and view deleted alert rules
	FlagAlertingRuleRecoverDeleted = "alertingRuleRecoverDeleted"

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

	// FlagGrafanaAssistantInProfilesDrilldown
	// Enables integration with Grafana Assistant in Profiles Drilldown
	FlagGrafanaAssistantInProfilesDrilldown = "grafanaAssistantInProfilesDrilldown"

	// FlagPostgresDSUsePGX
	// Enables using PGX instead of libpq for PostgreSQL datasource
	FlagPostgresDSUsePGX = "postgresDSUsePGX"

	// FlagTempoAlerting
	// Enables creating alerts from Tempo data source
	FlagTempoAlerting = "tempoAlerting"

	// FlagPluginsAutoUpdate
	// Enables auto-updating of users installed plugins
	FlagPluginsAutoUpdate = "pluginsAutoUpdate"

	// FlagAlertingListViewV2PreviewToggle
	// Enables the alerting list view v2 preview toggle
	FlagAlertingListViewV2PreviewToggle = "alertingListViewV2PreviewToggle"

	// FlagAlertRuleUseFiredAtForStartsAt
	// Use FiredAt for StartsAt when sending alerts to Alertmaanger
	FlagAlertRuleUseFiredAtForStartsAt = "alertRuleUseFiredAtForStartsAt"

	// FlagAlertingBulkActionsInUI
	// Enables the alerting bulk actions in the UI
	FlagAlertingBulkActionsInUI = "alertingBulkActionsInUI"

	// FlagKubernetesAuthzApis
	// Registers AuthZ /apis endpoint
	FlagKubernetesAuthzApis = "kubernetesAuthzApis"

	// FlagKubernetesAuthzResourcePermissionApis
	// Registers AuthZ resource permission /apis endpoints
	FlagKubernetesAuthzResourcePermissionApis = "kubernetesAuthzResourcePermissionApis"

	// FlagKubernetesAuthnMutation
	// Enables create, delete, and update mutations for resources owned by IAM identity
	FlagKubernetesAuthnMutation = "kubernetesAuthnMutation"

	// FlagRestoreDashboards
	// Enables restore deleted dashboards feature
	FlagRestoreDashboards = "restoreDashboards"

	// FlagSkipTokenRotationIfRecent
	// Skip token rotation if it was already rotated less than 5 seconds ago
	FlagSkipTokenRotationIfRecent = "skipTokenRotationIfRecent"

	// FlagAlertEnrichment
	// Enable configuration of alert enrichments in Grafana Cloud.
	FlagAlertEnrichment = "alertEnrichment"

	// FlagAlertEnrichmentMultiStep
	// Allow multiple steps per enrichment.
	FlagAlertEnrichmentMultiStep = "alertEnrichmentMultiStep"

	// FlagAlertEnrichmentConditional
	// Enable conditional alert enrichment steps.
	FlagAlertEnrichmentConditional = "alertEnrichmentConditional"

	// FlagAlertingImportAlertmanagerAPI
	// Enables the API to import Alertmanager configuration
	FlagAlertingImportAlertmanagerAPI = "alertingImportAlertmanagerAPI"

	// FlagAlertingImportAlertmanagerUI
	// Enables the UI to see imported Alertmanager configuration
	FlagAlertingImportAlertmanagerUI = "alertingImportAlertmanagerUI"

	// FlagSharingDashboardImage
	// Enables image sharing functionality for dashboards
	FlagSharingDashboardImage = "sharingDashboardImage"

	// FlagPreferLibraryPanelTitle
	// Prefer library panel title over viz panel title.
	FlagPreferLibraryPanelTitle = "preferLibraryPanelTitle"

	// FlagTabularNumbers
	// Use fixed-width numbers globally in the UI
	FlagTabularNumbers = "tabularNumbers"

	// FlagNewInfluxDSConfigPageDesign
	// Enables new design for the InfluxDB data source configuration page
	FlagNewInfluxDSConfigPageDesign = "newInfluxDSConfigPageDesign"

	// FlagEnableAppChromeExtensions
	// Set this to true to enable all app chrome extensions registered by plugins.
	FlagEnableAppChromeExtensions = "enableAppChromeExtensions"

	// FlagFoldersAppPlatformAPI
	// Enables use of app platform API for folders
	FlagFoldersAppPlatformAPI = "foldersAppPlatformAPI"

	// FlagEnablePluginImporter
	// Set this to true to use the new PluginImporter functionality
	FlagEnablePluginImporter = "enablePluginImporter"

	// FlagOtelLogsFormatting
	// Applies OTel formatting templates to displayed logs
	FlagOtelLogsFormatting = "otelLogsFormatting"

	// FlagAlertingNotificationHistory
	// Enables the notification history feature
	FlagAlertingNotificationHistory = "alertingNotificationHistory"

	// FlagPluginAssetProvider
	// Allows decoupled core plugins to load from the Grafana CDN
	FlagPluginAssetProvider = "pluginAssetProvider"

	// FlagUnifiedStorageSearchDualReaderEnabled
	// Enable dual reader for unified storage search
	FlagUnifiedStorageSearchDualReaderEnabled = "unifiedStorageSearchDualReaderEnabled"

	// FlagDashboardDsAdHocFiltering
	// Enables adhoc filtering support for the dashboard datasource
	FlagDashboardDsAdHocFiltering = "dashboardDsAdHocFiltering"

	// FlagDashboardLevelTimeMacros
	// Supports __from and __to macros that always use the dashboard level time range
	FlagDashboardLevelTimeMacros = "dashboardLevelTimeMacros"

	// FlagAlertmanagerRemoteSecondaryWithRemoteState
	// Starts Grafana in remote secondary mode pulling the latest state from the remote Alertmanager to avoid duplicate notifications.
	FlagAlertmanagerRemoteSecondaryWithRemoteState = "alertmanagerRemoteSecondaryWithRemoteState"

	// FlagRestrictedPluginApis
	// Enables sharing a list of APIs with a list of plugins
	FlagRestrictedPluginApis = "restrictedPluginApis"

	// FlagAdhocFiltersInTooltips
	// Enable adhoc filter buttons in visualization tooltips
	FlagAdhocFiltersInTooltips = "adhocFiltersInTooltips"

	// FlagFavoriteDatasources
	// Enable favorite datasources
	FlagFavoriteDatasources = "favoriteDatasources"

	// FlagNewLogContext
	// New Log Context component
	FlagNewLogContext = "newLogContext"

	// FlagNewClickhouseConfigPageDesign
	// Enables new design for the Clickhouse data source configuration page
	FlagNewClickhouseConfigPageDesign = "newClickhouseConfigPageDesign"

	// FlagUnifiedStorageSearchAfterWriteExperimentalAPI
	// Enable experimental search-after-write guarantees to unified-storage search endpoints
	FlagUnifiedStorageSearchAfterWriteExperimentalAPI = "unifiedStorageSearchAfterWriteExperimentalAPI"

	// FlagTeamFolders
	// Enables team folders functionality
	FlagTeamFolders = "teamFolders"

	// FlagAlertingTriage
	// Enables the alerting triage feature
	FlagAlertingTriage = "alertingTriage"

	// FlagGraphiteBackendMode
	// Enables the Graphite data source full backend mode
	FlagGraphiteBackendMode = "graphiteBackendMode"

	// FlagAzureResourcePickerUpdates
	// Enables the updated Azure Monitor resource picker
	FlagAzureResourcePickerUpdates = "azureResourcePickerUpdates"

	// FlagPrometheusTypeMigration
	// Checks for deprecated Prometheus authentication methods (SigV4 and Azure), installs the relevant data source, and migrates the Prometheus data sources
	FlagPrometheusTypeMigration = "prometheusTypeMigration"

	// FlagDskitBackgroundServices
	// Enables dskit background service wrapper
	FlagDskitBackgroundServices = "dskitBackgroundServices"
)
