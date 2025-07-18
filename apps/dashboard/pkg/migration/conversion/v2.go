package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2alpha2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha2"
)

func Convert_V2alpha1_to_V0(in *dashv2alpha1.Dashboard, out *dashv0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2 to V0 conversion

	out.Status = dashv0.DashboardStatus{
		Conversion: &dashv0.DashboardConversionStatus{
			StoredVersion: dashv2alpha1.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V2alpha1_to_V1(in *dashv2alpha1.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2 to V1 conversion

	out.Status = dashv1.DashboardStatus{
		Conversion: &dashv1.DashboardConversionStatus{
			StoredVersion: dashv2alpha1.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V2alpha1_to_V2alpha2(in *dashv2alpha1.Dashboard, out *dashv2alpha2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2alpha1 to V2alpha2 conversion

	out.Status = dashv2alpha2.DashboardStatus{
		Conversion: &dashv2alpha2.DashboardConversionStatus{
			StoredVersion: dashv2alpha1.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}
func Convert_V2alpha2_to_V0(in *dashv2alpha2.Dashboard, out *dashv0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2alpha2 to V0 conversion

	out.Status = dashv0.DashboardStatus{
		Conversion: &dashv0.DashboardConversionStatus{
			StoredVersion: dashv2alpha2.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V2alpha2_to_V1(in *dashv2alpha2.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2alpha2 to V1 conversion

	out.Status = dashv1.DashboardStatus{
		Conversion: &dashv1.DashboardConversionStatus{
			StoredVersion: dashv2alpha2.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V2alpha2_to_V2alpha1(in *dashv2alpha2.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2alpha2 to V2alpha1 conversion

	out.Status = dashv2alpha1.DashboardStatus{
		Conversion: &dashv2alpha1.DashboardConversionStatus{
			StoredVersion: dashv2alpha2.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}
