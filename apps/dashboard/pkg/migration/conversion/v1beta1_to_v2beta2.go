package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	dashv2beta2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta2"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func Convert_V1beta1_to_V2beta2(in *dashv1.Dashboard, out *dashv2beta2.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider, leIndexProvider schemaversion.LibraryElementIndexProvider) error {
	intermediate := &dashv2beta1.Dashboard{}
	if err := Convert_V1beta1_to_V2beta1(in, intermediate, scope, dsIndexProvider, leIndexProvider); err != nil {
		return err
	}
	return Convert_V2beta1_to_V2beta2(intermediate, out, scope)
}
