package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/utils/ptr"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func Convert_V0_to_V1beta1(in *dashv0.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	if err := ConvertDashboard_V0_to_V1beta1(in, out, scope); err != nil {
		out.Status = dashv1.DashboardStatus{
			Conversion: &dashv1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv0.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		return err
	}
	return nil
}

func Convert_V0_to_V2alpha1(in *dashv0.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	v1beta1 := &dashv1.Dashboard{}
	if err := ConvertDashboard_V0_to_V1beta1(in, v1beta1, scope); err != nil {
		out.Status = dashv2alpha1.DashboardStatus{
			Conversion: &dashv2alpha1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv0.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		return err
	}

	if err := ConvertDashboard_V1beta1_to_V2alpha1(v1beta1, out, scope); err != nil {
		out.Status = dashv2alpha1.DashboardStatus{
			Conversion: &dashv2alpha1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv0.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		return err
	}

	return nil
}

func Convert_V0_to_V2beta1(in *dashv0.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope) error {
	v1beta1 := &dashv1.Dashboard{}
	if err := ConvertDashboard_V0_to_V1beta1(in, v1beta1, scope); err != nil {
		out.Status = dashv2beta1.DashboardStatus{
			Conversion: &dashv2beta1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv0.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		return err
	}

	v2alpha1 := &dashv2alpha1.Dashboard{}
	if err := ConvertDashboard_V1beta1_to_V2alpha1(v1beta1, v2alpha1, scope); err != nil {
		out.Status = dashv2beta1.DashboardStatus{
			Conversion: &dashv2beta1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv0.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		return err
	}

	if err := ConvertDashboard_V2alpha1_to_V2beta1(v2alpha1, out, scope); err != nil {
		out.Status = dashv2beta1.DashboardStatus{
			Conversion: &dashv2beta1.DashboardConversionStatus{
				StoredVersion: ptr.To(dashv0.VERSION),
				Failed:        true,
				Error:         ptr.To(err.Error()),
			},
		}
		return err
	}

	return nil
}
