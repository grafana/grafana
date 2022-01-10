package featuremgmt

import (
	"testing"
)

func TestFeatureToggleSetup(t *testing.T) {
	// ft := WithFeatures("a", "b", "c")
	// assert.True(t, ft.IsEnabled("a"))
	// assert.True(t, ft.IsEnabled("b"))
	// assert.True(t, ft.IsEnabled("c"))
	// assert.False(t, ft.IsEnabled("d"))

	// assert.Equal(t, []string([]string{"a", "b", "c"}), ft.GetEnabled())

	// // Explicit values
	// ft = WithFeatures("a", true, "b", false)
	// assert.True(t, ft.IsEnabled("a"))
	// assert.False(t, ft.IsEnabled("b"))
	// assert.Equal(t, []string([]string{"a"}), ft.GetEnabled())
	// assert.Equal(t, []setting.FeatureFlag([]setting.FeatureFlag{
	// 	{
	// 		Name: "a", Expression: "true", State: setting.BetaState,
	// 	},
	// 	{
	// 		Name: "b", Expression: "false", State: setting.BetaState,
	// 	}}), ft.GetFlags())
}
