package v2alpha1

import (
	errors "errors"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	conversion "k8s.io/apimachinery/pkg/conversion"
)

func Convert_v2alpha1_DashboardSpec_To_dashboard_DashboardSpec(in *DashboardSpec, out *dashboard.DashboardSpec, s conversion.Scope) error {
	return errors.New("TODO: implement v2alpha1 -> internal conversion")
}

func Convert_dashboard_DashboardSpec_To_v2alpha1_DashboardSpec(in *dashboard.DashboardSpec, out *DashboardSpec, s conversion.Scope) error {
	return errors.New("TODO: implement v2alpha1 -> internal conversion")
}

// TODO (@radiohead): not quite sure why k8s codegen is not generating this conversion function.
func Convert_v2alpha1_Dashboard_To_dashboard_Dashboard(in *Dashboard, out *dashboard.Dashboard, s conversion.Scope) error {
	return autoConvert_v2alpha1_Dashboard_To_dashboard_Dashboard(in, out, s)
}
