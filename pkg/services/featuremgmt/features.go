package featuremgmt

type FeatureToggles interface {
	IsEnabled(flag string) bool
}
