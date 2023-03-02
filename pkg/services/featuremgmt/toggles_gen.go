// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature flags, edit:
//  pkg/services/featuremgmt/go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go

package featuremgmt

const (
	// FlagAccessControlOnCall
	// Access control primitives for OnCall
	FlagAccessControlOnCall = "accessControlOnCall"

	// FlagAccessTokenExpirationCheck
	// Enable OAuth access_token expiration check and token refresh using the refresh_token
	FlagAccessTokenExpirationCheck = "accessTokenExpirationCheck"

	// FlagAlertingBacktesting
	// Rule backtesting API for alerting
	FlagAlertingBacktesting = "alertingBacktesting"

	// FlagAlertingBigTransactions
	// Use big transactions for alerting database writes
	FlagAlertingBigTransactions = "alertingBigTransactions"

	// FlagAlertingNoNormalState
	// Stop maintaining state of alerts that are not firing
	FlagAlertingNoNormalState = "alertingNoNormalState"

	// FlagAnnotationComments
	// Enable annotation comments
	FlagAnnotationComments = "annotationComments"

	// FlagAthenaAsyncQueryDataSupport
	// Enable async query data support for Athena
	FlagAthenaAsyncQueryDataSupport = "athenaAsyncQueryDataSupport"

	// FlagAuthnService
	// Use new auth service to perform authentication
	FlagAuthnService = "authnService"

	// FlagAutoMigrateGraphPanels
	// Replace the angular graph panel with timeseries
	FlagAutoMigrateGraphPanels = "autoMigrateGraphPanels"

	// FlagCanvasPanelNesting
	// Allow elements nesting
	FlagCanvasPanelNesting = "canvasPanelNesting"

	// FlagCloudWatchCrossAccountQuerying
	// Enables cross-account querying in CloudWatch datasources
	FlagCloudWatchCrossAccountQuerying = "cloudWatchCrossAccountQuerying"

	// FlagCloudWatchDynamicLabels
	// Use dynamic labels instead of alias patterns in CloudWatch datasource
	FlagCloudWatchDynamicLabels = "cloudWatchDynamicLabels"

	// FlagCorrelations
	// Correlations page
	FlagCorrelations = "correlations"

	// FlagDashboardComments
	// Enable dashboard-wide comments
	FlagDashboardComments = "dashboardComments"

	// FlagDashboardPreviews
	// Create and show thumbnails for dashboard search results
	FlagDashboardPreviews = "dashboardPreviews"

	// FlagDashboardsFromStorage
	// Load dashboards from the generic storage interface
	FlagDashboardsFromStorage = "dashboardsFromStorage"

	// FlagDataConnectionsConsole
	// Enables a new top-level page called Connections. This page is an experiment that provides a better experience when you install and configure data sources and other plugins.
	FlagDataConnectionsConsole = "dataConnectionsConsole"

	// FlagDatabaseMetrics
	// Add Prometheus metrics for database tables
	FlagDatabaseMetrics = "database_metrics"

	// FlagDatasourceOnboarding
	// Enable data source onboarding page
	FlagDatasourceOnboarding = "datasourceOnboarding"

	// FlagDatasourceQueryMultiStatus
	// Introduce HTTP 207 Multi Status for api/ds/query
	FlagDatasourceQueryMultiStatus = "datasourceQueryMultiStatus"

	// FlagDisableEnvelopeEncryption
	// Disable envelope encryption (emergency only)
	FlagDisableEnvelopeEncryption = "disableEnvelopeEncryption"

	// FlagDisablePrometheusExemplarSampling
	// Disable Prometheus examplar sampling
	FlagDisablePrometheusExemplarSampling = "disablePrometheusExemplarSampling"

	// FlagDisableSecretsCompatibility
	// Disable duplicated secret storage in legacy tables
	FlagDisableSecretsCompatibility = "disableSecretsCompatibility"

	// FlagDrawerDataSourcePicker
	// Changes the user experience for data source selection to a drawer.
	FlagDrawerDataSourcePicker = "drawerDataSourcePicker"

	// FlagEditPanelCSVDragAndDrop
	// Enables drag and drop for CSV and Excel files
	FlagEditPanelCSVDragAndDrop = "editPanelCSVDragAndDrop"

	// FlagElasticsearchBackendMigration
	// Use Elasticsearch as backend data source
	FlagElasticsearchBackendMigration = "elasticsearchBackendMigration"

	// FlagEntityStore
	// SQL-based entity store (requires storage flag also)
	FlagEntityStore = "entityStore"

	// FlagExploreMixedDatasource
	// Enable mixed datasource in Explore
	FlagExploreMixedDatasource = "exploreMixedDatasource"

	// FlagFeatureHighlights
	// Highlight Grafana Enterprise features
	FlagFeatureHighlights = "featureHighlights"

	// FlagGrpcServer
	// Run GRPC server
	FlagGrpcServer = "grpcServer"

	// FlagIndividualCookiePreferences
	// Support overriding cookie preferences per user
	FlagIndividualCookiePreferences = "individualCookiePreferences"

	// FlagInternationalization
	// Enables internationalization
	FlagInternationalization = "internationalization"

	// FlagK8s
	// Explore native k8s integrations
	FlagK8s = "k8s"

	// FlagLivePipeline
	// Enable a generic live processing pipeline
	FlagLivePipeline = "live-pipeline"

	// FlagLiveServiceWebWorker
	// This will use a webworker thread to processes events rather than the main thread
	FlagLiveServiceWebWorker = "live-service-web-worker"

	// FlagLogRequestsInstrumentedAsUnknown
	// Logs the path for requests that are instrumented as unknown
	FlagLogRequestsInstrumentedAsUnknown = "logRequestsInstrumentedAsUnknown"

	// FlagLogsContextDatasourceUi
	// Allow datasource to provide custom UI for context view
	FlagLogsContextDatasourceUi = "logsContextDatasourceUi"

	// FlagLogsSampleInExplore
	// Enables access to the logs sample feature in Explore
	FlagLogsSampleInExplore = "logsSampleInExplore"

	// FlagLokiDataframeApi
	// Use experimental loki api for WebSocket streaming (early prototype)
	FlagLokiDataframeApi = "lokiDataframeApi"

	// FlagLokiLive
	// Support WebSocket streaming for loki (early prototype)
	FlagLokiLive = "lokiLive"

	// FlagLokiQuerySplitting
	// Split large interval queries into subqueries with smaller time intervals
	FlagLokiQuerySplitting = "lokiQuerySplitting"

	// FlagMigrationLocking
	// Lock database during migrations
	FlagMigrationLocking = "migrationLocking"

	// FlagMysqlAnsiQuotes
	// Use double quotes to escape keyword in a MySQL query
	FlagMysqlAnsiQuotes = "mysqlAnsiQuotes"

	// FlagNestedFolders
	// Enable folder nesting
	FlagNestedFolders = "nestedFolders"

	// FlagNewDBLibrary
	// Use jmoiron/sqlx rather than xorm for a few backend services
	FlagNewDBLibrary = "newDBLibrary"

	// FlagNewPanelChromeUI
	// Show updated look and feel of grafana-ui PanelChrome: panel header, icons, and menu
	FlagNewPanelChromeUI = "newPanelChromeUI"

	// FlagNewTraceView
	// Shows the new trace view design
	FlagNewTraceView = "newTraceView"

	// FlagPanelTitleSearch
	// Search for dashboards using panel title
	FlagPanelTitleSearch = "panelTitleSearch"

	// FlagPrometheusAzureOverrideAudience
	// Experimental. Allow override default AAD audience for Azure Prometheus endpoint
	FlagPrometheusAzureOverrideAudience = "prometheusAzureOverrideAudience"

	// FlagPrometheusWideSeries
	// Enable wide series responses in the Prometheus datasource
	FlagPrometheusWideSeries = "prometheusWideSeries"

	// FlagPublicDashboards
	// Enables public access to dashboards
	FlagPublicDashboards = "publicDashboards"

	// FlagPublicDashboardsEmailSharing
	// Allows public dashboard sharing to be restricted to only allowed emails
	FlagPublicDashboardsEmailSharing = "publicDashboardsEmailSharing"

	// FlagQueryLibrary
	// Reusable query library
	FlagQueryLibrary = "queryLibrary"

	// FlagQueryOverLive
	// Use Grafana Live WebSocket to execute backend queries
	FlagQueryOverLive = "queryOverLive"

	// FlagRedshiftAsyncQueryDataSupport
	// Enable async query data support for Redshift
	FlagRedshiftAsyncQueryDataSupport = "redshiftAsyncQueryDataSupport"

	// FlagScenes
	// Experimental framework to build interactive dashboards
	FlagScenes = "scenes"

	// FlagSecureSocksDatasourceProxy
	// Enable secure socks tunneling for supported core datasources
	FlagSecureSocksDatasourceProxy = "secureSocksDatasourceProxy"

	// FlagShowDashboardValidationWarnings
	// Show warnings when dashboards do not validate against the schema
	FlagShowDashboardValidationWarnings = "showDashboardValidationWarnings"

	// FlagStorage
	// Configurable storage for dashboards, datasources, and resources
	FlagStorage = "storage"

	// FlagTopnav
	// Displays new top nav and page layouts
	FlagTopnav = "topnav"

	// FlagTraceToMetrics
	// Enable trace to metrics links
	FlagTraceToMetrics = "traceToMetrics"

	// FlagTracing
	// Adds trace ID to error notifications
	FlagTracing = "tracing"

	// FlagTrimDefaults
	// Use cue schema to remove values that will be applied automatically
	FlagTrimDefaults = "trimDefaults"

	// FlagValidateDashboardsOnSave
	// Validate dashboard JSON POSTed to api/dashboards/db
	FlagValidateDashboardsOnSave = "validateDashboardsOnSave"
)
