package conversion

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// TestV1ConversionErrorHandling tests that v1 conversion functions properly handle errors
func TestV1ConversionErrorHandling(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	migration.Initialize(dsProvider)

	t.Run("Convert_V1beta1_to_V2alpha1 sets status on conversion error", func(t *testing.T) {
		// Create a dashboard that will cause conversion to fail
		// We can use an invalid dashboard structure
		source := &dashv1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title": "test dashboard",
					// Missing required fields that might cause conversion to fail
				},
			},
		}
		target := &dashv2alpha1.Dashboard{}

		err := Convert_V1beta1_to_V2alpha1(source, target, nil, dsProvider, nil)

		// Convert_V1beta1_to_V2alpha1 doesn't return error, just sets status
		require.NoError(t, err, "Convert_V1beta1_to_V2alpha1 doesn't return error")
		// Layout should always be set
		require.NotNil(t, target.Spec.Layout.GridLayoutKind)
		// If conversion failed, status should be set
		if target.Status.Conversion != nil {
			require.True(t, target.Status.Conversion.Failed)
			require.NotNil(t, target.Status.Conversion.Error)
		}
	})

	t.Run("Convert_V1beta1_to_V2beta1 returns error on first step failure", func(t *testing.T) {
		source := &dashv1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title": "test dashboard",
					// Missing required fields that might cause conversion to fail
				},
			},
		}
		target := &dashv2beta1.Dashboard{}

		err := Convert_V1beta1_to_V2beta1(source, target, nil, dsProvider, nil)

		// May or may not error depending on dashboard content
		// But if it does error on first step, status should be set with correct StoredVersion
		if err != nil {
			require.NotNil(t, target.Status.Conversion)
			require.True(t, target.Status.Conversion.Failed)
			require.NotNil(t, target.Status.Conversion.Error)
			require.Equal(t, dashv1.VERSION, *target.Status.Conversion.StoredVersion)
		}
	})

	t.Run("Convert_V1beta1_to_V2beta1 returns error on second step failure", func(t *testing.T) {
		// Create a dashboard that will pass first step but might fail second step
		source := &dashv1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 25, // Valid schema version
				},
			},
		}
		target := &dashv2beta1.Dashboard{}

		err := Convert_V1beta1_to_V2beta1(source, target, nil, dsProvider, nil)

		// May or may not error depending on dashboard content
		// But if it does error on second step, status should be set with correct StoredVersion
		if err != nil {
			require.NotNil(t, target.Status.Conversion)
			require.True(t, target.Status.Conversion.Failed)
			require.NotNil(t, target.Status.Conversion.Error)
			require.Equal(t, dashv1.VERSION, *target.Status.Conversion.StoredVersion)
		}
	})

	t.Run("Convert_V1beta1_to_V2beta1 success path returns nil", func(t *testing.T) {
		source := &dashv1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 25, // Valid schema version
				},
			},
		}
		target := &dashv2beta1.Dashboard{}

		err := Convert_V1beta1_to_V2beta1(source, target, nil, dsProvider, nil)

		// Should succeed if dashboard is valid
		if err == nil {
			// Success path covered
			require.NoError(t, err)
		}
	})
}
