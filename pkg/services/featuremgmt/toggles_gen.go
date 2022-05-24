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

	// FlagHttpclientproviderAzureAuth
	// Experimental. Allow datasources to configure Azure authentication directly via JsonData
	FlagHttpclientproviderAzureAuth = "httpclientprovider_azure_auth"

	// FlagServiceAccounts
	// support service accounts
	FlagServiceAccounts = "serviceAccounts"

	// FlagDatabaseMetrics
	// Add prometheus metrics for database tables
	FlagDatabaseMetrics = "database_metrics"

	// FlagDashboardPreviews
	// Create and show thumbnails for dashboard search results
	FlagDashboardPreviews = "dashboardPreviews"

	// FlagDashboardPreviewsAdmin
	// Manage the dashboard previews crawler process from the UI
	FlagDashboardPreviewsAdmin = "dashboardPreviewsAdmin"

	// FlagLiveConfig
	// Save grafana live configuration in SQL tables
	FlagLiveConfig = "live-config"

	// FlagLivePipeline
	// enable a generic live processing pipeline
	FlagLivePipeline = "live-pipeline"

	// FlagLiveServiceWebWorker
	// This will use a webworker thread to processes events rather than the main thread
	FlagLiveServiceWebWorker = "live-service-web-worker"

	// FlagQueryOverLive
	// Use grafana live websocket to execute backend queries
	FlagQueryOverLive = "queryOverLive"

	// FlagPanelTitleSearch
	// Search for dashboards using panel title
	FlagPanelTitleSearch = "panelTitleSearch"

	// FlagTempoSearch
	// Enable searching in tempo datasources
	FlagTempoSearch = "tempoSearch"

	// FlagTempoBackendSearch
	// Use backend for tempo search
	FlagTempoBackendSearch = "tempoBackendSearch"

	// FlagTempoServiceGraph
	// show service
	FlagTempoServiceGraph = "tempoServiceGraph"

	// FlagLokiBackendMode
	// Loki datasource works as backend datasource
	FlagLokiBackendMode = "lokiBackendMode"

	// FlagPrometheusAzureAuth
	// Experimental. Azure authentication for Prometheus datasource
	FlagPrometheusAzureAuth = "prometheus_azure_auth"

	// FlagInfluxdbBackendMigration
	// Query InfluxDB InfluxQL without the proxy
	FlagInfluxdbBackendMigration = "influxdbBackendMigration"

	// FlagNewNavigation
	// Try the next gen navigation model
	FlagNewNavigation = "newNavigation"

	// FlagShowFeatureFlagsInUI
	// Show feature flags in the settings UI
	FlagShowFeatureFlagsInUI = "showFeatureFlagsInUI"

	// FlagDisableHttpRequestHistogram
	// Do not create histograms for http requests
	FlagDisableHttpRequestHistogram = "disable_http_request_histogram"

	// FlagPublicDashboards
	// enables public access to dashboards
	FlagPublicDashboards = "publicDashboards"

	// FlagLokiLive
	// support websocket streaming for loki (early prototype)
	FlagLokiLive = "lokiLive"

	// FlagSwaggerUi
	// Serves swagger UI
	FlagSwaggerUi = "swaggerUi"

	// FlagFeatureHighlights
	// Highlight Enterprise features
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

	// FlagAlertProvisioning
	// Provisioning-friendly routes for alerting
	FlagAlertProvisioning = "alertProvisioning"

	// FlagExport
	// Export grafana instance (to git, etc)
	FlagExport = "export"

	// FlagStorageLocalUpload
	// allow uploads to local storage
	FlagStorageLocalUpload = "storageLocalUpload"

	// FlagAzureMonitorResourcePickerForMetrics
	// New UI for Azure Monitor Metrics Query
	FlagAzureMonitorResourcePickerForMetrics = "azureMonitorResourcePickerForMetrics"

	// FlagExplore2Dashboard
	// Experimental Explore to Dashboard workflow
	FlagExplore2Dashboard = "explore2Dashboard"

	// FlagTracing
	// Adds trace ID to error notifications
	FlagTracing = "tracing"

	// FlagPersistNotifications
	// PoC Notifications page
	FlagPersistNotifications = "persistNotifications"

	// FlagCommandPalette
	// Enable command palette
	FlagCommandPalette = "commandPalette"

	// FlagSavedItems
	// Enable Saved Items in the navbar.
	FlagSavedItems = "savedItems"

	// FlagCloudWatchDynamicLabels
	// Use dynamic labels instead of alias patterns in CloudWatch datasource
	FlagCloudWatchDynamicLabels = "cloudWatchDynamicLabels"

	// FlagDatasourceQueryMultiStatus
	// Introduce HTTP 207 Multi Status for api/ds/query
	FlagDatasourceQueryMultiStatus = "datasourceQueryMultiStatus"

	// FlagAzureMonitorExperimentalUI
	// Use grafana-experimental UI in Azure Monitor
	FlagAzureMonitorExperimentalUI = "azureMonitorExperimentalUI"

	// FlagTraceToMetrics
	// Enable trace to metrics links
	FlagTraceToMetrics = "traceToMetrics"

	// FlagPrometheusStreamingJSONParser
	// Enable streaming JSON parser for Prometheus datasource
	FlagPrometheusStreamingJSONParser = "prometheusStreamingJSONParser"

	// FlagValidateDashboardsOnSave
	// Validate dashboard JSON POSTed to api/dashboards/db
	FlagValidateDashboardsOnSave = "validateDashboardsOnSave"
)
