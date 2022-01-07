package featuremgmt

import "github.com/grafana/grafana/pkg/services/secrets"

const (
	FLAG_recordedQueries               string = "recordedQueries"
	FLAG_accesscontrol                 string = "accesscontrol"
	FLAG_service_accounts              string = "service-accounts"
	FLAG_httpclientprovider_azure_auth string = "httpclientprovider_azure_auth"
	FLAG_prometheus_azure_auth         string = "prometheus_azure_auth"

	FLAG_dashboardPreviews              string = "dashboardPreviews"
	FLAG_trimDefaults                   string = "trimDefaults"
	FLAG_database_metrics               string = "database_metrics"
	FLAG_disable_http_request_histogram string = "disable_http_request_histogram"
	FLAG_newNavigation                  string = "newNavigation"
	FLAG_secrets_envelopeEncryption     string = secrets.EnvelopeEncryptionFeatureToggle

	FLAG_live_config             string = "live-config"
	FLAG_live_pipeline           string = "live-pipeline"
	FLAG_live_service_web_worker string = "live-service-web-worker"
	FLAG_queryOverLive           string = "queryOverLive"

	FLAG_tempoSearch          string = "tempoSearch"
	FLAG_tempoServiceGraph    string = "tempoServiceGraph"
	FLAG_fullRangeLogsVolume  string = "fullRangeLogsVolume"
	FLAG_showFeatureFlagsInUI string = "showFeatureFlagsInUI"
)

var (
	// Register each toggle here
	standardFeatureFlags = []FeatureFlag{
		{
			Name:        FLAG_recordedQueries,
			Description: "Supports saving queries that can be scraped by prometheus",
			State:       StableState,
		},
		{
			Name:        FLAG_trimDefaults,
			Description: "Use cue schema to remove values that will be applied automatically",
			State:       BetaState,
		},
		{
			Name:        FLAG_secrets_envelopeEncryption,
			Description: "encrypt secrets",
			State:       BetaState,
		},
		{
			Name:        FLAG_database_metrics,
			Description: "Add prometheus metrics for database tables",
			State:       StableState,
		},
		{
			Name:        FLAG_dashboardPreviews,
			Description: "support showing thumbnails id dashboard search results",
			State:       AlphaState,
		},
		{
			Name:        FLAG_live_config,
			Description: "live should be able to save configs to SQL tables",
			State:       AlphaState,
		},
		{
			Name:        FLAG_live_pipeline,
			Description: "enable a generic live processing pipeline",
			State:       AlphaState,
		},
		{
			Name:         FLAG_live_service_web_worker,
			Description:  "This will use a webworker thread to processes events rather than the main thread",
			State:        AlphaState,
			FrontendOnly: true,
		},
		{
			Name:         FLAG_queryOverLive,
			Description:  "Send queries over live websocket rather than HTTP requests",
			State:        AlphaState,
			FrontendOnly: true,
		},
		{
			Name:         FLAG_tempoSearch,
			Description:  "enable searching in tempo datasources",
			State:        BetaState,
			FrontendOnly: true,
		},
		{
			Name:         FLAG_tempoServiceGraph,
			Description:  "show service ",
			State:        BetaState,
			FrontendOnly: true,
		},
		{
			Name:         FLAG_fullRangeLogsVolume,
			Description:  "Show full range logs volume in expore",
			State:        BetaState,
			FrontendOnly: true,
		},
		{
			Name:        FLAG_accesscontrol,
			Description: "Support robust access control",
			State:       BetaState,
		},
		{
			Name:        FLAG_prometheus_azure_auth,
			Description: "Use azure authentication for prometheus datasource",
			State:       BetaState,
		},
		{
			Name:        FLAG_newNavigation,
			Description: "Try the next gen naviation model",
			State:       AlphaState,
		},
		{
			Name:            FLAG_showFeatureFlagsInUI,
			Description:     "Show feature flags in the settigns UI",
			State:           AlphaState,
			RequiresDevMode: true,
		},
	}
)
