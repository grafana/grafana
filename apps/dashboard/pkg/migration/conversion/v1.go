package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/utils/ptr"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func Convert_V1_to_V0(in *dashv1.Dashboard, out *dashv0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	out.Spec.Object = in.Spec.Object

	out.Status = dashv0.DashboardStatus{
		Conversion: &dashv0.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv1.VERSION),
		},
	}

	return nil
}

func Convert_V1_to_V2alpha1(in *dashv1.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO (@radiohead): implement V1 to V2 conversion
	// This is the bare minimum conversion that is needed to make the dashboard servable.

	if v, ok := in.Spec.Object["title"]; ok {
		if title, ok := v.(string); ok {
			out.Spec.Title = title
		}
	}

	// We need to make sure the layout is set to some value, otherwise the JSON marshaling will fail.
	out.Spec.Layout = dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
		GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
			Kind: "GridLayout",
			Spec: dashv2alpha1.DashboardGridLayoutSpec{},
		},
	}

	out.Status = dashv2alpha1.DashboardStatus{
		Conversion: &dashv2alpha1.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv1.VERSION),
			Failed:        true,
			Error:         ptr.To("backend conversion not yet implemented"),
		},
	}

	return nil
}

func Convert_V1_to_V2beta1(in *dashv1.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V1 to v2beta1 conversion

	out.Status = dashv2beta1.DashboardStatus{
		Conversion: &dashv2beta1.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv1.VERSION),
			Failed:        true,
			Error:         ptr.To("backend conversion not yet implemented"),
		},
	}

	return nil
}
