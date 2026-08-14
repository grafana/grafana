package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func Convert_V2alpha1_to_V2(in *dashv2alpha1.Dashboard, out *dashv2.Dashboard, scope conversion.Scope) error {
	intermediate := &dashv2beta1.Dashboard{}
	if err := Convert_V2alpha1_to_V2beta1(in, intermediate, scope); err != nil {
		return err
	}
	return Convert_V2beta1_to_V2(intermediate, out, scope)
}
