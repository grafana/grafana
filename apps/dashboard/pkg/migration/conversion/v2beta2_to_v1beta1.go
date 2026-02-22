package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	dashv2beta2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta2"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// Schema Migration: v2beta2 -> v1beta1
//
// Converts by going through v2beta1 as an intermediate step:
// v2beta2 -> v2beta1 -> v1beta1

func Convert_V2beta2_to_V1beta1(in *dashv2beta2.Dashboard, out *dashv1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider) error {
	intermediate := &dashv2beta1.Dashboard{}
	if err := Convert_V2beta2_to_V2beta1(in, intermediate, scope); err != nil {
		return err
	}
	return Convert_V2beta1_to_V1beta1(intermediate, out, scope, dsIndexProvider)
}
