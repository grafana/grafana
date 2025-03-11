package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration"
	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
	dashboardV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	dashboardV2 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
)

func RegisterConversions(s *runtime.Scheme) error {
	if err := s.AddConversionFunc((*dashboardV0.Dashboard)(nil), (*dashboardV1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V1(a.(*dashboardV0.Dashboard), b.(*dashboardV1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV0.Dashboard)(nil), (*dashboardV2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V2(a.(*dashboardV0.Dashboard), b.(*dashboardV2.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV1.Dashboard)(nil), (*dashboardV0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V0(a.(*dashboardV1.Dashboard), b.(*dashboardV0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV1.Dashboard)(nil), (*dashboardV2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V2(a.(*dashboardV1.Dashboard), b.(*dashboardV2.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV2.Dashboard)(nil), (*dashboardV0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V0(a.(*dashboardV2.Dashboard), b.(*dashboardV0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV2.Dashboard)(nil), (*dashboardV1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V1(a.(*dashboardV2.Dashboard), b.(*dashboardV1.Dashboard), scope)
	}); err != nil {
		return err
	}
	return nil
}

func Convert_V0_to_V1(in *dashboardV0.Dashboard, out *dashboardV1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	out.Spec.Object = in.Spec.Object

	out.Status = dashboardV1.DashboardStatus{
		Conversion: &dashboardV1.DashboardConversionStatus{
			StoredVersion: dashboardV0.VERSION,
		},
	}

	if err := migration.Migrate(out.Spec.Object, schemaversion.LATEST_VERSION); err != nil {
		out.Status.Conversion.Failed = true
		out.Status.Conversion.Error = err.Error()
	}

	return nil
}

func Convert_V0_to_V2(in *dashboardV0.Dashboard, out *dashboardV2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO (@radiohead): implement V0 to V2 conversion
	// This is the bare minimum conversion that is needed to make the dashboard servable.

	if v, ok := in.Spec.Object["title"]; ok {
		if title, ok := v.(string); ok {
			out.Spec.Title = title
		}
	}

	// We need to make sure the layout is set to some value, otherwise the JSON marshaling will fail.
	out.Spec.Layout = dashboardV2.DashboardGridLayoutKindOrRowsLayoutKindOrResponsiveGridLayoutKindOrTabsLayoutKind{
		GridLayoutKind: &dashboardV2.DashboardGridLayoutKind{
			Kind: "GridLayout",
			Spec: dashboardV2.DashboardGridLayoutSpec{},
		},
	}

	out.Status = dashboardV2.DashboardStatus{
		Conversion: &dashboardV2.DashboardConversionStatus{
			StoredVersion: dashboardV0.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V1_to_V0(in *dashboardV1.Dashboard, out *dashboardV0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	out.Spec.Object = in.Spec.Object

	out.Status = dashboardV0.DashboardStatus{
		Conversion: &dashboardV0.DashboardConversionStatus{
			StoredVersion: dashboardV1.VERSION,
		},
	}

	return nil
}

func Convert_V1_to_V2(in *dashboardV1.Dashboard, out *dashboardV2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO (@radiohead): implement V1 to V2 conversion
	// This is the bare minimum conversion that is needed to make the dashboard servable.

	if v, ok := in.Spec.Object["title"]; ok {
		if title, ok := v.(string); ok {
			out.Spec.Title = title
		}
	}

	// We need to make sure the layout is set to some value, otherwise the JSON marshaling will fail.
	out.Spec.Layout = dashboardV2.DashboardGridLayoutKindOrRowsLayoutKindOrResponsiveGridLayoutKindOrTabsLayoutKind{
		GridLayoutKind: &dashboardV2.DashboardGridLayoutKind{
			Kind: "GridLayout",
			Spec: dashboardV2.DashboardGridLayoutSpec{},
		},
	}

	out.Status = dashboardV2.DashboardStatus{
		Conversion: &dashboardV2.DashboardConversionStatus{
			StoredVersion: dashboardV1.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V2_to_V0(in *dashboardV2.Dashboard, out *dashboardV0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2 to V0 conversion

	out.Status = dashboardV0.DashboardStatus{
		Conversion: &dashboardV0.DashboardConversionStatus{
			StoredVersion: dashboardV2.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V2_to_V1(in *dashboardV2.Dashboard, out *dashboardV1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2 to V1 conversion

	out.Status = dashboardV1.DashboardStatus{
		Conversion: &dashboardV1.DashboardConversionStatus{
			StoredVersion: dashboardV2.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}
