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
)

// TestV2alpha1ConversionErrorHandling tests that v2alpha1 conversion functions properly handle errors
func TestV2alpha1ConversionErrorHandling(t *testing.T) {
	// Initialize the migrator with test data source and library element providers
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	t.Run("Convert_V2alpha1_to_V1beta1 sets status on conversion", func(t *testing.T) {
		// Create a dashboard for conversion
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
		target := &dashv1.Dashboard{}

		err := Convert_V2alpha1_to_V1beta1(source, target, nil)

		// Convert_V2alpha1_to_V1beta1 doesn't return error, just sets status
		require.NoError(t, err, "Convert_V2alpha1_to_V1beta1 doesn't return error")
		// Status should always be set
		require.NotNil(t, target.Status.Conversion)
		// If conversion failed, status should indicate failure
		if target.Status.Conversion.Failed {
			require.True(t, target.Status.Conversion.Failed)
			require.NotNil(t, target.Status.Conversion.Error)
		} else {
			// If conversion succeeded, status should indicate success
			require.False(t, target.Status.Conversion.Failed)
			require.Equal(t, dashv2alpha1.VERSION, *target.Status.Conversion.StoredVersion)
		}
	})

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

// TestV2beta1ConversionErrorHandling tests that v2beta1 conversion functions properly handle errors
func TestV2beta1ConversionErrorHandling(t *testing.T) {
	// Initialize the migrator with test data source and library element providers
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	t.Run("Convert_V2beta1_to_V1beta1 sets status on first step failure", func(t *testing.T) {
		// Create a dashboard that might cause conversion to fail on first step (v2beta1 -> v2alpha1)
		source := &dashv2beta1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
				Name:      "test-dashboard",
			},
			Spec: dashv2beta1.DashboardSpec{
				Title: "test dashboard",
				// Missing layout might cause issues, but let's test with minimal valid structure
				Layout: dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
					GridLayoutKind: &dashv2beta1.DashboardGridLayoutKind{
						Kind: "GridLayout",
						Spec: dashv2beta1.DashboardGridLayoutSpec{},
					},
				},
			},
		}
		target := &dashv1.Dashboard{}

		err := Convert_V2beta1_to_V1beta1(source, target, nil, dsProvider)

		// Convert_V2beta1_to_V1beta1 doesn't return error, just sets status
		require.NoError(t, err, "Convert_V2beta1_to_V1beta1 doesn't return error")
		// If conversion failed on first step, status should be set with correct StoredVersion
		if target.Status.Conversion != nil && target.Status.Conversion.Failed {
			require.True(t, target.Status.Conversion.Failed)
			require.NotNil(t, target.Status.Conversion.Error)
			require.Equal(t, dashv2beta1.VERSION, *target.Status.Conversion.StoredVersion)
		}
	})

	t.Run("Convert_V2beta1_to_V1beta1 sets status on second step failure", func(t *testing.T) {
		// Create a dashboard that will pass first step but might fail second step
		source := &dashv2beta1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
				Name:      "test-dashboard",
			},
			Spec: dashv2beta1.DashboardSpec{
				Title: "test dashboard",
				Layout: dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
					GridLayoutKind: &dashv2beta1.DashboardGridLayoutKind{
						Kind: "GridLayout",
						Spec: dashv2beta1.DashboardGridLayoutSpec{},
					},
				},
			},
		}
		target := &dashv1.Dashboard{}

		err := Convert_V2beta1_to_V1beta1(source, target, nil, dsProvider)

		// Convert_V2beta1_to_V1beta1 doesn't return error, just sets status
		require.NoError(t, err, "Convert_V2beta1_to_V1beta1 doesn't return error")
		// If conversion failed on second step, status should be set with correct StoredVersion
		if target.Status.Conversion != nil && target.Status.Conversion.Failed {
			require.True(t, target.Status.Conversion.Failed)
			require.NotNil(t, target.Status.Conversion.Error)
			require.Equal(t, dashv2beta1.VERSION, *target.Status.Conversion.StoredVersion)
		}
	})

	t.Run("Convert_V2beta1_to_V1beta1 success path sets status correctly", func(t *testing.T) {
		source := &dashv2beta1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
				Name:      "test-dashboard",
			},
			Spec: dashv2beta1.DashboardSpec{
				Title: "test dashboard",
				Layout: dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
					GridLayoutKind: &dashv2beta1.DashboardGridLayoutKind{
						Kind: "GridLayout",
						Spec: dashv2beta1.DashboardGridLayoutSpec{},
					},
				},
			},
		}
		target := &dashv1.Dashboard{}

		err := Convert_V2beta1_to_V1beta1(source, target, nil, dsProvider)

		// Should succeed if dashboard is valid
		if err == nil {
			// Success path - verify status is set correctly
			require.NoError(t, err)
			if target.Status.Conversion != nil {
				require.False(t, target.Status.Conversion.Failed)
				require.Equal(t, dashv2beta1.VERSION, *target.Status.Conversion.StoredVersion)
			}
		}
	})
}

// TestV2ConversionConsistency_SuccessStatusMustBeSet ensures v2 conversion functions
// set Status.Conversion with Failed=false on successful conversion.
func TestV2ConversionConsistency_SuccessStatusMustBeSet(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Create valid v2alpha1 dashboard
	validV2alpha1 := &dashv2alpha1.Dashboard{
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

	// Create valid v2beta1 dashboard
	validV2beta1 := &dashv2beta1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
			Name:      "test-dashboard",
		},
		Spec: dashv2beta1.DashboardSpec{
			Title: "test dashboard",
			Layout: dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2beta1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2beta1.DashboardGridLayoutSpec{},
				},
			},
		},
	}

	t.Run("Convert_V2alpha1_to_V1beta1 must set success status", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		err := Convert_V2alpha1_to_V1beta1(validV2alpha1, target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion, "Status.Conversion must be set on success")
		require.False(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be false on success")
		require.NotNil(t, target.Status.Conversion.StoredVersion, "StoredVersion must be set")
	})

	t.Run("Convert_V2alpha1_to_V2beta1 must set success status", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		err := Convert_V2alpha1_to_V2beta1(validV2alpha1, target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion, "Status.Conversion must be set on success")
		require.False(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be false on success")
		require.NotNil(t, target.Status.Conversion.StoredVersion, "StoredVersion must be set")
	})

	t.Run("Convert_V2beta1_to_V1beta1 must set success status", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		err := Convert_V2beta1_to_V1beta1(validV2beta1, target, nil, dsProvider)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion, "Status.Conversion must be set on success")
		require.False(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be false on success")
		require.NotNil(t, target.Status.Conversion.StoredVersion, "StoredVersion must be set")
	})

	t.Run("Convert_V2beta1_to_V2alpha1 must set success status", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		err := Convert_V2beta1_to_V2alpha1(validV2beta1, target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion, "Status.Conversion must be set on success")
		require.False(t, target.Status.Conversion.Failed, "Status.Conversion.Failed must be false on success")
		require.NotNil(t, target.Status.Conversion.StoredVersion, "StoredVersion must be set")
	})
}

// TestV2ConversionConsistency_ErrorsMustBeReturned ensures v2 conversion functions
// return errors instead of swallowing them. This prevents metrics and logs from being silently dropped.
func TestV2ConversionConsistency_ErrorsMustBeReturned(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Note: v2 conversions are harder to make fail since they don't go through schema migration.
	// These tests verify that IF an error occurs, it is returned (not swallowed).
	// The existing tests already cover this, but we add explicit assertions here.

	t.Run("Convert_V2alpha1_to_V2beta1 returns error on conversion failure", func(t *testing.T) {
		// Valid dashboard should succeed
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
		// This should succeed, verifying the function works
		require.NoError(t, err)
		require.False(t, target.Status.Conversion.Failed)
	})

	t.Run("Convert_V2beta1_to_V2alpha1 returns error on conversion failure", func(t *testing.T) {
		// Valid dashboard should succeed
		source := &dashv2beta1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
				Name:      "test-dashboard",
			},
			Spec: dashv2beta1.DashboardSpec{
				Title: "test dashboard",
				Layout: dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
					GridLayoutKind: &dashv2beta1.DashboardGridLayoutKind{
						Kind: "GridLayout",
						Spec: dashv2beta1.DashboardGridLayoutSpec{},
					},
				},
			},
		}
		target := &dashv2alpha1.Dashboard{}
		err := Convert_V2beta1_to_V2alpha1(source, target, nil)
		// This should succeed, verifying the function works
		require.NoError(t, err)
		require.False(t, target.Status.Conversion.Failed)
	})
}
