package conversion

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// v2 -> v2beta1: reverse of v2beta1_to_v2.go.
// Moves transformation ID from group back to kind and spec.id.

func Convert_V2_to_V2beta1(in *dashv2.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2beta1.APIVERSION
	out.Kind = in.Kind

	specJSON, err := json.Marshal(in.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal v2 spec: %w", err)
	}

	if err := json.Unmarshal(specJSON, &out.Spec); err != nil {
		return fmt.Errorf("failed to unmarshal into v2beta1 spec: %w", err)
	}

	fixupTransformations_V2_to_V2beta1(in, out)

	return nil
}

func fixupTransformations_V2_to_V2beta1(in *dashv2.Dashboard, out *dashv2beta1.Dashboard) {
	for key, element := range out.Spec.Elements {
		if element.PanelKind == nil {
			continue
		}

		inElement, ok := in.Spec.Elements[key]
		if !ok || inElement.PanelKind == nil {
			continue
		}

		inTransformations := inElement.PanelKind.Spec.Data.Spec.Transformations
		outTransformations := make([]dashv2beta1.DashboardTransformationKind, len(inTransformations))

		for i, t := range inTransformations {
			outTransformations[i] = dashv2beta1.DashboardTransformationKind{
				Kind: t.Group, // v2 group becomes v2beta1 kind
				Spec: dashv2beta1.DashboardDataTransformerConfig{
					Id:       t.Group, // group also becomes spec.id in v2beta1
					Disabled: t.Spec.Disabled,
					Filter:   convertMatcherConfigToV2beta1(t.Spec.Filter),
					Topic:    (*dashv2beta1.DashboardDataTopic)(t.Spec.Topic),
					Options:  t.Spec.Options,
				},
			}
		}

		element.PanelKind.Spec.Data.Spec.Transformations = outTransformations
		out.Spec.Elements[key] = element
	}
}

func convertMatcherConfigToV2beta1(in *dashv2.DashboardMatcherConfig) *dashv2beta1.DashboardMatcherConfig {
	if in == nil {
		return nil
	}
	out := &dashv2beta1.DashboardMatcherConfig{
		Id:      in.Id,
		Options: in.Options,
	}
	if in.Scope != nil {
		scope := dashv2beta1.DashboardMatcherScope(*in.Scope)
		out.Scope = &scope
	}
	return out
}
