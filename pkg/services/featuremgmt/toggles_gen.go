// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature flags, edit:
//  pkg/services/featuremgmt/registry.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go

package featuremgmt

const (
	// FlagReturnUnameHeader
	// Return user login as header for authenticated requests
	FlagReturnUnameHeader = "returnUnameHeader"

	// FlagAlertingBigTransactions
	// Use big transactions for alerting database writes
	FlagAlertingBigTransactions = "alertingBigTransactions"

	// FlagTrimDefaults
	// Use cue schema to remove values that will be applied automatically
	FlagTrimDefaults = "trimDefaults"

	// FlagDisableEnvelopeEncryption
	// Disable envelope encryption (emergency only)
	FlagDisableEnvelopeEncryption = "disableEnvelopeEncryption"

	// FlagDatabaseMetrics
	// Add Prometheus metrics for database tables
	FlagDatabaseMetrics = "database_metrics"

	// FlagDashboardPreviews
	// Create and show thumbnails for dashboard search results
	FlagDashboardPreviews = "dashboardPreviews"

	// FlagDashboardPreviewsAdmin
	// Manage the dashboard previews crawler process from the UI
	FlagDashboardPreviewsAdmin = "dashboardPreviewsAdmin"

	// FlagLiveConfig
	// Save Grafana Live configuration in SQL tables
	FlagLiveConfig = "live-config"

	// FlagLivePipeline
	// Enable a generic live processing pipeline
	FlagLivePipeline = "live-pipeline"

	// FlagLiveServiceWebWorker
	// This will use a webworker thread to processes events rather than the main thread
	FlagLiveServiceWebWorker = "live-service-web-worker"

	// FlagQueryOverLive
	// Use Grafana Live WebSocket to execute backend queries
	FlagQueryOverLive = "queryOverLive"

	// FlagPanelTitleSearch
	// Search for dashboards using panel title
	FlagPanelTitleSearch = "panelTitleSearch"

	// FlagPrometheusAzureOverrideAudience
	// Experimental. Allow override default AAD audience for Azure Prometheus endpoint
	FlagPrometheusAzureOverrideAudience = "prometheusAzureOverrideAudience"

	// FlagShowFeatureFlagsInUI
	// Show feature flags in the settings UI
	FlagShowFeatureFlagsInUI = "showFeatureFlagsInUI"

	// FlagPublicDashboards
	// Enables public access to dashboards
	FlagPublicDashboards = "publicDashboards"

	// FlagPublicDashboardsEmailSharing
	// Allows public dashboard sharing to be restricted to only allowed emails
	FlagPublicDashboardsEmailSharing = "publicDashboardsEmailSharing"

	// FlagLokiLive
	// Support WebSocket streaming for loki (early prototype)
	FlagLokiLive = "lokiLive"

	// FlagLokiDataframeApi
	// Use experimental loki api for WebSocket streaming (early prototype)
	FlagLokiDataframeApi = "lokiDataframeApi"

	// FlagLokiMonacoEditor
	// Access to Monaco query editor for Loki
	FlagLokiMonacoEditor = "lokiMonacoEditor"

	// FlagSwaggerUi
	// Serves swagger UI
	FlagSwaggerUi = "swaggerUi"

	// FlagFeatureHighlights
	// Highlight Grafana Enterprise features
	FlagFeatureHighlights = "featureHighlights"

	// FlagDashboardComments
	// Enable dashboard-wide comments
	FlagDashboardComments = "dashboardComments"

	// FlagAnnotationComments
	// Enable annotation comments
	FlagAnnotationComments = "annotationComments"

	// FlagMigrationLocking
	// Lock database during migrations
	FlagMigrationLocking = "migrationLocking"

	// FlagStorage
	// Configurable storage for dashboards, datasources, and resources
	FlagStorage = "storage"

	// FlagK8s
	// Explore native k8s integrations
	FlagK8s = "k8s"

	// FlagK8sDashboards
	// Save dashboards via k8s
	FlagK8sDashboards = "k8sDashboards"

	// FlagSupportBundles
	// Support bundles for troubleshooting
	FlagSupportBundles = "supportBundles"

	// FlagDashboardsFromStorage
	// Load dashboards from the generic storage interface
	FlagDashboardsFromStorage = "dashboardsFromStorage"

	// FlagExport
	// Export grafana instance (to git, etc)
	FlagExport = "export"

	// FlagExploreMixedDatasource
	// Enable mixed datasource in Explore
	FlagExploreMixedDatasource = "exploreMixedDatasource"

	// FlagTracing
	// Adds trace ID to error notifications
	FlagTracing = "tracing"

	// FlagCommandPalette
	// Enable command palette
	FlagCommandPalette = "commandPalette"

	// FlagCorrelations
	// Correlations page
	FlagCorrelations = "correlations"

	// FlagCloudWatchDynamicLabels
	// Use dynamic labels instead of alias patterns in CloudWatch datasource
	FlagCloudWatchDynamicLabels = "cloudWatchDynamicLabels"

	// FlagDatasourceQueryMultiStatus
	// Introduce HTTP 207 Multi Status for api/ds/query
	FlagDatasourceQueryMultiStatus = "datasourceQueryMultiStatus"

	// FlagTraceToMetrics
	// Enable trace to metrics links
	FlagTraceToMetrics = "traceToMetrics"

	// FlagNewDBLibrary
	// Use jmoiron/sqlx rather than xorm for a few backend services
	FlagNewDBLibrary = "newDBLibrary"

	// FlagValidateDashboardsOnSave
	// Validate dashboard JSON POSTed to api/dashboards/db
	FlagValidateDashboardsOnSave = "validateDashboardsOnSave"

	// FlagAutoMigrateGraphPanels
	// Replace the angular graph panel with timeseries
	FlagAutoMigrateGraphPanels = "autoMigrateGraphPanels"

	// FlagPrometheusWideSeries
	// Enable wide series responses in the Prometheus datasource
	FlagPrometheusWideSeries = "prometheusWideSeries"

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

	// FlagInternationalization
	// Enables internationalization
	FlagInternationalization = "internationalization"

	// FlagTopnav
	// New top nav and page layouts
	FlagTopnav = "topnav"

	// FlagGrpcServer
	// Run GRPC server
	FlagGrpcServer = "grpcServer"

	// FlagEntityStore
	// SQL-based entity store (requires storage flag also)
	FlagEntityStore = "entityStore"

	// FlagFlameGraph
	// Show the flame graph
	FlagFlameGraph = "flameGraph"

	// FlagCloudWatchCrossAccountQuerying
	// Enables cross-account querying in CloudWatch datasources
	FlagCloudWatchCrossAccountQuerying = "cloudWatchCrossAccountQuerying"

	// FlagRedshiftAsyncQueryDataSupport
	// Enable async query data support for Redshift
	FlagRedshiftAsyncQueryDataSupport = "redshiftAsyncQueryDataSupport"

	// FlagAthenaAsyncQueryDataSupport
	// Enable async query data support for Athena
	FlagAthenaAsyncQueryDataSupport = "athenaAsyncQueryDataSupport"

	// FlagIncreaseInMemDatabaseQueryCache
	// Enable more in memory caching for database queries
	FlagIncreaseInMemDatabaseQueryCache = "increaseInMemDatabaseQueryCache"

	// FlagNewPanelChromeUI
	// Show updated look and feel of grafana-ui PanelChrome: panel header, icons, and menu
	FlagNewPanelChromeUI = "newPanelChromeUI"

	// FlagQueryLibrary
	// Reusable query library
	FlagQueryLibrary = "queryLibrary"

	// FlagShowDashboardValidationWarnings
	// Show warnings when dashboards do not validate against the schema
	FlagShowDashboardValidationWarnings = "showDashboardValidationWarnings"

	// FlagMysqlAnsiQuotes
	// Use double quotes to escape keyword in a MySQL query
	FlagMysqlAnsiQuotes = "mysqlAnsiQuotes"

	// FlagDatasourceLogger
	// Logs all datasource requests
	FlagDatasourceLogger = "datasourceLogger"

	// FlagAccessControlOnCall
	// Access control primitives for OnCall
	FlagAccessControlOnCall = "accessControlOnCall"

	// FlagNestedFolders
	// Enable folder nesting
	FlagNestedFolders = "nestedFolders"

	// FlagAccessTokenExpirationCheck
	// Enable OAuth access_token expiration check and token refresh using the refresh_token
	FlagAccessTokenExpirationCheck = "accessTokenExpirationCheck"

	// FlagElasticsearchBackendMigration
	// Use Elasticsearch as backend data source
	FlagElasticsearchBackendMigration = "elasticsearchBackendMigration"

	// FlagDatasourceOnboarding
	// Enable data source onboarding page
	FlagDatasourceOnboarding = "datasourceOnboarding"

	// FlagSecureSocksDatasourceProxy
	// Enable secure socks tunneling for supported core datasources
	FlagSecureSocksDatasourceProxy = "secureSocksDatasourceProxy"

	// FlagAuthnService
	// Use new auth service to perform authentication
	FlagAuthnService = "authnService"

	// FlagSessionRemoteCache
	// Enable using remote cache for user sessions
	FlagSessionRemoteCache = "sessionRemoteCache"

	// FlagDisablePrometheusExemplarSampling
	// Disable Prometheus examplar sampling
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

	// FlagTopNavCommandPalette
	// Launch the Command Palette from the top navigation search box
	FlagTopNavCommandPalette = "topNavCommandPalette"

	// FlagLogsSampleInExplore
	// Enables access to the logs sample feature in Explore
	FlagLogsSampleInExplore = "logsSampleInExplore"

	// FlagLogsContextDatasourceUi
	// Allow datasource to provide custom UI for context view
	FlagLogsContextDatasourceUi = "logsContextDatasourceUi"

	// FlagOnlyExternalOrgRoleSync
	// Prohibits a user from changing organization roles synced with external auth providers
	FlagOnlyExternalOrgRoleSync = "onlyExternalOrgRoleSync"

	// FlagPrometheusMetricEncyclopedia
	// Replaces the Prometheus query builder metric select option with a paginated and filterable component
	FlagPrometheusMetricEncyclopedia = "prometheusMetricEncyclopedia"

	// FlagInfluxdbBackendMigration
	// Query InfluxDB InfluxQL without the proxy
	FlagInfluxdbBackendMigration = "influxdbBackendMigration"
)
