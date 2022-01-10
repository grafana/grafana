package featuremgmt

import (
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	// Register each toggle here
	standardFeatureFlags = []setting.FeatureFlag{
		{
			Name:        "recordedQueries",
			Description: "Supports saving queries that can be scraped by prometheus",
			State:       setting.StableState,
		},
		{
			Name:        "trimDefaults",
			Description: "Use cue schema to remove values that will be applied automatically",
			State:       setting.BetaState,
		},
		{
			Name:        secrets.EnvelopeEncryptionFeatureToggle,
			Description: "encrypt secrets",
			State:       setting.BetaState,
		},

		{
			Name:  "httpclientprovider_azure_auth",
			State: setting.BetaState,
		},
		{
			Name:        "service-accounts",
			Description: "support service accounts",
			State:       setting.BetaState,
		},

		{
			Name:        "database_metrics",
			Description: "Add prometheus metrics for database tables",
			State:       setting.StableState,
		},
		{
			Name:        "dashboardPreviews",
			Description: "support showing thumbnails id dashboard search results",
			State:       setting.AlphaState,
		},
		{
			Name:        "live-config",
			Description: "live should be able to save configs to SQL tables",
			State:       setting.AlphaState,
		},
		{
			Name:        "live-pipeline",
			Description: "enable a generic live processing pipeline",
			State:       setting.AlphaState,
		},
		{
			Name:         "live-service-web-worker",
			Description:  "This will use a webworker thread to processes events rather than the main thread",
			State:        setting.AlphaState,
			FrontendOnly: true,
		},
		{
			Name:         "queryOverLive",
			Description:  "Send queries over live websocket rather than HTTP requests",
			State:        setting.AlphaState,
			FrontendOnly: true,
		},
		{
			Name:         "tempoSearch",
			Description:  "enable searching in tempo datasources",
			State:        setting.BetaState,
			FrontendOnly: true,
		},
		{
			Name:         "tempoServiceGraph",
			Description:  "show service ",
			State:        setting.BetaState,
			FrontendOnly: true,
		},
		{
			Name:         "fullRangeLogsVolume",
			Description:  "Show full range logs volume in expore",
			State:        setting.BetaState,
			FrontendOnly: true,
		},
		{
			Name:        "accesscontrol",
			Description: "Support robust access control",
			State:       setting.BetaState,
		},
		{
			Name:        "prometheus_azure_auth",
			Description: "Use azure authentication for prometheus datasource",
			State:       setting.BetaState,
		},
		{
			Name:        "newNavigation",
			Description: "Try the next gen naviation model",
			State:       setting.AlphaState,
		},
		{
			Name:            "showFeatureFlagsInUI",
			Description:     "Show feature flags in the settigns UI",
			State:           setting.AlphaState,
			RequiresDevMode: true,
		},
		{
			Name:  "disable_http_request_histogram",
			State: setting.AlphaState,
		},
	}
)
