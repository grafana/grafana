package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func Convert_V0_to_V1beta1(in *dashv0.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	return ConvertDashboard_V0_to_V1beta1(in, out, scope)
}

func Convert_V0_to_V2alpha1(in *dashv0.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider, leIndexProvider schemaversion.LibraryElementIndexProvider) error {
	v1beta1 := &dashv1.Dashboard{}
	if err := ConvertDashboard_V0_to_V1beta1(in, v1beta1, scope); err != nil {
		return err
	}
	return ConvertDashboard_V1beta1_to_V2alpha1(v1beta1, out, scope, dsIndexProvider, leIndexProvider)
}

func Convert_V0_to_V2beta1(in *dashv0.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider, leIndexProvider schemaversion.LibraryElementIndexProvider) error {
	v1beta1 := &dashv1.Dashboard{}
	if err := ConvertDashboard_V0_to_V1beta1(in, v1beta1, scope); err != nil {
		return err
	}

	v2alpha1 := &dashv2alpha1.Dashboard{}
	if err := ConvertDashboard_V1beta1_to_V2alpha1(v1beta1, v2alpha1, scope, dsIndexProvider, leIndexProvider); err != nil {
		return err
	}

	return ConvertDashboard_V2alpha1_to_V2beta1(v2alpha1, out, scope)
}
