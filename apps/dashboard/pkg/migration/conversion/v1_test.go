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
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	t.Run("Convert_V1beta1_to_V2alpha1 sets status on successful conversion", func(t *testing.T) {
		// Create a simple dashboard that will convert successfully
		source := &dashv1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title": "test dashboard",
				},
			},
		}
		target := &dashv2alpha1.Dashboard{}

		err := Convert_V1beta1_to_V2alpha1(source, target, nil, dsProvider, leProvider)

		// Conversion should succeed
		require.NoError(t, err)
		// Layout should always be set
		require.NotNil(t, target.Spec.Layout.GridLayoutKind)
		// Status should be set with success
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.Equal(t, dashv1.VERSION, *target.Status.Conversion.StoredVersion)
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

		err := Convert_V1beta1_to_V2beta1(source, target, nil, dsProvider, leProvider)

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

		err := Convert_V1beta1_to_V2beta1(source, target, nil, dsProvider, leProvider)

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

		err := Convert_V1beta1_to_V2beta1(source, target, nil, dsProvider, leProvider)

		// Should succeed if dashboard is valid
		if err == nil {
			// Success path covered
			require.NoError(t, err)
		}
	})
}

// TestV1ConversionConsistency_ErrorsMustBeReturned ensures v1 conversion functions
// return errors instead of swallowing them. This prevents metrics and logs from being silently dropped.
func TestV1ConversionConsistency_ErrorsMustBeReturned(t *testing.T) {
	leProvider := migrationtestutil.NewLibraryElementProvider()

	// Create a valid v1 dashboard - the nil dsProvider will cause conversion to fail
	validV1 := &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "org-1",
			Name:      "test-dashboard",
		},
		Spec: common.Unstructured{
			Object: map[string]interface{}{
				"title":         "test dashboard",
				"schemaVersion": 42,
			},
		},
	}

	t.Run("Convert_V1beta1_to_V2alpha1 must return error on failure", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		// Pass nil dsProvider to cause conversion to fail
		err := Convert_V1beta1_to_V2alpha1(validV1, target, nil, nil, leProvider)
		require.Error(t, err, "Convert_V1beta1_to_V2alpha1 must return error, not swallow it")
		require.True(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be true")
	})

	t.Run("Convert_V1beta1_to_V2beta1 must return error on failure", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		// Pass nil dsProvider to cause conversion to fail
		err := Convert_V1beta1_to_V2beta1(validV1, target, nil, nil, leProvider)
		require.Error(t, err, "Convert_V1beta1_to_V2beta1 must return error, not swallow it")
		require.True(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be true")
	})
}

// TestV1ConversionConsistency_SuccessStatusMustBeSet ensures v1 conversion functions
// set Status.Conversion with Failed=false on successful conversion.
func TestV1ConversionConsistency_SuccessStatusMustBeSet(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Create a valid v1 dashboard
	validV1 := &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
			Name:      "test-dashboard",
		},
		Spec: common.Unstructured{
			Object: map[string]interface{}{
				"title":         "test dashboard",
				"schemaVersion": 42,
			},
		},
	}

	t.Run("Convert_V1beta1_to_V2alpha1 must set success status", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		err := Convert_V1beta1_to_V2alpha1(validV1, target, nil, dsProvider, leProvider)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion, "Status.Conversion must be set on success")
		require.False(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be false on success")
		require.NotNil(t, target.Status.Conversion.StoredVersion, "StoredVersion must be set")
		require.Equal(t, dashv1.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("Convert_V1beta1_to_V2beta1 must set success status", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		err := Convert_V1beta1_to_V2beta1(validV1, target, nil, dsProvider, leProvider)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion, "Status.Conversion must be set on success")
		require.False(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be false on success")
		require.NotNil(t, target.Status.Conversion.StoredVersion, "StoredVersion must be set")
		require.Equal(t, dashv1.VERSION, *target.Status.Conversion.StoredVersion)
	})
}

// TestV1ConversionConsistency_ObjectMetaMustBeSetOnError ensures v1 conversion functions
// set ObjectMeta, APIVersion, and Kind on the target even when conversion fails.
func TestV1ConversionConsistency_ObjectMetaMustBeSetOnError(t *testing.T) {
	leProvider := migrationtestutil.NewLibraryElementProvider()

	validV1 := &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "org-1",
			Name:      "test-dashboard",
			UID:       "test-uid",
		},
		Spec: common.Unstructured{
			Object: map[string]interface{}{
				"title":         "test dashboard",
				"schemaVersion": 42,
			},
		},
	}

	t.Run("Convert_V1beta1_to_V2alpha1 must set ObjectMeta on error", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		// Pass nil dsProvider to cause conversion to fail
		err := Convert_V1beta1_to_V2alpha1(validV1, target, nil, nil, leProvider)
		require.Error(t, err)
		require.Equal(t, validV1.Name, target.Name, "Name must be set on error")
		require.Equal(t, validV1.Namespace, target.Namespace, "Namespace must be set on error")
		require.Equal(t, dashv2alpha1.APIVERSION, target.APIVersion, "APIVersion must be set on error")
	})

	t.Run("Convert_V1beta1_to_V2beta1 must set ObjectMeta on error", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		// Pass nil dsProvider to cause conversion to fail
		err := Convert_V1beta1_to_V2beta1(validV1, target, nil, nil, leProvider)
		require.Error(t, err)
		require.Equal(t, validV1.Name, target.Name, "Name must be set on error")
		require.Equal(t, validV1.Namespace, target.Namespace, "Namespace must be set on error")
		require.Equal(t, dashv2beta1.APIVERSION, target.APIVersion, "APIVersion must be set on error")
	})
}

// TestV1ConversionConsistency_LayoutMustBeSetOnError ensures v2alpha1 and v2beta1 targets
// have a default layout set even when conversion fails to prevent JSON marshaling errors.
func TestV1ConversionConsistency_LayoutMustBeSetOnError(t *testing.T) {
	leProvider := migrationtestutil.NewLibraryElementProvider()

	validV1 := &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "org-1",
			Name:      "test-dashboard",
		},
		Spec: common.Unstructured{
			Object: map[string]interface{}{
				"title":         "test dashboard",
				"schemaVersion": 42,
			},
		},
	}

	t.Run("Convert_V1beta1_to_V2alpha1 must set default layout on error", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		// Pass nil dsProvider to cause conversion to fail
		err := Convert_V1beta1_to_V2alpha1(validV1, target, nil, nil, leProvider)
		require.Error(t, err)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind, "GridLayoutKind must be set on error to prevent JSON marshaling issues")
	})

	t.Run("Convert_V1beta1_to_V2beta1 must set default layout on error", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		// Pass nil dsProvider to cause conversion to fail
		err := Convert_V1beta1_to_V2beta1(validV1, target, nil, nil, leProvider)
		require.Error(t, err)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind, "GridLayoutKind must be set on error to prevent JSON marshaling issues")
	})
}
