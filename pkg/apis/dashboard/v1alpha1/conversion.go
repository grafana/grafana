package v1alpha1

import (
	"github.com/grafana/grafana/pkg/apis/dashboard"
	conversion "k8s.io/apimachinery/pkg/conversion"
)

// TODO (@radiohead): not quite sure why k8s codegen is not generating this conversion function.
func Convert_v1alpha1_Dashboard_To_dashboard_Dashboard(in *Dashboard, out *dashboard.Dashboard, s conversion.Scope) error {
	return autoConvert_v1alpha1_Dashboard_To_dashboard_Dashboard(in, out, s)
}
