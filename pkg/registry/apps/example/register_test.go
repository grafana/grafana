package example

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// Out-of-tree callers construct the installer without a delta source, so widening this signature breaks their build.
// Take the bus through ProvideAppInstaller instead.
func TestRegisterAppInstallerSignatureIsStable(t *testing.T) {
	var _ func(*setting.Cfg, featuremgmt.FeatureToggles) (*AppInstaller, error) = RegisterAppInstaller
}
