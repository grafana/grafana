package example

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// Out-of-tree callers construct the installer with these two arguments, so widening this signature breaks their
// build. Take new dependencies through ProvideAppInstaller instead.
func TestRegisterAppInstaller(t *testing.T) {
	installer, err := RegisterAppInstaller(setting.NewCfg(), featuremgmt.WithFeatures())
	require.NoError(t, err)
	require.NotNil(t, installer)
}
