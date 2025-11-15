package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/utils/ptr"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func Convert_V1beta1_to_V0(in *dashv1.Dashboard, out *dashv0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	out.Spec.Object = in.Spec.Object

	out.Status = dashv0.DashboardStatus{
		Conversion: &dashv0.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv1.VERSION),
		},
	}

	return nil
}

func Convert_V1beta1_to_V2alpha1(in *dashv1.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope, dsInfoProvider schemaversion.DataSourceInfoProvider) error {
	if err := ConvertDashboard_V1beta1_to_V2alpha1(in, out, scope, dsInfoProvider); err != nil {
		out.Status = dashv2alpha1.DashboardStatus{
			Conversion: &dashv2alpha1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv1.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		// Don't return error - just set status (matches test expectations and V0 pattern for Convert_V0_to_V2alpha1)
		// Ensure layout is set even on error to prevent JSON marshaling issues
		if out.Spec.Layout.GridLayoutKind == nil && out.Spec.Layout.RowsLayoutKind == nil {
			out.Spec.Layout = dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2alpha1.DashboardGridLayoutSpec{},
				},
			}
		}
		return nil
	}

	// We need to make sure the layout is set to some value, otherwise the JSON marshaling will fail.
	if out.Spec.Layout.GridLayoutKind == nil && out.Spec.Layout.RowsLayoutKind == nil {
		out.Spec.Layout = dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
			GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
				Kind: "GridLayout",
				Spec: dashv2alpha1.DashboardGridLayoutSpec{},
			},
		}
	}

	return nil
}

func Convert_V1beta1_to_V2beta1(in *dashv1.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope, dsInfoProvider schemaversion.DataSourceInfoProvider) error {
	v2alpha1 := &dashv2alpha1.Dashboard{}
	if err := ConvertDashboard_V1beta1_to_V2alpha1(in, v2alpha1, scope, dsInfoProvider); err != nil {
		out.Status = dashv2beta1.DashboardStatus{
			Conversion: &dashv2beta1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv1.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		return err
	}

	if err := ConvertDashboard_V2alpha1_to_V2beta1(v2alpha1, out, scope); err != nil {
		out.Status = dashv2beta1.DashboardStatus{
			Conversion: &dashv2beta1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv1.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		return err
	}

	return nil
}
