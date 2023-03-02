package featuremgmt

var (
	userEssentialsSquadToggles = []FeatureToggle{
		{
			Name:        "internationalization",
			Description: "Enables internationalization",
			State:       FeatureStateStable,
			Expression:  "true", // enabled by default
		},
		{
			Name:        "topnav",
			Description: "Displays new top nav and page layouts",
			State:       FeatureStateBeta,
		},
	}
)
