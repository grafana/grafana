package featuremgmt

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFeatureToggleSetup(t *testing.T) {
	ft := WithFeatures("a", "b", "c")
	assert.True(t, ft.IsEnabled("a"))
	assert.True(t, ft.IsEnabled("b"))
	assert.True(t, ft.IsEnabled("c"))
	assert.False(t, ft.IsEnabled("d"))

	assert.Equal(t, map[string]bool(map[string]bool{"a": true, "b": true, "c": true}), ft.GetEnabled(context.Background()))

	// Explicit values
	ft = WithFeatures("a", true, "b", false)
	assert.True(t, ft.IsEnabled("a"))
	assert.False(t, ft.IsEnabled("b"))
	assert.Equal(t, map[string]bool(map[string]bool{"a": true}), ft.GetEnabled(context.Background()))
	// assert.Equal(t, []FeatureFlag([]FeatureFlag{
	// 	{
	// 		Name: "a", Expression: "true", State: FeatureStateUnknown,
	// 	},
	// 	{
	// 		Name: "b", Expression: "false", State: FeatureStateUnknown,
	// 	}}), ft.GetFlags())
}
