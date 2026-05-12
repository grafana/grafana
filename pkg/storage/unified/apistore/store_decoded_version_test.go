package apistore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/apitesting"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// newDashboardScheme builds a runtime.Scheme registering every dashboard version
// so the codec can resolve typed Dashboard objects regardless of which version
// the bytes carry.
func newDashboardScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	sch := runtime.NewScheme()
	metav1.AddToGroupVersion(sch, metav1.SchemeGroupVersion)
	require.NoError(t, dashv0.AddToScheme(sch))
	require.NoError(t, dashv1.AddToScheme(sch))
	require.NoError(t, dashv2alpha1.AddToScheme(sch))
	require.NoError(t, dashv2beta1.AddToScheme(sch))
	require.NoError(t, dashv2.AddToScheme(sch))
	return sch
}

// storageForVersion builds a Storage with a codec scoped to the given
// dashboard version so that convertToObject can be driven directly.
func storageForVersion(t *testing.T, version string) *Storage {
	t.Helper()
	sch := newDashboardScheme(t)
	codecs := serializer.NewCodecFactory(sch)

	var info = dashv1.DashboardResourceInfo
	switch version {
	case dashv0.VERSION:
		info = dashv0.DashboardResourceInfo
	case dashv1.VERSION:
		info = dashv1.DashboardResourceInfo
	case dashv2alpha1.VERSION:
		info = dashv2alpha1.DashboardResourceInfo
	case dashv2beta1.VERSION:
		info = dashv2beta1.DashboardResourceInfo
	case dashv2.VERSION:
		info = dashv2.DashboardResourceInfo
	default:
		t.Fatalf("unsupported version: %s", version)
	}

	return &Storage{
		gr:    info.GroupResource(),
		codec: apitesting.TestCodec(codecs, info.GroupVersion()),
		opts:  StorageOptions{Scheme: sch},
	}
}

// TestConvertToObject_SetsDecodedVersion verifies the storage decode boundary
// records the API version the codec just decoded onto status.conversion.storedVersion
// via the DecodedVersionAware interface. It covers multiple dashboard versions
// to confirm the hook is not hardcoded to any single value.
func TestConvertToObject_SetsDecodedVersion(t *testing.T) {
	ctx := context.Background()

	cases := []struct {
		name    string
		version string
		newObj  func() runtime.Object
		// encoded ascertains we always encode against the same version as we
		// decode. This mirrors the most common storage path: same-version
		// reads, which is exactly where storedVersion was being dropped.
	}{
		{
			name:    "v0alpha1",
			version: dashv0.VERSION,
			newObj:  func() runtime.Object { return &dashv0.Dashboard{} },
		},
		{
			name:    "v1",
			version: dashv1.VERSION,
			newObj:  func() runtime.Object { return &dashv1.Dashboard{} },
		},
		{
			name:    "v2alpha1",
			version: dashv2alpha1.VERSION,
			newObj:  func() runtime.Object { return &dashv2alpha1.Dashboard{} },
		},
		{
			name:    "v2beta1",
			version: dashv2beta1.VERSION,
			newObj:  func() runtime.Object { return &dashv2beta1.Dashboard{} },
		},
		{
			name:    "v2",
			version: dashv2.VERSION,
			newObj:  func() runtime.Object { return &dashv2.Dashboard{} },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := storageForVersion(t, tc.version)

			// Encode an empty dashboard and feed the bytes back through
			// convertToObject. The decoded object must carry storedVersion =
			// the on-disk version.
			src := tc.newObj()
			data, err := runtime.Encode(s.codec, src)
			require.NoError(t, err)

			out := tc.newObj()
			result, err := s.convertToObject(ctx, data, out)
			require.NoError(t, err)
			require.NotNil(t, result)

			got := storedVersionOf(t, result)
			require.Equal(t, tc.version, got, "storedVersion must match the on-disk version")
		})
	}
}

// TestConvertToObject_OverwritesStaleStoredVersion verifies that the
// DecodedVersionAware hook overwrites a stale storedVersion already present
// in the decoded object. The decoded GVK is the ground truth; the in-bytes
// value can be wrong (a prior bug encoded the wrong value into storage), so
// the hook must always win.
func TestConvertToObject_OverwritesStaleStoredVersion(t *testing.T) {
	ctx := context.Background()
	s := storageForVersion(t, dashv1.VERSION)

	// Pre-fill the dashboard with a stale storedVersion ("v0alpha1") and a
	// failed-conversion status. After encoding, the bytes carry that stale
	// value; after convertToObject, storedVersion must equal v1 (the decoded
	// version), while the failed-conversion fields are preserved.
	stale := "v0alpha1"
	errMsg := "boom"
	src := &dashv1.Dashboard{
		Status: dashv1.DashboardStatus{
			Conversion: &dashv1.DashboardConversionStatus{
				StoredVersion: &stale,
				Failed:        true,
				Error:         &errMsg,
			},
		},
	}
	data, err := runtime.Encode(s.codec, src)
	require.NoError(t, err)

	out := &dashv1.Dashboard{}
	result, err := s.convertToObject(ctx, data, out)
	require.NoError(t, err)

	d, ok := result.(*dashv1.Dashboard)
	require.True(t, ok)
	require.NotNil(t, d.Status.Conversion)
	require.NotNil(t, d.Status.Conversion.StoredVersion)
	require.Equal(t, dashv1.VERSION, *d.Status.Conversion.StoredVersion,
		"storedVersion must be overwritten by the decoded GVK, not preserved from the stored bytes")
	require.True(t, d.Status.Conversion.Failed, "Failed flag must be preserved")
	require.NotNil(t, d.Status.Conversion.Error, "Error must be preserved")
	require.Equal(t, "boom", *d.Status.Conversion.Error)
}

// TestConvertToObject_NilObjectIsHandled verifies the hook does not panic when
// decode produces a nil object. This shouldn't happen on a normal happy path,
// but the guard in convertToObject must hold either way.
func TestConvertToObject_NilObjectIsHandled(t *testing.T) {
	ctx := context.Background()
	s := storageForVersion(t, dashv1.VERSION)
	// Empty bytes will produce an error and a nil/empty object.
	_, err := s.convertToObject(ctx, []byte(""), &dashv1.Dashboard{})
	// We tolerate either an error or a clean decode of an empty document. The
	// only assertion is the call does not panic.
	_ = err
}

func storedVersionOf(t *testing.T, obj runtime.Object) string {
	t.Helper()
	switch d := obj.(type) {
	case *dashv0.Dashboard:
		return d.GetStoredVersion()
	case *dashv1.Dashboard:
		return d.GetStoredVersion()
	case *dashv2alpha1.Dashboard:
		return d.GetStoredVersion()
	case *dashv2beta1.Dashboard:
		return d.GetStoredVersion()
	case *dashv2.Dashboard:
		return d.GetStoredVersion()
	default:
		t.Fatalf("unsupported dashboard type: %T", obj)
		return ""
	}
}
