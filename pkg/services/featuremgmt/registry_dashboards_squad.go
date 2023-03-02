package featuremgmt

var (
	dashboardsSquadToggles = []FeatureToggle{
		{
			Name:         "scenes",
			Description:  "Experimental framework to build interactive dashboards",
			State:        FeatureStateAlpha,
			FrontendOnly: true,
		},
	}
)
