package featuremgmt

var (
	// Register each toggle here
	standardFeatureFlags = []FeatureFlag{
		{
			Name:        "trimDefaults",
			Description: "Use cue schema to remove values that will be applied automatically",
			State:       FeatureStateBeta,
		},
		{
			Name:        "envelopeEncryption",
			Description: "encrypt secrets",
			State:       FeatureStateBeta,
		},
		{
			Name:        "httpclientprovider_azure_auth",
			Description: "use http client for azure auth",
			State:       FeatureStateBeta,
		},
		{
			Name:        "service-accounts",
			Description: "support service accounts",
			State:       FeatureStateBeta,
		},
		{
			Name:        "database_metrics",
			Description: "Add prometheus metrics for database tables",
			State:       FeatureStateStable,
		},
		{
			Name:        "dashboardPreviews",
			Description: "Create and show thumbnails for dashboard search results",
			State:       FeatureStateAlpha,
		},
		{
			Name:        "dashboardPreviewsScheduler",
			Description: "Schedule automatic updates to dashboard previews",
			State:       FeatureStateAlpha,
		},
		{
			Name:        "dashboardPreviewsAdmin",
			Description: "Manage the dashboard previews crawler process from the UI",
			State:       FeatureStateAlpha,
		},
		{
			Name:        "live-config",
			Description: "Save grafana live configuration in SQL tables",
			State:       FeatureStateAlpha,
		},
		{
			Name:        "live-pipeline",
			Description: "enable a generic live processing pipeline",
			State:       FeatureStateAlpha,
		},
		{
			Name:         "live-service-web-worker",
			Description:  "This will use a webworker thread to processes events rather than the main thread",
			State:        FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "queryOverLive",
			Description:  "Use grafana live websocket to execute backend queries",
			State:        FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:            "panelTitleSearch",
			Description:     "Search for dashboards using panel title",
			State:           FeatureStateAlpha,
			RequiresDevMode: true, // only supported in dev mode right now
		},
		{
			Name:         "tempoSearch",
			Description:  "Enable searching in tempo datasources",
			State:        FeatureStateBeta,
			FrontendOnly: true,
		},
		{
			Name:        "tempoBackendSearch",
			Description: "Use backend for tempo search",
			State:       FeatureStateBeta,
		},
		{
			Name:         "tempoServiceGraph",
			Description:  "show service",
			State:        FeatureStateBeta,
			FrontendOnly: true,
		},
		{
			Name:         "lokiBackendMode",
			Description:  "Loki datasource works as backend datasource",
			State:        FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:        "accesscontrol",
			Description: "Support robust access control",
			State:       FeatureStateBeta,
		},
		{
			Name:        "prometheus_azure_auth",
			Description: "Use azure authentication for prometheus datasource",
			State:       FeatureStateBeta,
		},
		{
			Name:         "influxdbBackendMigration",
			Description:  "Query InfluxDB InfluxQL without the proxy",
			State:        FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:        "newNavigation",
			Description: "Try the next gen navigation model",
			State:       FeatureStateAlpha,
		},
		{
			Name:            "showFeatureFlagsInUI",
			Description:     "Show feature flags in the settings UI",
			State:           FeatureStateAlpha,
			RequiresDevMode: true,
		},
		{
			Name:        "disable_http_request_histogram",
			Description: "Do not create histograms for http requests",
			State:       FeatureStateAlpha,
		},
		{
			Name:            "validatedQueries",
			Description:     "only execute the query saved in a panel",
			State:           FeatureStateAlpha,
			RequiresDevMode: true,
		},
		{
			Name:        "lokiLive",
			Description: "support websocket streaming for loki (early prototype)",
			State:       FeatureStateAlpha,
		},
		{
			Name:        "swaggerUi",
			Description: "Serves swagger UI",
			State:       FeatureStateBeta,
		},
		{
			Name:        "featureHighlights",
			Description: "Highlight Enterprise features",
			State:       FeatureStateStable,
		},
		{
			Name:        "dashboardComments",
			Description: "Enable dashboard-wide comments",
			State:       FeatureStateAlpha,
		},
		{
			Name:        "annotationComments",
			Description: "Enable annotation comments",
			State:       FeatureStateAlpha,
		},
		{
			Name:        "migrationLocking",
			Description: "Lock database during migrations",
			State:       FeatureStateBeta,
		},
		{
			Name:        "storage",
			Description: "Configurable storage for dashboards, datasources, and resources",
			State:       FeatureStateAlpha,
		},
		{
			Name:            "storageLocalUpload",
			Description:     "allow uploads to local storage",
			State:           FeatureStateAlpha,
			RequiresDevMode: true,
		},
		{
			Name:            "azureMonitorResourcePickerForMetrics",
			Description:     "New UI for Azure Monitor Metrics Query",
			State:           FeatureStateAlpha,
			RequiresDevMode: true,
			FrontendOnly:    true,
		},
		{
			Name:            "intentapi",
			Description:     "Enable experimental Intent API",
			State:           FeatureStateAlpha,
			RequiresRestart: true,
		},
	}
)
