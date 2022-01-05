package setting

const (
	featureToggle_recordedQueries               string = "recordedQueries"
	featureToggle_accesscontrol                 string = "accesscontrol"
	featureToggle_service_accounts              string = "service-accounts"
	featureToggle_httpclientprovider_azure_auth string = "httpclientprovider_azure_auth"

	featureToggle_dashboardPreviews              string = "dashboardPreviews"
	featureToggle_trimDefaults                   string = "trimDefaults"
	featureToggle_database_metrics               string = "database_metrics"
	featureToggle_disable_http_request_histogram string = "disable_http_request_histogram"
	featureToggle_newNavigation                  string = "newNavigation"

	featureToggle_live_config   string = "live-config"
	featureToggle_live_pipeline string = "live-pipeline"
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
			Tags:        []string{"live"},
		},
		{
			Id:          featureToggle_live_pipeline,
			Name:        "Live pipeline",
			Description: "enable a generic live processing pipeline",
			State:       AlphaState,
			Tags:        []string{"live"},
		},
	}
)

func (ft *FeatureToggles) IsRecordedQueriesEnabled() bool {
	return ft.Toggles[featureToggle_recordedQueries]
}

func (ft *FeatureToggles) IsLiveConfigEnabled() bool {
	return ft.Toggles[featureToggle_live_config]
}

func (ft *FeatureToggles) IsLivePipelineEnabled() bool {
	return ft.Toggles[featureToggle_live_pipeline]
}

func (ft *FeatureToggles) IsDashboardPreviesEnabled() bool {
	return ft.Toggles[featureToggle_dashboardPreviews]
}

func (ft *FeatureToggles) IsTrimDefaultsEnabled() bool {
	return ft.Toggles[featureToggle_trimDefaults]
}

func (ft *FeatureToggles) IsDatabaseMetricsEnabled() bool {
	return ft.Toggles[featureToggle_database_metrics]
}

// IsHTTPRequestHistogramDisabled returns whether the request historgrams is disabled.
// This feature toggle will be removed in Grafana 8.x but gives the operator
// some graceperiod to update all the monitoring tools.
func (ft *FeatureToggles) IsHTTPRequestHistogramDisabled() bool {
	return ft.Toggles[featureToggle_disable_http_request_histogram]
}

func (ft *FeatureToggles) IsNewNavigationEnabled() bool {
	return ft.Toggles[featureToggle_newNavigation]
}

func (ft *FeatureToggles) IsServiceAccountsEnabled() bool {
	return ft.Toggles[featureToggle_service_accounts]
}

func (ft *FeatureToggles) IsAccessControlEnabled() bool {
	return ft.Toggles[featureToggle_accesscontrol]
}

func (ft *FeatureToggles) IsAzureAuthHttpProviderEnabled() bool {
	return ft.Toggles[featureToggle_httpclientprovider_azure_auth]
}
