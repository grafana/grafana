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
	out.APIVersion = dashv0.APIVERSION
	out.Kind = in.Kind

	out.Spec.Object = in.Spec.Object

	out.Status = dashv0.DashboardStatus{
		Conversion: &dashv0.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv1.VERSION),
		},
	}

	return nil
}

func Convert_V1beta1_to_V2alpha1(in *dashv1.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider, leIndexProvider schemaversion.LibraryElementIndexProvider) error {
	if err := ConvertDashboard_V1beta1_to_V2alpha1(in, out, scope, dsIndexProvider, leIndexProvider); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv2alpha1.APIVERSION
		out.Kind = in.Kind
		out.Status = dashv2alpha1.DashboardStatus{
			Conversion: &dashv2alpha1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv1.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		// Ensure layout is set even on error to prevent JSON marshaling issues
		if out.Spec.Layout.GridLayoutKind == nil && out.Spec.Layout.RowsLayoutKind == nil {
			out.Spec.Layout = dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2alpha1.DashboardGridLayoutSpec{},
				},
			}
		}
		return err
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

	// Set successful conversion status
	out.Status = dashv2alpha1.DashboardStatus{
		Conversion: &dashv2alpha1.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv1.VERSION),
			Failed:        false,
		},
	}

	return nil
}

func Convert_V1beta1_to_V2beta1(in *dashv1.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider, leIndexProvider schemaversion.LibraryElementIndexProvider) error {
	v2alpha1 := &dashv2alpha1.Dashboard{}
	if err := ConvertDashboard_V1beta1_to_V2alpha1(in, v2alpha1, scope, dsIndexProvider, leIndexProvider); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv2beta1.APIVERSION
		out.Kind = in.Kind
		out.Status = dashv2beta1.DashboardStatus{
			Conversion: &dashv2beta1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv1.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		// Ensure layout is set even on error to prevent JSON marshaling issues
		if out.Spec.Layout.GridLayoutKind == nil && out.Spec.Layout.RowsLayoutKind == nil {
			out.Spec.Layout = dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2beta1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2beta1.DashboardGridLayoutSpec{},
				},
			}
		}
		return err
	}

	if err := ConvertDashboard_V2alpha1_to_V2beta1(v2alpha1, out, scope); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv2beta1.APIVERSION
		out.Kind = in.Kind
		out.Status = dashv2beta1.DashboardStatus{
			Conversion: &dashv2beta1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv1.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		// Ensure layout is set even on error to prevent JSON marshaling issues
		if out.Spec.Layout.GridLayoutKind == nil && out.Spec.Layout.RowsLayoutKind == nil {
			out.Spec.Layout = dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2beta1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2beta1.DashboardGridLayoutSpec{},
				},
			}
		}
		return err
	}

	// Set successful conversion status
	out.Status = dashv2beta1.DashboardStatus{
		Conversion: &dashv2beta1.DashboardConversionStatus{
			StoredVersion: ptr.To(dashv1.VERSION),
			Failed:        false,
		},
	}

	return nil
}
