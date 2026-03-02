package conversion

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func validV2alpha1Dashboard() *dashv2alpha1.Dashboard {
	return &dashv2alpha1.Dashboard{
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
}

func validV2beta1Dashboard() *dashv2beta1.Dashboard {
	return &dashv2beta1.Dashboard{
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
}

func TestV2ConversionSuccessStatus(t *testing.T) {
	scheme := newTestScheme(t)

	t.Run("v2alpha1 to v1beta1 sets success status", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		err := scheme.Convert(validV2alpha1Dashboard(), target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.StoredVersion)
		require.Equal(t, dashv2alpha1.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v2alpha1 to v2beta1 sets success status", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		err := scheme.Convert(validV2alpha1Dashboard(), target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.StoredVersion)
		require.Equal(t, dashv2alpha1.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v2beta1 to v1beta1 sets success status", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		err := scheme.Convert(validV2beta1Dashboard(), target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.StoredVersion)
		require.Equal(t, dashv2beta1.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v2beta1 to v2alpha1 sets success status", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		err := scheme.Convert(validV2beta1Dashboard(), target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.StoredVersion)
		require.Equal(t, dashv2beta1.VERSION, *target.Status.Conversion.StoredVersion)
	})
}
