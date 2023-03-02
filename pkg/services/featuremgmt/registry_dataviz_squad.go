package featuremgmt

var (
	datavizSquadToggles = []FeatureToggle{
		{
			Name:         "canvasPanelNesting",
			Description:  "Allow elements nesting",
			State:        FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "autoMigrateGraphPanels",
			Description:  "Replace the angular graph panel with timeseries",
			State:        FeatureStateBeta,
			FrontendOnly: true,
		},
	}
)
