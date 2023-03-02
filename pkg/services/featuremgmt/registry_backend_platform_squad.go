package featuremgmt

var (
	backendPlatformSquadToggles = []FeatureToggle{
		{
			Name:        "newDBLibrary",
			Description: "Use jmoiron/sqlx rather than xorm for a few backend services",
			State:       FeatureStateBeta,
		},
	}
)
