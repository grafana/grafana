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
	// Convert v2alpha1 → v1beta1 first, then v1beta1 → v0
	v1beta1 := &dashv1.Dashboard{}
	if err := ConvertDashboard_V2alpha1_to_V1beta1(in, v1beta1, scope); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv0.APIVERSION
		out.Kind = in.Kind
		setConversionStatus(in, out, err, in)
		return err
	}

	// Convert v1beta1 → v0
	if err := Convert_V1beta1_to_V0(v1beta1, out, scope); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv0.APIVERSION
		out.Kind = in.Kind
		setConversionStatus(in, out, err, in)
		return err
	}

	// Update the stored version to reflect the original source (v2alpha1, not the intermediate v1beta1)
	setConversionStatus(in, out, nil, nil)

	return nil
}

func Convert_V2alpha1_to_V1beta1(in *dashv2alpha1.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv1.APIVERSION
	out.Kind = in.Kind

	// Convert the spec
	if err := ConvertDashboard_V2alpha1_to_V1beta1(in, out, scope); err != nil {
		setConversionStatus(in, out, err, in)
		return err
	}

	setConversionStatus(in, out, nil, nil)

	return nil
}

func Convert_V2alpha1_to_V2beta1(in *dashv2alpha1.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2beta1.APIVERSION
	out.Kind = in.Kind

	// Convert the spec
	if err := ConvertDashboard_V2alpha1_to_V2beta1(in, out, scope); err != nil {
		setConversionStatus(in, out, err, in)
		return NewConversionError(err.Error(), "v2alpha1", "v2beta1", "ConvertDashboard_V2alpha1_to_V2beta1")
	}

	setConversionStatus(in, out, nil, nil)

	return nil
}

func Convert_V2beta1_to_V0(in *dashv2beta1.Dashboard, out *dashv0.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider) error {
	// Convert v2beta1 → v1beta1 first, then v1beta1 → v0
	v1beta1 := &dashv1.Dashboard{}
	if err := Convert_V2beta1_to_V1beta1(in, v1beta1, scope, dsIndexProvider); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv0.APIVERSION
		out.Kind = in.Kind
		setConversionStatus(in, out, err, in)
		return err
	}

	// Convert v1beta1 → v0
	if err := Convert_V1beta1_to_V0(v1beta1, out, scope); err != nil {
		out.ObjectMeta = in.ObjectMeta
		out.APIVersion = dashv0.APIVERSION
		out.Kind = in.Kind
		setConversionStatus(in, out, err, in)
		return err
	}

	// Update the stored version to reflect the original source (v2beta1, not the intermediate v1beta1)
	setConversionStatus(in, out, nil, nil)

	return nil
}

func Convert_V2beta1_to_V1beta1(in *dashv2beta1.Dashboard, out *dashv1.Dashboard, scope conversion.Scope, dsIndexProvider schemaversion.DataSourceIndexProvider) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv1.APIVERSION
	out.Kind = in.Kind

	// Convert v2beta1 → v2alpha1 first, then v2alpha1 → v1beta1
	// This combines the atomic conversions, similar to Convert_V1beta1_to_V2beta1
	v2alpha1 := &dashv2alpha1.Dashboard{}
	if err := ConvertDashboard_V2beta1_to_V2alpha1(in, v2alpha1, scope); err != nil {
		setConversionStatus(in, out, err, in)
		return err
	}

	// Convert v2alpha1 → v1beta1
	// Note: ConvertDashboard_V2alpha1_to_V1beta1 will set out.ObjectMeta from v2alpha1,
	// but we've already set it from the original input, so it will be preserved
	if err := ConvertDashboard_V2alpha1_to_V1beta1(v2alpha1, out, scope); err != nil {
		setConversionStatus(in, out, err, in)
		return err
	}

	setConversionStatus(in, out, nil, nil)

	return nil
}

func Convert_V2beta1_to_V2alpha1(in *dashv2beta1.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2alpha1.APIVERSION
	out.Kind = in.Kind

	if err := ConvertDashboard_V2beta1_to_V2alpha1(in, out, scope); err != nil {
		setConversionStatus(in, out, err, in)
		return NewConversionError(err.Error(), "v2beta1", "v2alpha1", "ConvertDashboard_V2beta1_to_V2alpha1")
	}

	setConversionStatus(in, out, nil, nil)

	return nil
}
