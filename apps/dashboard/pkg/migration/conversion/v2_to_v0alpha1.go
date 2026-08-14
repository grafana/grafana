package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func Convert_V2_to_V0(in *dashv2.Dashboard, out *dashv0.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider) error {
	intermediate := &dashv2beta1.Dashboard{}
	if err := Convert_V2_to_V2beta1(in, intermediate, scope); err != nil {
		return err
	}
	return Convert_V2beta1_to_V0(intermediate, out, scope, dsIndexProvider)
}
