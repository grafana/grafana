package featuremgmt

type UpdateFeatureTogglesCommand struct {
	FeatureToggles []FeatureToggleUpdate `json:"featureToggles"`
}

type FeatureToggleUpdate struct {
	Name    string `json:"name" binding:"Required"`
	Enabled bool   `json:"enabled" binding:"Required"`
}
