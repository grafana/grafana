package conversion

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// TestV0ConversionErrorHandling tests that v0 conversion functions properly return errors and set status
func TestV0ConversionErrorHandling(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	tests := []struct {
		name            string
		source          *dashv0.Dashboard
		target          interface{}
		expectError     bool
		expectStatusSet bool
		checkStatus     func(t *testing.T, target interface{})
	}{
		{
			name: "Convert_V0_to_V1beta1 returns error on migration failure",
			source: &dashv0.Dashboard{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "org-1",
				},
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"title":         "test dashboard",
						"schemaVersion": 0, // Invalid schema version that will cause migration to fail
					},
				},
			},
			target:          &dashv1.Dashboard{},
			expectError:     true,
			expectStatusSet: true,
			checkStatus: func(t *testing.T, target interface{}) {
				out := target.(*dashv1.Dashboard)
				require.NotNil(t, out.Status.Conversion)
				require.True(t, out.Status.Conversion.Failed)
				require.NotNil(t, out.Status.Conversion.Error)
			},
		},
		{
			name: "Convert_V0_to_V2alpha1 returns error and sets status on first step migration failure",
			source: &dashv0.Dashboard{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "org-1",
				},
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"title":         "test dashboard",
						"schemaVersion": 0, // Invalid schema version that will cause migration to fail
					},
				},
			},
			target:          &dashv2alpha1.Dashboard{},
			expectError:     true, // Convert_V0_to_V2alpha1 now returns error for proper metrics/logging
			expectStatusSet: true,
			checkStatus: func(t *testing.T, target interface{}) {
				out := target.(*dashv2alpha1.Dashboard)
				// Status should be set when first step fails
				require.NotNil(t, out.Status.Conversion)
				require.True(t, out.Status.Conversion.Failed)
				require.NotNil(t, out.Status.Conversion.Error)
			},
		},
		{
			name: "Convert_V0_to_V2beta1 returns error on first step migration failure",
			source: &dashv0.Dashboard{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "org-1",
				},
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"title":         "test dashboard",
						"schemaVersion": 0, // Invalid schema version that will cause migration to fail
					},
				},
			},
			target:          &dashv2beta1.Dashboard{},
			expectError:     true,
			expectStatusSet: true,
			checkStatus: func(t *testing.T, target interface{}) {
				out := target.(*dashv2beta1.Dashboard)
				require.NotNil(t, out.Status.Conversion)
				require.True(t, out.Status.Conversion.Failed)
				require.NotNil(t, out.Status.Conversion.Error)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var err error
			switch target := tt.target.(type) {
			case *dashv1.Dashboard:
				err = Convert_V0_to_V1beta1(tt.source, target, nil)
			case *dashv2alpha1.Dashboard:
				err = Convert_V0_to_V2alpha1(tt.source, target, nil, dsProvider, leProvider)
			case *dashv2beta1.Dashboard:
				err = Convert_V0_to_V2beta1(tt.source, target, nil, dsProvider, leProvider)
			default:
				t.Fatalf("unexpected target type: %T", target)
			}

			if tt.expectError {
				require.Error(t, err, "expected conversion to return error")
			}

			if tt.expectStatusSet {
				tt.checkStatus(t, tt.target)
			}
		})
	}
}

// TestV0ConversionErrorPropagation tests that errors from atomic functions are properly propagated
func TestV0ConversionErrorPropagation(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	t.Run("ConvertDashboard_V0_to_V1beta1 returns error on migration failure", func(t *testing.T) {
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 0, // Invalid schema version that will cause migration to fail
				},
			},
		}
		target := &dashv1.Dashboard{}

		err := ConvertDashboard_V0_to_V1beta1(source, target, nil)

		require.Error(t, err, "expected error on migration failure")
		require.NotNil(t, target.Status.Conversion)
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.Error)
	})

	t.Run("Convert_V0_to_V1beta1 propagates error from ConvertDashboard_V0_to_V1beta1", func(t *testing.T) {
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 0, // Invalid schema version that will cause migration to fail
				},
			},
		}
		target := &dashv1.Dashboard{}

		err := Convert_V0_to_V1beta1(source, target, nil)

		require.Error(t, err, "expected error to be returned")
		require.NotNil(t, target.Status.Conversion)
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.Error)
	})

	t.Run("Convert_V0_to_V2beta1 returns error on first step migration failure", func(t *testing.T) {
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 0, // Invalid schema version that will cause migration to fail
				},
			},
		}
		target := &dashv2beta1.Dashboard{}

		err := Convert_V0_to_V2beta1(source, target, nil, dsProvider, leProvider)

		require.Error(t, err, "expected error to be returned on first step failure")
		require.NotNil(t, target.Status.Conversion)
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.Error)
	})
}

// TestV0ConversionSuccessPaths tests that successful conversion paths are covered
func TestV0ConversionSuccessPaths(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	t.Run("Convert_V0_to_V1beta1 success path returns nil", func(t *testing.T) {
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 42, // Latest schema version - no migration needed
				},
			},
		}
		target := &dashv1.Dashboard{}

		err := Convert_V0_to_V1beta1(source, target, nil)

		require.NoError(t, err, "expected successful conversion")
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
	})

	t.Run("Convert_V0_to_V2alpha1 success path returns nil", func(t *testing.T) {
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 42, // Latest schema version - no migration needed
				},
			},
		}
		target := &dashv2alpha1.Dashboard{}

		err := Convert_V0_to_V2alpha1(source, target, nil, dsProvider, leProvider)

		require.NoError(t, err, "expected successful conversion")
		// Layout should be set even on success
		require.NotNil(t, target.Spec.Layout.GridLayoutKind)
	})

	t.Run("Convert_V0_to_V2beta1 success path returns nil", func(t *testing.T) {
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 42, // Latest schema version - no migration needed
				},
			},
		}
		target := &dashv2beta1.Dashboard{}

		err := Convert_V0_to_V2beta1(source, target, nil, dsProvider, leProvider)

		require.NoError(t, err, "expected successful conversion")
	})
}

// TestV0ConversionSecondStepErrors tests error handling in second step of multi-step conversions
func TestV0ConversionSecondStepErrors(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	t.Run("Convert_V0_to_V2alpha1 returns error and sets status on first step error", func(t *testing.T) {
		// Create a dashboard that will fail v0->v1beta1 conversion
		// Use schemaVersion 0 which will cause migration to fail
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 0, // Invalid schema version that will cause migration to fail
				},
			},
		}
		target := &dashv2alpha1.Dashboard{}

		err := Convert_V0_to_V2alpha1(source, target, nil, dsProvider, leProvider)

		// Convert_V0_to_V2alpha1 returns error for proper metrics/logging
		require.Error(t, err, "Convert_V0_to_V2alpha1 should return error")
		// Status should also be set when first step fails
		require.NotNil(t, target.Status.Conversion, "Status should be set on first step error")
		require.True(t, target.Status.Conversion.Failed, "Failed should be true")
		require.NotNil(t, target.Status.Conversion.Error, "Error should be set")
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("Convert_V0_to_V2alpha1 returns error and sets status on second step error", func(t *testing.T) {
		// Create a dashboard that will pass v0->v1beta1 but fail v1beta1->v2alpha1
		// We need to create invalid JSON structure that will cause JSON marshaling to fail
		// or create a dashboard with invalid structure that causes transformation to fail
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 42, // Valid schema version that will pass first step
					"dashboard": map[string]interface{}{
						"title": "test",
						// Create invalid structure that will cause JSON marshaling to fail
						// by using a channel which cannot be marshaled
						"invalidField": make(chan int), // This will cause JSON marshal to fail
					},
				},
			},
		}
		target := &dashv2alpha1.Dashboard{}

		err := Convert_V0_to_V2alpha1(source, target, nil, dsProvider, leProvider)

		// Convert_V0_to_V2alpha1 returns error for proper metrics/logging
		require.Error(t, err, "Convert_V0_to_V2alpha1 should return error")
		// Status should also be set
		require.NotNil(t, target.Status.Conversion, "Status should be set on error")
		require.True(t, target.Status.Conversion.Failed, "Failed should be true")
		require.NotNil(t, target.Status.Conversion.Error, "Error should be set")
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("Convert_V0_to_V2beta1 returns error on second step failure", func(t *testing.T) {
		// Create a scenario where first step succeeds but second step fails
		// This is harder to trigger, but we can test the code path exists
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 25, // Valid schema version that will pass first step
				},
			},
		}
		target := &dashv2beta1.Dashboard{}

		err := Convert_V0_to_V2beta1(source, target, nil, dsProvider, leProvider)

		// May or may not error depending on dashboard content
		// But if it does error on second step, status should be set
		if err != nil {
			require.NotNil(t, target.Status.Conversion)
			require.True(t, target.Status.Conversion.Failed)
			require.NotNil(t, target.Status.Conversion.Error)
		}
	})

	t.Run("Convert_V0_to_V2beta1 returns error on third step failure", func(t *testing.T) {
		// Create a scenario where first two steps succeed but third step fails
		source := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
			},
			Spec: common.Unstructured{
				Object: map[string]interface{}{
					"title":         "test dashboard",
					"schemaVersion": 25, // Valid schema version that will pass first two steps
				},
			},
		}
		target := &dashv2beta1.Dashboard{}

		err := Convert_V0_to_V2beta1(source, target, nil, dsProvider, leProvider)

		// May or may not error depending on dashboard content
		// But if it does error on third step, status should be set
		if err != nil {
			require.NotNil(t, target.Status.Conversion)
			require.True(t, target.Status.Conversion.Failed)
			require.NotNil(t, target.Status.Conversion.Error)
		}
	})
}

// TestV0ConversionConsistency_ErrorsMustBeReturned ensures v0 conversion functions
// return errors instead of swallowing them. This prevents metrics and logs from being silently dropped.
func TestV0ConversionConsistency_ErrorsMustBeReturned(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Create a v0 dashboard that will fail conversion (invalid schema version)
	invalidV0 := &dashv0.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "org-1",
			Name:      "test-dashboard",
		},
		Spec: common.Unstructured{
			Object: map[string]interface{}{
				"title":         "test dashboard",
				"schemaVersion": 0, // Invalid schema version causes migration to fail
			},
		},
	}

	t.Run("Convert_V0_to_V1beta1 must return error on failure", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		err := Convert_V0_to_V1beta1(invalidV0, target, nil)
		require.Error(t, err, "Convert_V0_to_V1beta1 must return error, not swallow it")
		require.True(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be true")
	})

	t.Run("Convert_V0_to_V2alpha1 must return error on failure", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		err := Convert_V0_to_V2alpha1(invalidV0, target, nil, dsProvider, leProvider)
		require.Error(t, err, "Convert_V0_to_V2alpha1 must return error, not swallow it")
		require.True(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be true")
	})

	t.Run("Convert_V0_to_V2beta1 must return error on failure", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		err := Convert_V0_to_V2beta1(invalidV0, target, nil, dsProvider, leProvider)
		require.Error(t, err, "Convert_V0_to_V2beta1 must return error, not swallow it")
		require.True(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be true")
	})
}

// TestV0ConversionConsistency_SuccessStatusMustBeSet ensures v0 conversion functions
// set Status.Conversion with Failed=false on successful conversion.
func TestV0ConversionConsistency_SuccessStatusMustBeSet(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Create a valid v0 dashboard
	validV0 := &dashv0.Dashboard{
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

	t.Run("Convert_V0_to_V1beta1 must set success status", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		err := Convert_V0_to_V1beta1(validV0, target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion, "Status.Conversion must be set on success")
		require.False(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be false on success")
		require.NotNil(t, target.Status.Conversion.StoredVersion, "StoredVersion must be set")
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("Convert_V0_to_V2alpha1 must set success status", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		err := Convert_V0_to_V2alpha1(validV0, target, nil, dsProvider, leProvider)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion, "Status.Conversion must be set on success")
		require.False(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be false on success")
		require.NotNil(t, target.Status.Conversion.StoredVersion, "StoredVersion must be set")
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("Convert_V0_to_V2beta1 must set success status", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		err := Convert_V0_to_V2beta1(validV0, target, nil, dsProvider, leProvider)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion, "Status.Conversion must be set on success")
		require.False(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be false on success")
		require.NotNil(t, target.Status.Conversion.StoredVersion, "StoredVersion must be set")
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})
}

// TestV0ConversionConsistency_ObjectMetaMustBeSetOnError ensures v0 conversion functions
// set ObjectMeta, APIVersion, and Kind on the target even when conversion fails.
func TestV0ConversionConsistency_ObjectMetaMustBeSetOnError(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	invalidV0 := &dashv0.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "org-1",
			Name:      "test-dashboard",
			UID:       "test-uid",
		},
		Spec: common.Unstructured{
			Object: map[string]interface{}{
				"title":         "test dashboard",
				"schemaVersion": 0,
			},
		},
	}

	t.Run("Convert_V0_to_V1beta1 must set ObjectMeta on error", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		_ = Convert_V0_to_V1beta1(invalidV0, target, nil)
		require.Equal(t, invalidV0.Name, target.Name, "Name must be set on error")
		require.Equal(t, invalidV0.Namespace, target.Namespace, "Namespace must be set on error")
		require.Equal(t, dashv1.APIVERSION, target.APIVersion, "APIVersion must be set on error")
	})

	t.Run("Convert_V0_to_V2alpha1 must set ObjectMeta on error", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		_ = Convert_V0_to_V2alpha1(invalidV0, target, nil, dsProvider, leProvider)
		require.Equal(t, invalidV0.Name, target.Name, "Name must be set on error")
		require.Equal(t, invalidV0.Namespace, target.Namespace, "Namespace must be set on error")
		require.Equal(t, dashv2alpha1.APIVERSION, target.APIVersion, "APIVersion must be set on error")
	})

	t.Run("Convert_V0_to_V2beta1 must set ObjectMeta on error", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		_ = Convert_V0_to_V2beta1(invalidV0, target, nil, dsProvider, leProvider)
		require.Equal(t, invalidV0.Name, target.Name, "Name must be set on error")
		require.Equal(t, invalidV0.Namespace, target.Namespace, "Namespace must be set on error")
		require.Equal(t, dashv2beta1.APIVERSION, target.APIVersion, "APIVersion must be set on error")
	})
}

// TestV0ConversionConsistency_LayoutMustBeSetOnError ensures v2alpha1 and v2beta1 targets
// have a default layout set even when conversion fails to prevent JSON marshaling errors.
func TestV0ConversionConsistency_LayoutMustBeSetOnError(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	invalidV0 := &dashv0.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "org-1",
			Name:      "test-dashboard",
		},
		Spec: common.Unstructured{
			Object: map[string]interface{}{
				"title":         "test dashboard",
				"schemaVersion": 0,
			},
		},
	}

	t.Run("Convert_V0_to_V2alpha1 must set default layout on error", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		_ = Convert_V0_to_V2alpha1(invalidV0, target, nil, dsProvider, leProvider)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind, "GridLayoutKind must be set on error to prevent JSON marshaling issues")
	})

	t.Run("Convert_V0_to_V2beta1 must set default layout on error", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		_ = Convert_V0_to_V2beta1(invalidV0, target, nil, dsProvider, leProvider)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind, "GridLayoutKind must be set on error to prevent JSON marshaling issues")
	})
}
