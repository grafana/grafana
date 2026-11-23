package conversion

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// The Variable spec is identical on the wire in v2beta1 and v2, but the generated
// Go types differ in nested type names, so the spec is copied through JSON.
// Unlike dashboards, variables have no status to record a conversion failure in,
// so errors are returned to the caller instead of going through normalizeConversion.

func registerVariableConversions(s *runtime.Scheme) error {
	if err := s.AddConversionFunc((*dashv2beta1.Variable)(nil), (*dashv2.Variable)(nil),
		func(a, b interface{}, scope conversion.Scope) error {
			return Convert_Variable_V2beta1_to_V2(a.(*dashv2beta1.Variable), b.(*dashv2.Variable), scope)
		}); err != nil {
		return err
	}
	return s.AddConversionFunc((*dashv2.Variable)(nil), (*dashv2beta1.Variable)(nil),
		func(a, b interface{}, scope conversion.Scope) error {
			return Convert_Variable_V2_to_V2beta1(a.(*dashv2.Variable), b.(*dashv2beta1.Variable), scope)
		})
}

func Convert_Variable_V2beta1_to_V2(in *dashv2beta1.Variable, out *dashv2.Variable, _ conversion.Scope) error {
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	out.APIVersion = dashv2.APIVERSION
	out.Kind = in.Kind

	spec, err := Convert_VariableSpec_V2beta1_to_V2(in.Spec)
	if err != nil {
		return err
	}
	out.Spec = spec
	return nil
}

func Convert_Variable_V2_to_V2beta1(in *dashv2.Variable, out *dashv2beta1.Variable, _ conversion.Scope) error {
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	out.APIVersion = dashv2beta1.APIVERSION
	out.Kind = in.Kind

	var spec dashv2beta1.VariableSpec
	if err := convertVariableSpec(in.Spec, &spec); err != nil {
		return fmt.Errorf("failed to convert v2 variable spec to v2beta1: %w", err)
	}
	out.Spec = spec
	return nil
}

// Convert_VariableSpec_V2beta1_to_V2 converts only the spec, for callers that
// handle v2beta1 variables with code written against the v2 types.
func Convert_VariableSpec_V2beta1_to_V2(in dashv2beta1.VariableSpec) (dashv2.VariableSpec, error) {
	var out dashv2.VariableSpec
	if err := convertVariableSpec(in, &out); err != nil {
		return dashv2.VariableSpec{}, fmt.Errorf("failed to convert v2beta1 variable spec to v2: %w", err)
	}
	return out, nil
}

func convertVariableSpec(in json.Marshaler, out json.Unmarshaler) error {
	raw, err := in.MarshalJSON()
	if err != nil {
		return err
	}
	return out.UnmarshalJSON(raw)
}
