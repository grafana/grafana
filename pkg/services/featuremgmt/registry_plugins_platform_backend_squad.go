package featuremgmt

var (
	pluginsPlatformBackendSquadToggles = []FeatureToggle{
		{
			Name:        "datasourceQueryMultiStatus",
			Description: "Introduce HTTP 207 Multi Status for api/ds/query",
			State:       FeatureStateAlpha,
		},
	}
)
