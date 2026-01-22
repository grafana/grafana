package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func Convert_V0_to_V1beta1(in *dashv0.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	if err := ConvertDashboard_V0_to_V1beta1(in, out, scope); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv1.APIVERSION
		out.Kind = in.Kind
		setConversionStatus(in, out, err, nil)
		return err
	}

	setConversionStatus(in, out, nil, nil)
	return nil
}

func Convert_V0_to_V2alpha1(in *dashv0.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider, leIndexProvider schemaversion.LibraryElementIndexProvider) error {
	v1beta1 := &dashv1.Dashboard{}
	if err := ConvertDashboard_V0_to_V1beta1(in, v1beta1, scope); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv2alpha1.APIVERSION
		out.Kind = in.Kind
		setConversionStatus(in, out, err, nil)
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

	if err := ConvertDashboard_V1beta1_to_V2alpha1(v1beta1, out, scope, dsIndexProvider, leIndexProvider); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv2alpha1.APIVERSION
		out.Kind = in.Kind
		setConversionStatus(in, out, err, nil)
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

	setConversionStatus(in, out, nil, nil)
	return nil
}

func Convert_V0_to_V2beta1(in *dashv0.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider, leIndexProvider schemaversion.LibraryElementIndexProvider) error {
	v1beta1 := &dashv1.Dashboard{}
	if err := ConvertDashboard_V0_to_V1beta1(in, v1beta1, scope); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv2beta1.APIVERSION
		out.Kind = in.Kind
		setConversionStatus(in, out, err, nil)
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

	v2alpha1 := &dashv2alpha1.Dashboard{}
	if err := ConvertDashboard_V1beta1_to_V2alpha1(v1beta1, v2alpha1, scope, dsIndexProvider, leIndexProvider); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv2beta1.APIVERSION
		out.Kind = in.Kind
		setConversionStatus(in, out, err, nil)
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
		setConversionStatus(in, out, err, nil)
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

	setConversionStatus(in, out, nil, nil)
	return nil
}
