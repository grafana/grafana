package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func Convert_V2_to_V1beta1(in *dashv2.Dashboard, out *dashv1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider) error {
	intermediate := &dashv2beta1.Dashboard{}
	if err := Convert_V2_to_V2beta1(in, intermediate, scope); err != nil {
		return err
	}
	return Convert_V2beta1_to_V1(intermediate, out, scope, dsIndexProvider)
}
