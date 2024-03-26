package featuremgmt

import "context"

// TestFeatureToggles is a FeatureToggles implementation that always returns
// false. Useful for testing when actual feature toggles are not needed.
func TestFeatureToggles() FeatureToggles {
	return &testFeatureToggles{}
}

type testFeatureToggles struct{}

func (t *testFeatureToggles) IsEnabled(_ context.Context, _ string) bool   { return false }
func (t *testFeatureToggles) IsEnabledGlobally(_ string) bool              { return false }
func (t *testFeatureToggles) GetEnabled(_ context.Context) map[string]bool { return map[string]bool{} }
