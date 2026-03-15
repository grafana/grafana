package conversion

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func newNilDSScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	leProvider := migrationtestutil.NewLibraryElementProvider()
	scheme := runtime.NewScheme()
	require.NoError(t, RegisterConversions(scheme, nil, leProvider))
	return scheme
}

func validV1Dashboard() *dashv1.Dashboard {
	return &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
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
}

func TestV1ConversionErrorHandling(t *testing.T) {
	scheme := newNilDSScheme(t)
	source := validV1Dashboard()

	t.Run("v1 to v2alpha1 sets failed status on nil dsProvider", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.Error)
		require.Equal(t, dashv1.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v1 to v2beta1 sets failed status on nil dsProvider", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.Error)
		require.Equal(t, dashv1.VERSION, *target.Status.Conversion.StoredVersion)
	})
}

func TestV1ConversionSuccessStatus(t *testing.T) {
	scheme := newTestScheme(t)
	source := validV1Dashboard()

	t.Run("v1 to v2alpha1 sets success status", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.Equal(t, dashv1.VERSION, *target.Status.Conversion.StoredVersion)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind)
	})

	t.Run("v1 to v2beta1 sets success status", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.Equal(t, dashv1.VERSION, *target.Status.Conversion.StoredVersion)
	})
}

func TestV1ConversionObjectMetaOnError(t *testing.T) {
	scheme := newNilDSScheme(t)
	source := validV1Dashboard()

	t.Run("v1 to v2alpha1 sets ObjectMeta on error", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.True(t, target.Status.Conversion.Failed)
		require.Equal(t, source.Name, target.Name)
		require.Equal(t, source.Namespace, target.Namespace)
		require.Equal(t, dashv2alpha1.APIVERSION, target.APIVersion)
	})

	t.Run("v1 to v2beta1 sets ObjectMeta on error", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.True(t, target.Status.Conversion.Failed)
		require.Equal(t, source.Name, target.Name)
		require.Equal(t, source.Namespace, target.Namespace)
		require.Equal(t, dashv2beta1.APIVERSION, target.APIVersion)
	})
}

func TestV1ConversionLayoutOnError(t *testing.T) {
	scheme := newNilDSScheme(t)
	source := validV1Dashboard()

	t.Run("v1 to v2alpha1 sets default layout on error", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind)
	})

	t.Run("v1 to v2beta1 sets default layout on error", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(source, target, nil))
		require.True(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Spec.Layout.GridLayoutKind)
	})
}
