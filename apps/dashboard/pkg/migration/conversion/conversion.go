package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func RegisterConversions(s *runtime.Scheme) error {
	if err := s.AddConversionFunc((*v0alpha1.Dashboard)(nil), (*v1alpha1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V1(a.(*v0alpha1.Dashboard), b.(*v1alpha1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*v0alpha1.Dashboard)(nil), (*v2alpha1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V2(a.(*v0alpha1.Dashboard), b.(*v2alpha1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*v1alpha1.Dashboard)(nil), (*v0alpha1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V0(a.(*v1alpha1.Dashboard), b.(*v0alpha1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*v1alpha1.Dashboard)(nil), (*v2alpha1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V2(a.(*v1alpha1.Dashboard), b.(*v2alpha1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*v2alpha1.Dashboard)(nil), (*v0alpha1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V0(a.(*v2alpha1.Dashboard), b.(*v0alpha1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*v2alpha1.Dashboard)(nil), (*v1alpha1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V1(a.(*v2alpha1.Dashboard), b.(*v1alpha1.Dashboard), scope)
	}); err != nil {
		return err
	}
	return nil
}

func Convert_V0_to_V1(in *v0alpha1.Dashboard, out *v1alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	out.Spec.Object = in.Spec.Object

	out.Status = v1alpha1.DashboardStatus{
		Conversion: &v1alpha1.DashboardConversionStatus{
			StoredVersion: v0alpha1.VERSION,
		},
	}

	if err := migration.Migrate(out.Spec.Object, schemaversion.LATEST_VERSION); err != nil {
		out.Status.Conversion.Failed = true
		out.Status.Conversion.Error = err.Error()
	}

	return nil
}

func Convert_V0_to_V2(in *v0alpha1.Dashboard, out *v2alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO (@radiohead): implement V0 to V2 conversion
	// This is the bare minimum conversion that is needed to make the dashboard servable.

	if v, ok := in.Spec.Object["title"]; ok {
		if title, ok := v.(string); ok {
			out.Spec.Title = title
		}
	}

	// We need to make sure the layout is set to some value, otherwise the JSON marshaling will fail.
	out.Spec.Layout = v2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrResponsiveGridLayoutKindOrTabsLayoutKind{
		GridLayoutKind: &v2alpha1.DashboardGridLayoutKind{
			Kind: "GridLayout",
			Spec: v2alpha1.DashboardGridLayoutSpec{},
		},
	}

	out.Status = v2alpha1.DashboardStatus{
		Conversion: &v2alpha1.DashboardConversionStatus{
			StoredVersion: v0alpha1.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V1_to_V0(in *v1alpha1.Dashboard, out *v0alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	out.Spec.Object = in.Spec.Object

	out.Status = v0alpha1.DashboardStatus{
		Conversion: &v0alpha1.DashboardConversionStatus{
			StoredVersion: v1alpha1.VERSION,
		},
	}

	return nil
}

func Convert_V1_to_V2(in *v1alpha1.Dashboard, out *v2alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO (@radiohead): implement V1 to V2 conversion
	// This is the bare minimum conversion that is needed to make the dashboard servable.

	if v, ok := in.Spec.Object["title"]; ok {
		if title, ok := v.(string); ok {
			out.Spec.Title = title
		}
	}

	// We need to make sure the layout is set to some value, otherwise the JSON marshaling will fail.
	out.Spec.Layout = v2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrResponsiveGridLayoutKindOrTabsLayoutKind{
		GridLayoutKind: &v2alpha1.DashboardGridLayoutKind{
			Kind: "GridLayout",
			Spec: v2alpha1.DashboardGridLayoutSpec{},
		},
	}

	out.Status = v2alpha1.DashboardStatus{
		Conversion: &v2alpha1.DashboardConversionStatus{
			StoredVersion: v1alpha1.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V2_to_V0(in *v2alpha1.Dashboard, out *v0alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2 to V0 conversion

	out.Status = v0alpha1.DashboardStatus{
		Conversion: &v0alpha1.DashboardConversionStatus{
			StoredVersion: v2alpha1.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V2_to_V1(in *v2alpha1.Dashboard, out *v1alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2 to V1 conversion

	out.Status = v1alpha1.DashboardStatus{
		Conversion: &v1alpha1.DashboardConversionStatus{
			StoredVersion: v2alpha1.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}
