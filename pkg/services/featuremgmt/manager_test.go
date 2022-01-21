package featuremgmt

import (
	"context"
	"testing"

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
		ft := WithFeatures()
		ft.registerFlags(FeatureFlag{
			Id:              "a",
			RequiresLicense: true,
			RequiresDevMode: true,
			Expression:      "true",
		}, FeatureFlag{
			Id:         "b",
			Expression: "true",
		})
		require.False(t, ft.IsEnabled("a"))
		require.True(t, ft.IsEnabled("b"))
		require.False(t, ft.IsEnabled("c")) // uknown flag

		// Try changing "requires license"
		ft.registerFlags(FeatureFlag{
			Id:              "a",
			RequiresLicense: false, // shuld still require license!
		}, FeatureFlag{
			Id:              "b",
			RequiresLicense: true, // expression is still "true"
		})
		require.False(t, ft.IsEnabled("a"))
		require.False(t, ft.IsEnabled("b"))
		require.False(t, ft.IsEnabled("c"))
	})

	t.Run("check description and docs configs", func(t *testing.T) {
		ft := WithFeatures()
		ft.registerFlags(FeatureFlag{
			Id:          "a",
			Description: "first",
		}, FeatureFlag{
			Id:          "a",
			Description: "second",
		}, FeatureFlag{
			Id:      "a",
			DocsURL: "http://something",
		}, FeatureFlag{
			Id: "a",
		})
		flag := ft.flags["a"]
		require.Equal(t, "second", flag.Description)
		require.Equal(t, "http://something", flag.DocsURL)
	})

	t.Run("check standard flags with alias", func(t *testing.T) {
		ft := WithFeatures()
		ft.registerFlags(standardFeatureFlags...)

		r0 := ft.flags["recordedQueries"]
		r1 := ft.flags["recordedqueries"] // lowercase

		require.NotNil(t, r0)
		require.Equal(t, r0, r1)
	})
}
