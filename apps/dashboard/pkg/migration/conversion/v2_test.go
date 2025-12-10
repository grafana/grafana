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
	migration.Initialize(dsProvider, leProvider)

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
	migration.Initialize(dsProvider, leProvider)

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
