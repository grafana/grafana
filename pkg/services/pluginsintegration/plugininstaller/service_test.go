package plugininstaller

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Test if the service is disabled
func TestService_IsDisabled(t *testing.T) {
	// Create a new service
	s := &Service{
		features: featuremgmt.WithFeatures(featuremgmt.FlagBackgroundPluginInstaller),
	}

	// Check if the service is disabled
	if s.IsDisabled() {
		t.Error("Service should be enabled")
	}
}
