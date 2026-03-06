package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	dashv2beta2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta2"
)

func Convert_V2beta2_to_V2alpha1(in *dashv2beta2.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	intermediate := &dashv2beta1.Dashboard{}
	if err := Convert_V2beta2_to_V2beta1(in, intermediate, scope); err != nil {
		return err
	}
	return ConvertDashboard_V2beta1_to_V2alpha1(intermediate, out, scope)
}
