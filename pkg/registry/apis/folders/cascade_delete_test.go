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

// setKubernetesFolderCascadeDeleteToggle scopes the kubernetesFolderCascadeDelete flag to t.
// Flag state is per-test (routed by goroutine), so this is safe under t.Parallel.
func setKubernetesFolderCascadeDeleteToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "off"
	if enabled {
		variant = "on"
	}
	featureFlagsProvider.UsingFlags(t, map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagKubernetesFolderCascadeDelete: {
			Key:            featuremgmt.FlagKubernetesFolderCascadeDelete,
			DefaultVariant: variant,
			Variants: map[string]any{
				"on":  true,
				"off": false,
			},
		},
	})
	t.Cleanup(featureFlagsProvider.Cleanup)
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
