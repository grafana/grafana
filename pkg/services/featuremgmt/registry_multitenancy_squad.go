package featuremgmt

var (
	multitenancySquadToggles = []FeatureToggle{
		{
			Name:        "dashboardPreviews",
			Description: "Create and show thumbnails for dashboard search results",
			State:       FeatureStateAlpha,
		},
		{
			Name:        "live-pipeline",
			Description: "Enable a generic live processing pipeline",
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
			Description:  "Use Grafana Live WebSocket to execute backend queries",
			State:        FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:        "panelTitleSearch",
			Description: "Search for dashboards using panel title",
			State:       FeatureStateBeta,
		},
		{
			Name:        "lokiLive",
			Description: "Support WebSocket streaming for loki (early prototype)",
			State:       FeatureStateAlpha,
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
			Name:        "storage",
			Description: "Configurable storage for dashboards, datasources, and resources",
			State:       FeatureStateAlpha,
		},
		{
			Name:            "k8s",
			Description:     "Explore native k8s integrations",
			State:           FeatureStateAlpha,
			RequiresDevMode: true,
		},
		{
			Name:            "dashboardsFromStorage",
			Description:     "Load dashboards from the generic storage interface",
			State:           FeatureStateAlpha,
			RequiresDevMode: true, // Also a gate on automatic git storage (for now)
		},
		{
			Name:            "grpcServer",
			Description:     "Run GRPC server",
			State:           FeatureStateAlpha,
			RequiresDevMode: true,
		},
		{
			Name:            "entityStore",
			Description:     "SQL-based entity store (requires storage flag also)",
			State:           FeatureStateAlpha,
			RequiresDevMode: true,
		},
		{
			Name:            "queryLibrary",
			Description:     "Reusable query library",
			State:           FeatureStateAlpha,
			RequiresDevMode: true,
		},
	}
)
