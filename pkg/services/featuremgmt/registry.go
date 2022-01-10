package featuremgmt

import "github.com/grafana/grafana/pkg/services/secrets"

var (
	FLAG_database_metrics = "database_metrics"
	FLAG_live_config      = "live-config"

	// Register each toggle here
	standardFeatureFlags = []FeatureFlag{
		{
			Name:            "recordedQueries",
			Description:     "Supports saving queries that can be scraped by prometheus",
			State:           FeatureStateBeta,
			RequiresLicense: true,
		},
		{
			Name:            "teamsync",
			Description:     "Team sync",
			State:           FeatureStateStable,
			DocsURL:         "https://grafana.com/docs/grafana/latest/enterprise/team-sync/",
			RequiresLicense: true,
		},
		{
			Name:        "trimDefaults",
			Description: "Use cue schema to remove values that will be applied automatically",
			State:       FeatureStateBeta,
		},
		{
			Name:        secrets.EnvelopeEncryptionFeatureToggle,
			Description: "encrypt secrets",
			State:       FeatureStateBeta,
		},

		{
			Name:  "httpclientprovider_azure_auth",
			State: FeatureStateBeta,
		},
		{
			Name:            "service-accounts",
			Description:     "support service accounts",
			State:           FeatureStateBeta,
			RequiresLicense: true,
		},

		{
			Name:        FLAG_database_metrics,
			Description: "Add prometheus metrics for database tables",
			State:       FeatureStateStable,
		},
		{
			Name:        "dashboardPreviews",
			Description: "support showing thumbnails id dashboard search results",
			State:       FeatureStateAlpha,
		},
		{
			Name:        FLAG_live_config,
			Description: "live should be able to save configs to SQL tables",
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
			Description:  "Send queries over live websocket rather than HTTP requests",
			State:        FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "tempoSearch",
			Description:  "enable searching in tempo datasources",
			State:        FeatureStateBeta,
			FrontendOnly: true,
		},
		{
			Name:        "tempoBackendSearch",
			Description: "use backend for tempo search",
			State:       FeatureStateBeta,
		},
		{
			Name:         "tempoServiceGraph",
			Description:  "show service ",
			State:        FeatureStateBeta,
			FrontendOnly: true,
		},
		{
			Name:         "fullRangeLogsVolume",
			Description:  "Show full range logs volume in expore",
			State:        FeatureStateBeta,
			FrontendOnly: true,
		},
		{
			Name:            "accesscontrol",
			Description:     "Support robust access control",
			State:           FeatureStateBeta,
			RequiresLicense: true,
		},
		{
			Name:        "prometheus_azure_auth",
			Description: "Use azure authentication for prometheus datasource",
			State:       FeatureStateBeta,
		},
		{
			Name:        "newNavigation",
			Description: "Try the next gen naviation model",
			State:       FeatureStateAlpha,
		},
		{
			Name:            "showFeatureFlagsInUI",
			Description:     "Show feature flags in the settigns UI",
			State:           FeatureStateAlpha,
			RequiresDevMode: true,
		},
		{
			Name:  "disable_http_request_histogram",
			State: FeatureStateAlpha,
		},
	}
)
