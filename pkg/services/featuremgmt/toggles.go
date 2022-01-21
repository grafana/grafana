package featuremgmt

type FeatureToggles struct {
	manager *FeatureManager
}

// IsEnabled checks if a feature is enabled
func (ft *FeatureToggles) IsEnabled(flag string) bool {
	return ft.manager.IsEnabled(flag)
}
