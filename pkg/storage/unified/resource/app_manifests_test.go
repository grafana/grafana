package resource

import (
	"testing"
)

func TestAppManifests_AllHaveKinds(t *testing.T) {
	for _, m := range AppManifests() {
		if m.ManifestData.AppName == "provisioning" {
			t.Errorf("should not have a provisioning manifest as it has no kinds defined")
		}
	}
}
