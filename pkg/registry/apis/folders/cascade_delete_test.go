package folders

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func setKubernetesFolderCascadeDeleteToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "off"
	if enabled {
		variant = "on"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagKubernetesFolderCascadeDelete: {
			Key:            featuremgmt.FlagKubernetesFolderCascadeDelete,
			DefaultVariant: variant,
			Variants: map[string]any{
				"on":  true,
				"off": false,
			},
		},
	})))
	t.Cleanup(func() {
		require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{}))
	})
}

func TestKubernetesFolderCascadeDeleteEnabled(t *testing.T) {
	t.Run("disabled by default", func(t *testing.T) {
		require.False(t, kubernetesFolderCascadeDeleteEnabled(context.Background()))
	})
	t.Run("enabled when toggle on", func(t *testing.T) {
		setKubernetesFolderCascadeDeleteToggle(t, true)
		require.True(t, kubernetesFolderCascadeDeleteEnabled(context.Background()))
	})
}
