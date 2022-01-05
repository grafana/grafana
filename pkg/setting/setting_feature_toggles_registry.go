package setting

const (
	featureToggle_recordedQueries               string = "recordedQueries"
	featureToggle_accesscontrol                 string = "accesscontrol"
	featureToggle_service_accounts              string = "service-accounts"
	featureToggle_httpclientprovider_azure_auth string = "httpclientprovider_azure_auth"
	featureToggle_prometheus_azure_auth         string = "prometheus_azure_auth"

	featureToggle_dashboardPreviews              string = "dashboardPreviews"
	featureToggle_trimDefaults                   string = "trimDefaults"
	featureToggle_database_metrics               string = "database_metrics"
	featureToggle_disable_http_request_histogram string = "disable_http_request_histogram"
	featureToggle_newNavigation                  string = "newNavigation"

	featureToggle_live_config             string = "live-config"
	featureToggle_live_pipeline           string = "live-pipeline"
	featureToggle_live_service_web_worker string = "live-service-web-worker"
	featureToggle_queryOverLive           string = "queryOverLive"

	featureToggle_tempoSearch         string = "tempoSearch"
	featureToggle_tempoServiceGraph   string = "tempoServiceGraph"
	featureToggle_fullRangeLogsVolume string = "fullRangeLogsVolume"
)

var (
	// Register each toggle here
	featureToggleRegistry = []FeatureToggleInfo{
		{
			Id:                 featureToggle_recordedQueries,
			Name:               "Recorded queries",
			Description:        "Supports saving queries that can be scraped by prometheus",
			State:              StableState,
			RequiresEnterprise: true,
		},
		{
			Id:          featureToggle_trimDefaults,
			Name:        "Trim dashboard defaults",
			Description: "Use cue schema to remove values that will be applied automatically",
			State:       BetaState,
		},
		{
			Id:          featureToggle_database_metrics,
			Name:        "database instrumentation feature",
			Description: "Add prometheus metrics for database tables",
			State:       StableState,
		},
		{
			Id:          featureToggle_dashboardPreviews,
			Name:        "Dashboard previews",
			Description: "support showing thumbnails id dashboard search results",
			State:       AlphaState,
		},
		{
			Id:          featureToggle_live_config,
			Name:        "Live config",
			Description: "live should be able to save configs to SQL tables",
			State:       AlphaState,
		},
		{
			Id:          featureToggle_live_pipeline,
			Name:        "Live pipeline",
			Description: "enable a generic live processing pipeline",
			State:       AlphaState,
		},
		{
			Id:          featureToggle_live_service_web_worker,
			Name:        "Live service worker",
			Description: "This will use a webworker thread to processes events rather than the main thread",
			State:       AlphaState,
		},
		{
			Id:          featureToggle_queryOverLive,
			Name:        "Query using live websocket",
			Description: "Send queries over live websocket rather than HTTP requests",
			State:       AlphaState,
		},
		{
			Id:          featureToggle_tempoSearch,
			Name:        "Tempo search",
			Description: "enable searching in tempo datasources",
			State:       BetaState,
		},
		{
			Id:          featureToggle_tempoServiceGraph,
			Name:        "Tempo service graph",
			Description: "show service ",
			State:       BetaState,
		},
		{
			Id:          featureToggle_fullRangeLogsVolume,
			Name:        "Full range logs volume",
			Description: "Show full range logs volume in expore",
			State:       BetaState,
		},
		{
			Id:          featureToggle_accesscontrol,
			Name:        "Access control",
			Description: "Support robust access control",
			State:       BetaState,
		},
		{
			Id:          featureToggle_prometheus_azure_auth,
			Name:        "Prometheus azure auth",
			Description: "Use azure authentication for prometheus datasource",
			State:       BetaState,
		},
		{
			Id:          featureToggle_newNavigation,
			Name:        "New navigation",
			Description: "Try the next gen naviation model",
			State:       AlphaState,
		},
	}
)

func (ft *FeatureToggles) IsRecordedQueriesEnabled() bool {
	return ft.flags[featureToggle_recordedQueries]
}

func (ft *FeatureToggles) IsLiveConfigEnabled() bool {
	return ft.flags[featureToggle_live_config]
}

func (ft *FeatureToggles) IsLivePipelineEnabled() bool {
	return ft.flags[featureToggle_live_pipeline]
}

func (ft *FeatureToggles) IsDashboardPreviesEnabled() bool {
	return ft.flags[featureToggle_dashboardPreviews]
}

func (ft *FeatureToggles) IsTrimDefaultsEnabled() bool {
	return ft.flags[featureToggle_trimDefaults]
}

func (ft *FeatureToggles) IsDatabaseMetricsEnabled() bool {
	return ft.flags[featureToggle_database_metrics]
}

// IsHTTPRequestHistogramDisabled returns whether the request historgrams is disabled.
// This feature toggle will be removed in Grafana 8.x but gives the operator
// some graceperiod to update all the monitoring tools.
func (ft *FeatureToggles) IsHTTPRequestHistogramDisabled() bool {
	return ft.flags[featureToggle_disable_http_request_histogram]
}

func (ft *FeatureToggles) IsNewNavigationEnabled() bool {
	return ft.flags[featureToggle_newNavigation]
}

func (ft *FeatureToggles) IsServiceAccountsEnabled() bool {
	return ft.flags[featureToggle_service_accounts]
}

func (ft *FeatureToggles) IsAccessControlEnabled() bool {
	return ft.flags[featureToggle_accesscontrol]
}

func (ft *FeatureToggles) IsAzureAuthHttpProviderEnabled() bool {
	return ft.flags[featureToggle_httpclientprovider_azure_auth]
}
