package conversion

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// TestV2alpha1ConversionErrorHandling tests that v2alpha1 conversion functions properly handle errors
func TestV2alpha1ConversionErrorHandling(t *testing.T) {
	t.Run("Convert_V2alpha1_to_V2beta1 sets status correctly on success", func(t *testing.T) {
		source := &dashv2alpha1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
				Name:      "test-dashboard",
			},
			Spec: dashv2alpha1.DashboardSpec{
				Title: "test dashboard",
				Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
					GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
						Kind: "GridLayout",
						Spec: dashv2alpha1.DashboardGridLayoutSpec{},
					},
				},
			},
		}
		target := &dashv2beta1.Dashboard{}

		err := Convert_V2alpha1_to_V2beta1(source, target, nil)

		require.NoError(t, err)
		// Verify success status is set correctly
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.Equal(t, dashv2alpha1.VERSION, *target.Status.Conversion.StoredVersion)
		require.Nil(t, target.Status.Conversion.Error)
	})
}
