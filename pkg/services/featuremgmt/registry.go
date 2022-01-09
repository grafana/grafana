package featuremgmt

import "github.com/grafana/grafana/pkg/services/secrets"

var (
	// Register each toggle here
	standardFeatureFlags = []FeatureFlag{
		{
			Name:        "recordedQueries",
			Description: "Supports saving queries that can be scraped by prometheus",
			State:       StableState,
		},
		{
			Name:        "trimDefaults",
			Description: "Use cue schema to remove values that will be applied automatically",
			State:       BetaState,
		},
		{
			Name:        secrets.EnvelopeEncryptionFeatureToggle,
			Description: "encrypt secrets",
			State:       BetaState,
		},

		{
			Name:  "httpclientprovider_azure_auth",
			State: BetaState,
		},
		{
			Name:        "service-accounts",
			Description: "support service accounts",
			State:       BetaState,
		},

		{
			Name:        "database_metrics",
			Description: "Add prometheus metrics for database tables",
			State:       StableState,
		},
		{
			Name:        "dashboardPreviews",
			Description: "support showing thumbnails id dashboard search results",
			State:       AlphaState,
		},
		{
			Name:        "live-config",
			Description: "live should be able to save configs to SQL tables",
			State:       AlphaState,
		},
		{
			Name:        "live-pipeline",
			Description: "enable a generic live processing pipeline",
			State:       AlphaState,
		},
		{
			Name:         "live-service-web-worker",
			Description:  "This will use a webworker thread to processes events rather than the main thread",
			State:        AlphaState,
			FrontendOnly: true,
		},
		{
			Name:         "queryOverLive",
			Description:  "Send queries over live websocket rather than HTTP requests",
			State:        AlphaState,
			FrontendOnly: true,
		},
		{
			Name:         "tempoSearch",
			Description:  "enable searching in tempo datasources",
			State:        BetaState,
			FrontendOnly: true,
		},
		{
			Name:         "tempoServiceGraph",
			Description:  "show service ",
			State:        BetaState,
			FrontendOnly: true,
		},
		{
			Name:         "fullRangeLogsVolume",
			Description:  "Show full range logs volume in expore",
			State:        BetaState,
			FrontendOnly: true,
		},
		{
			Name:        "accesscontrol",
			Description: "Support robust access control",
			State:       BetaState,
		},
		{
			Name:        "prometheus_azure_auth",
			Description: "Use azure authentication for prometheus datasource",
			State:       BetaState,
		},
		{
			Name:        "newNavigation",
			Description: "Try the next gen naviation model",
			State:       AlphaState,
		},
		{
			Name:            "showFeatureFlagsInUI",
			Description:     "Show feature flags in the settigns UI",
			State:           AlphaState,
			RequiresDevMode: true,
		},
		{
			Name:  "disable_http_request_histogram",
			State: AlphaState,
		},
	}
)
