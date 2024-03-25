package featuremgmt

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestFeatureService(t *testing.T) {
	cfg := setting.NewCfg()

	prov, err := ProvideFeatureProvider(cfg)
	require.NoError(t, err)

	client, err := ProvideOpenFeatureClient(prov)
	require.NoError(t, err)

	mgmt, err := ProvideManagerService(cfg, prov, client)
	require.NoError(t, err)
	require.NotNil(t, mgmt)

	// Enterprise features do not fall though automatically
	require.False(t, mgmt.IsEnabledGlobally("a.yes.default"))
	require.False(t, mgmt.IsEnabledGlobally("a.yes")) // licensed, but not enabled
}

func TestFeatureManager_IsEnabled(t *testing.T) {
	ctx := context.Background()
	cfg := setting.NewCfg()
	ftsect, err := cfg.Raw.NewSection("feature_toggles")
	require.NoError(t, err)
	_, err = ftsect.NewKey("mytoggle", "true")
	require.NoError(t, err)

	prov, err := ProvideFeatureProvider(cfg)
	require.NoError(t, err)

	client, err := ProvideOpenFeatureClient(prov)
	require.NoError(t, err)

	mgmt, err := ProvideManagerService(cfg, prov, client)
	require.NoError(t, err)
	require.True(t, mgmt.IsEnabled(ctx, "mytoggle"))

	// standard flag enabled by default (note that if nestedFolders is removed,
	// this test will fail and should be updated to choose another flag that's
	// enabled by default)
	require.True(t, mgmt.IsEnabled(ctx, FlagNestedFolders))
}
