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
			Name:         "fullRangeLogsVolume",
			Description:  "Show full range logs volume in explore",
			State:        FeatureStateBeta,
			FrontendOnly: true,
			Expression:   "true", // Enabled by default
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
			Name:        "swaggerUi",
			Description: "Serves swagger UI",
			State:       FeatureStateBeta,
		},
		{
			Name:        "featureHighlights",
			Description: "Highlight Enterprise features",
			State:       FeatureStateStable,
		},
	}
)
