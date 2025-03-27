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
	out.Spec = in.Spec
	out.Status = &dashboardV1.DashboardStatus{
		ConversionStatus: &dashboardV1.ConversionStatus{
			StoredVersion: dashboardV0.VERSION,
		},
	}
	err := migration.Migrate(out.Spec.Object, schemaversion.LATEST_VERSION)
	if err != nil {
		out.Status.ConversionStatus.Failed = true
		out.Status.ConversionStatus.Error = err.Error()
	}
	return nil
}

func Convert_V0_to_V2(in *dashboardV0.Dashboard, out *dashboardV2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	out.Status = &dashboardV2.DashboardStatus{
		ConversionStatus: &dashboardV2.ConversionStatus{
			StoredVersion: dashboardV0.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}
	return nil
}

func Convert_V1_to_V0(in *dashboardV1.Dashboard, out *dashboardV0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	out.Status = &dashboardV0.DashboardStatus{
		ConversionStatus: &dashboardV0.ConversionStatus{
			StoredVersion: dashboardV1.VERSION,
		},
	}
	return nil
}

func Convert_V1_to_V2(in *dashboardV1.Dashboard, out *dashboardV2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	out.Status = &dashboardV2.DashboardStatus{
		ConversionStatus: &dashboardV2.ConversionStatus{
			StoredVersion: dashboardV1.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}
	return nil
}

func Convert_V2_to_V0(in *dashboardV2.Dashboard, out *dashboardV0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	out.Status = &dashboardV0.DashboardStatus{
		ConversionStatus: &dashboardV0.ConversionStatus{
			StoredVersion: dashboardV2.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}
	return nil
}

func Convert_V2_to_V1(in *dashboardV2.Dashboard, out *dashboardV1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	out.Status = &dashboardV1.DashboardStatus{
		ConversionStatus: &dashboardV1.ConversionStatus{
			StoredVersion: dashboardV2.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}
	return nil
}
