package featuremgmt

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestFeatureService(t *testing.T) {
	cfg := setting.NewCfg()
	mgmt, err := ProvideManagerService(setting.ProvideService(cfg))
	require.NoError(t, err)
	require.NotNil(t, mgmt)

	// Enterprise features do not fall though automatically
	require.False(t, mgmt.IsEnabledGlobally("a.yes.default"))
	require.False(t, mgmt.IsEnabledGlobally("a.yes")) // licensed, but not enabled
}
