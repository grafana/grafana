package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func Convert_V2alpha1_to_V0(in *dashv2alpha1.Dashboard, out *dashv0.Dashboard, scope conversion.Scope) error {
	v1beta1 := &dashv1.Dashboard{}
	if err := ConvertDashboard_V2alpha1_to_V1beta1(in, v1beta1, scope); err != nil {
		return err
	}
	return Convert_V1beta1_to_V0(v1beta1, out, scope)
}

func Convert_V2alpha1_to_V1beta1(in *dashv2alpha1.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	return ConvertDashboard_V2alpha1_to_V1beta1(in, out, scope)
}

func Convert_V2alpha1_to_V2beta1(in *dashv2alpha1.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope) error {
	if err := ConvertDashboard_V2alpha1_to_V2beta1(in, out, scope); err != nil {
		return NewConversionError(err.Error(), "v2alpha1", "v2beta1", "ConvertDashboard_V2alpha1_to_V2beta1")
	}
	return nil
}

func Convert_V2beta1_to_V0(in *dashv2beta1.Dashboard, out *dashv0.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider) error {
	v1beta1 := &dashv1.Dashboard{}
	if err := Convert_V2beta1_to_V1beta1(in, v1beta1, scope, dsIndexProvider); err != nil {
		return err
	}
	return Convert_V1beta1_to_V0(v1beta1, out, scope)
}

func Convert_V2beta1_to_V1beta1(in *dashv2beta1.Dashboard, out *dashv1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider) error {
	v2alpha1 := &dashv2alpha1.Dashboard{}
	if err := ConvertDashboard_V2beta1_to_V2alpha1(in, v2alpha1, scope); err != nil {
		return err
	}
	return ConvertDashboard_V2alpha1_to_V1beta1(v2alpha1, out, scope)
}

func Convert_V2beta1_to_V2alpha1(in *dashv2beta1.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	if err := ConvertDashboard_V2beta1_to_V2alpha1(in, out, scope); err != nil {
		return NewConversionError(err.Error(), "v2beta1", "v2alpha1", "ConvertDashboard_V2beta1_to_V2alpha1")
	}
	return nil
}
