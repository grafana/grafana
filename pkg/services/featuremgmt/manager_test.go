package featuremgmt

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFeatureToggleSetup(t *testing.T) {
	ft := WithFeatures("a", "b", "c")
	assert.True(t, ft.IsEnabled(context.Background(), "a"))
	assert.True(t, ft.IsEnabled(context.Background(), "b"))
	assert.True(t, ft.IsEnabled(context.Background(), "c"))
	assert.False(t, ft.IsEnabled(context.Background(), "d"))

	// Explicit values
	ft = WithFeatures(context.Background(), "a", true, "b", false)
	assert.True(t, ft.IsEnabled(context.Background(), "a"))
	assert.False(t, ft.IsEnabled(context.Background(), "b"))
}
