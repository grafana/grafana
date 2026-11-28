package dashboards

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboardv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
)

// DefaultAPIVersion is the version the legacy API reads dashboards at when
// no other version is requested.
const DefaultAPIVersion = dashboardv0.VERSION

// Fallback describes an extra read GetWithFallback makes.
type Fallback struct {
	// Version is the API version read next.
	Version string
	// Err is set when the read at the requested version failed.
	Err error
	// ConversionError is set when the API server could not convert the
	// dashboard to the version it was read at.
	ConversionError string
}

// GetWithFallback reads a dashboard the way the legacy API does: at the
// requested API version if that read succeeds, otherwise at
// DefaultAPIVersion, and again at the stored version when the API server
// could not convert the dashboard. onFallback, when not nil, is called before
// each extra read.
func GetWithFallback(
	ctx context.Context,
	requested string,
	get func(ctx context.Context, version string) (*unstructured.Unstructured, error),
	onFallback func(Fallback),
) (*unstructured.Unstructured, error) {
	if onFallback == nil {
		onFallback = func(Fallback) {}
	}

	if requested != "" {
		obj, err := get(ctx, requested)
		if err == nil {
			return storedVersionIfConversionFailed(ctx, obj, get, onFallback)
		}
		onFallback(Fallback{Version: DefaultAPIVersion, Err: err})
	}

	obj, err := get(ctx, DefaultAPIVersion)
	if err != nil {
		return nil, err
	}
	return storedVersionIfConversionFailed(ctx, obj, get, onFallback)
}

func storedVersionIfConversionFailed(
	ctx context.Context,
	obj *unstructured.Unstructured,
	get func(ctx context.Context, version string) (*unstructured.Unstructured, error),
	onFallback func(Fallback),
) (*unstructured.Unstructured, error) {
	failed, storedVersion, conversionErr := ConversionStatus(obj)
	if !failed {
		return obj, nil
	}
	onFallback(Fallback{Version: storedVersion, ConversionError: conversionErr})
	return get(ctx, storedVersion)
}

// ConversionStatus reads the conversion result the API server records in a
// dashboard's status.
func ConversionStatus(obj *unstructured.Unstructured) (failed bool, storedVersion string, conversionErr string) {
	status, found, _ := unstructured.NestedMap(obj.Object, "status")
	if !found {
		return false, "", ""
	}
	conversionStatus, found, _ := unstructured.NestedMap(status, "conversion")
	if !found {
		return false, "", ""
	}
	failed, _, _ = unstructured.NestedBool(conversionStatus, "failed")
	storedVersion, _, _ = unstructured.NestedString(conversionStatus, "storedVersion")
	conversionErr, _, _ = unstructured.NestedString(conversionStatus, "error")
	return failed, storedVersion, conversionErr
}
