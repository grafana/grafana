package featuremgmt

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestFeatureManager(t *testing.T) {
	t.Run("check testing stubs", func(t *testing.T) {
		ft := WithFeatures("a", "b", "c")
		require.True(t, ft.IsEnabled("a"))
		require.True(t, ft.IsEnabled("b"))
		require.True(t, ft.IsEnabled("c"))
		require.False(t, ft.IsEnabled("d"))

		require.Equal(t, map[string]bool{"a": true, "b": true, "c": true}, ft.GetEnabled(context.Background()))

		// Explicit values
		ft = WithFeatures("a", true, "b", false)
		require.True(t, ft.IsEnabled("a"))
		require.False(t, ft.IsEnabled("b"))
		require.Equal(t, map[string]bool{"a": true}, ft.GetEnabled(context.Background()))
	})

	t.Run("check license validation", func(t *testing.T) {
		ft := FeatureManager{
			flags: map[string]*models.FeatureFlag{},
		}
		ft.registerFlags(models.FeatureFlag{
			Name:            "a",
			RequiresLicense: true,
			RequiresDevMode: true,
			Expression:      "true",
		}, models.FeatureFlag{
			Name:       "b",
			Expression: "true",
		})
		require.False(t, ft.IsEnabled("a"))
		require.True(t, ft.IsEnabled("b"))
		require.False(t, ft.IsEnabled("c")) // uknown flag

		// Try changing "requires license"
		ft.registerFlags(models.FeatureFlag{
			Name:            "a",
			RequiresLicense: false, // shuld still require license!
		}, models.FeatureFlag{
			Name:            "b",
			RequiresLicense: true, // expression is still "true"
		})
		require.False(t, ft.IsEnabled("a"))
		require.False(t, ft.IsEnabled("b"))
		require.False(t, ft.IsEnabled("c"))
	})

	t.Run("check description and docs configs", func(t *testing.T) {
		ft := FeatureManager{
			flags: map[string]*models.FeatureFlag{},
		}
		ft.registerFlags(models.FeatureFlag{
			Name:        "a",
			Description: "first",
		}, models.FeatureFlag{
			Name:        "a",
			Description: "second",
		}, models.FeatureFlag{
			Name:    "a",
			DocsURL: "http://something",
		}, models.FeatureFlag{
			Name: "a",
		})
		flag := ft.flags["a"]
		require.Equal(t, "second", flag.Description)
		require.Equal(t, "http://something", flag.DocsURL)
	})
}
