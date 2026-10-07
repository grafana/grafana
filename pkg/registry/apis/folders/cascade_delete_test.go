package folders

import (
	"context"
	"os"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	oftesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var featureFlagsProvider = oftesting.NewTestProvider()

func TestMain(m *testing.M) {
	if err := openfeature.SetProviderAndWait(featureFlagsProvider); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

// setOpenFeatureToggles scopes the given OpenFeature flags to t. UsingFlags replaces the whole
// flag map, so tests that need more than one flag must set them together. Flag state is per-test
// (routed by goroutine), so this is safe under t.Parallel.
func setOpenFeatureToggles(t *testing.T, flags map[string]bool) {
	t.Helper()
	inMemory := make(map[string]memprovider.InMemoryFlag, len(flags))
	for key, enabled := range flags {
		variant := "off"
		if enabled {
			variant = "on"
		}
		inMemory[key] = memprovider.InMemoryFlag{
			Key:            key,
			DefaultVariant: variant,
			Variants: map[string]any{
				"on":  true,
				"off": false,
			},
		}
	}
	featureFlagsProvider.UsingFlags(t, inMemory)
	t.Cleanup(featureFlagsProvider.Cleanup)
}

// setKubernetesFolderCascadeDeleteToggle scopes the kubernetesFolderCascadeDelete flag to t.
func setKubernetesFolderCascadeDeleteToggle(t *testing.T, enabled bool) {
	t.Helper()
	setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagKubernetesFolderCascadeDelete: enabled})
}

func TestKubernetesFolderCascadeDeleteEnabled(t *testing.T) {
	t.Run("disabled when toggle off", func(t *testing.T) {
		setKubernetesFolderCascadeDeleteToggle(t, false)
		require.False(t, kubernetesFolderCascadeDeleteEnabled(context.Background()))
	})
	t.Run("enabled when toggle on", func(t *testing.T) {
		setKubernetesFolderCascadeDeleteToggle(t, true)
		require.True(t, kubernetesFolderCascadeDeleteEnabled(context.Background()))
	})
}

func TestGrafanaDashboardGlobalVariablesEnabled(t *testing.T) {
	t.Run("disabled when toggle off", func(t *testing.T) {
		setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagGrafanaDashboardGlobalVariables: false})
		require.False(t, grafanaDashboardGlobalVariablesEnabled(context.Background()))
	})
	t.Run("enabled when toggle on", func(t *testing.T) {
		setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagGrafanaDashboardGlobalVariables: true})
		require.True(t, grafanaDashboardGlobalVariablesEnabled(context.Background()))
	})
}
