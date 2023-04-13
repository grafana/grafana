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

	// FlagDatabaseMetrics
	// Add Prometheus metrics for database tables
	FlagDatabaseMetrics = "database_metrics"

	// FlagDashboardPreviews
	// Create and show thumbnails for dashboard search results
	FlagDashboardPreviews = "dashboardPreviews"

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

	// FlagPublicDashboards
	// Enables public access to dashboards
	FlagPublicDashboards = "publicDashboards"

	// FlagPublicDashboardsEmailSharing
	// Enables public dashboard sharing to be restricted to only allowed emails
	FlagPublicDashboardsEmailSharing = "publicDashboardsEmailSharing"

	// FlagLokiLive
	// Support WebSocket streaming for loki (early prototype)
	FlagLokiLive = "lokiLive"

	// FlagLokiDataframeApi
	// Use experimental loki api for WebSocket streaming (early prototype)
	FlagLokiDataframeApi = "lokiDataframeApi"

	// FlagFeatureHighlights
	// Highlight Grafana Enterprise features
	FlagFeatureHighlights = "featureHighlights"

	// FlagMigrationLocking
	// Lock database during migrations
	FlagMigrationLocking = "migrationLocking"

	// FlagStorage
	// Configurable storage for dashboards, datasources, and resources
	FlagStorage = "storage"

	// FlagK8S
	// Explore native k8s integrations
	FlagK8S = "k8s"

	// FlagExploreMixedDatasource
	// Enable mixed datasource in Explore
	FlagExploreMixedDatasource = "exploreMixedDatasource"

	// FlagNewTraceView
	// Shows the new trace view design
	FlagNewTraceView = "newTraceView"

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

	// FlagAutoMigrateOldPanels
	// Migrate old angular panels to supported versions (graph, table-old, worldmap, etc)
	FlagAutoMigrateOldPanels = "autoMigrateOldPanels"

	// FlagDisableAngular
	// Dynamic flag to disable angular at runtime. The preferred method is to set `angular_support_enabled` to `false` in the [security] settings, which allows you to change the state at runtime.
	FlagDisableAngular = "disableAngular"

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
	// Enables new top navigation and page layouts
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

	// FlagAccessTokenExpirationCheck
	// Enable OAuth access_token expiration check and token refresh using the refresh_token
	FlagAccessTokenExpirationCheck = "accessTokenExpirationCheck"

	// FlagElasticsearchBackendMigration
	// Use Elasticsearch as backend data source
	FlagElasticsearchBackendMigration = "elasticsearchBackendMigration"

	// FlagShowTraceId
	// Show trace ids for requests
	FlagShowTraceId = "showTraceId"

	// FlagDatasourceOnboarding
	// Enable data source onboarding page
	FlagDatasourceOnboarding = "datasourceOnboarding"

	// FlagEmptyDashboardPage
	// Enable the redesigned user interface of a dashboard page that includes no panels
	FlagEmptyDashboardPage = "emptyDashboardPage"

	// FlagSecureSocksDatasourceProxy
	// Enable secure socks tunneling for supported core datasources
	FlagSecureSocksDatasourceProxy = "secureSocksDatasourceProxy"

	// FlagAuthnService
	// Use new auth service to perform authentication
	FlagAuthnService = "authnService"

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

	// FlagLogsSampleInExplore
	// Enables access to the logs sample feature in Explore
	FlagLogsSampleInExplore = "logsSampleInExplore"

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

	// FlagOnlyExternalOrgRoleSync
	// Prohibits a user from changing organization roles synced with external auth providers
	FlagOnlyExternalOrgRoleSync = "onlyExternalOrgRoleSync"

	// FlagDrawerDataSourcePicker
	// Changes the user experience for data source selection to a drawer.
	FlagDrawerDataSourcePicker = "drawerDataSourcePicker"

	// FlagTraceqlSearch
	// Enables the &#39;TraceQL Search&#39; tab for the Tempo datasource which provides a UI to generate TraceQL queries
	FlagTraceqlSearch = "traceqlSearch"

	// FlagPrometheusMetricEncyclopedia
	// Replaces the Prometheus query builder metric select option with a paginated and filterable component
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

	// FlagDisableElasticsearchBackendExploreQuery
	// Disable executing of Elasticsearch Explore queries trough backend
	FlagDisableElasticsearchBackendExploreQuery = "disableElasticsearchBackendExploreQuery"

	// FlagPrometheusDataplane
	// Changes responses to from Prometheus to be compliant with the dataplane specification. In particular it sets the numeric Field.Name from &#39;Value&#39; to the value of the `__name__` label when present.
	FlagPrometheusDataplane = "prometheusDataplane"

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

	// FlagPyroscopeFlameGraph
	// Changes flame graph to pyroscope one
	FlagPyroscopeFlameGraph = "pyroscopeFlameGraph"

	// FlagExternalServiceAuth
	// Starts an OAuth2 authentication provider for external services
	FlagExternalServiceAuth = "externalServiceAuth"

	// FlagDataplaneFrontendFallback
	// Support dataplane contract field name change for transformations and field name matchers where the name is different
	FlagDataplaneFrontendFallback = "dataplaneFrontendFallback"

	// FlagPluginsAPIManifestKey
	// Use grafana.com API to retrieve the public manifest key
	FlagPluginsAPIManifestKey = "pluginsAPIManifestKey"
)
