package conversion

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func newTestScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewTestLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)
	scheme := runtime.NewScheme()
	require.NoError(t, RegisterConversions(scheme, dsProvider, leProvider))
	return scheme
}

func invalidV0Dashboard() *dashv0.Dashboard {
	return &dashv0.Dashboard{
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
}

func validV0Dashboard() *dashv0.Dashboard {
	return &dashv0.Dashboard{
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
}

func TestV0ConversionErrorHandling(t *testing.T) {
	scheme := newTestScheme(t)
	source := invalidV0Dashboard()

	t.Run("v0 to v1beta1 sets failed status on migration failure", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.Error)
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v0 to v2alpha1 sets failed status on migration failure", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.Error)
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v0 to v2beta1 sets failed status on migration failure", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.Error)
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})
}

func TestV0ConversionSuccessStatus(t *testing.T) {
	scheme := newTestScheme(t)
	source := validV0Dashboard()

	t.Run("v0 to v1beta1 sets success status", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v0 to v2alpha1 sets success status", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind)
	})

	t.Run("v0 to v2beta1 sets success status", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.Equal(t, dashv0.VERSION, *target.Status.Conversion.StoredVersion)
	})
}

func TestV0ConversionObjectMetaOnError(t *testing.T) {
	scheme := newTestScheme(t)
	source := invalidV0Dashboard()

	t.Run("v0 to v1beta1 sets ObjectMeta on error", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.True(t, target.Status.Conversion.Failed)
		require.Equal(t, source.Name, target.Name)
		require.Equal(t, source.Namespace, target.Namespace)
		require.Equal(t, dashv1.APIVERSION, target.APIVersion)
	})

	t.Run("v0 to v2alpha1 sets ObjectMeta on error", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.True(t, target.Status.Conversion.Failed)
		require.Equal(t, source.Name, target.Name)
		require.Equal(t, source.Namespace, target.Namespace)
		require.Equal(t, dashv2alpha1.APIVERSION, target.APIVersion)
	})

	t.Run("v0 to v2beta1 sets ObjectMeta on error", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.True(t, target.Status.Conversion.Failed)
		require.Equal(t, source.Name, target.Name)
		require.Equal(t, source.Namespace, target.Namespace)
		require.Equal(t, dashv2beta1.APIVERSION, target.APIVersion)
	})
}

func TestV0ConversionLayoutOnError(t *testing.T) {
	scheme := newTestScheme(t)
	source := invalidV0Dashboard()

	t.Run("v0 to v2alpha1 sets default layout on error", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind)
	})

	t.Run("v0 to v2beta1 sets default layout on error", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind)
	})
}
