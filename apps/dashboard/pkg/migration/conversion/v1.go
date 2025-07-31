package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func Convert_V1_to_V0(in *dashv1.Dashboard, out *dashv0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	// FIXME: this conversion is not implemented yet
	// out.Spec.Object = in.Spec.Object

	out.Status = dashv0.DashboardStatus{
		Conversion: &dashv0.DashboardConversionStatus{
			StoredVersion: dashv1.VERSION,
		},
	}

	return nil
}

func Convert_V1beta1_to_V2alpha1(in *dashv1.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// Convert the spec using the full implementation
	if err := ConvertDashboard_V1beta1_to_V2alpha1(in, out, scope); err != nil {
		out.Status = dashv2alpha1.DashboardStatus{
			Conversion: &dashv2alpha1.DashboardConversionStatus{
				StoredVersion: dashv1.VERSION,
				Failed:        true,
				Error:         err.Error(),
			},
		}
		return err
	}

	// Set successful conversion status
	out.Status = dashv2alpha1.DashboardStatus{
		Conversion: &dashv2alpha1.DashboardConversionStatus{
			StoredVersion: dashv1.VERSION,
			Failed:        false,
		},
	}

	return nil
}

func Convert_V1alpha1_to_V2beta1(in *dashv1.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	v2alpha1 := &dashv2alpha1.Dashboard{}
	if err := Convert_V1beta1_to_V2alpha1(in, v2alpha1, scope); err != nil {
		out.Status = dashv2beta1.DashboardStatus{
			Conversion: &dashv2beta1.DashboardConversionStatus{
				StoredVersion: dashv1.VERSION,
				Failed:        true,
				Error:         err.Error(),
			},
		}
		return err
	}

	if err := Convert_V2alpha1_to_V2beta1(v2alpha1, out, scope); err != nil {
		out.Status = dashv2beta1.DashboardStatus{
			Conversion: &dashv2beta1.DashboardConversionStatus{
				StoredVersion: dashv1.VERSION,
				Failed:        true,
				Error:         err.Error(),
			},
		}
		return err
	}

	out.Status = dashv2beta1.DashboardStatus{
		Conversion: &dashv2beta1.DashboardConversionStatus{
			StoredVersion: dashv1.VERSION,
			Failed:        false,
		},
	}

	return nil
}
