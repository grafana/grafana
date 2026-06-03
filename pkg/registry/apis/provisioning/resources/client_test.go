package resources

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// The constructors are the seam through which the effective supported set will
// later be flag-gated. Today they must return exactly the static sets, in the
// same order, regardless of the feature toggles passed in.
func TestSupportedResources(t *testing.T) {
	t.Run("returns the static SupportedProvisioningResources set", func(t *testing.T) {
		assert.Equal(t, SupportedProvisioningResources, SupportedResources(nil))
		assert.Equal(t, SupportedProvisioningResources, SupportedResources(featuremgmt.WithFeatures()))
	})

	t.Run("returns the static SupportsFolderAnnotation set", func(t *testing.T) {
		assert.Equal(t, SupportsFolderAnnotation, SupportsFolderAnnotationResources(nil))
		assert.Equal(t, SupportsFolderAnnotation, SupportsFolderAnnotationResources(featuremgmt.WithFeatures()))
	})
}
