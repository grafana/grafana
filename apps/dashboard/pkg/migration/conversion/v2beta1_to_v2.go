package conversion

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// v2beta1 -> v2: TransformationKind alignment with VizConfigKind/DataQueryKind.
// Moves transformation ID from kind to group, makes kind a fixed "Transformation" literal.

func Convert_V2beta1_to_V2(in *dashv2beta1.Dashboard, out *dashv2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2.APIVERSION
	out.Kind = in.Kind

	specJSON, err := json.Marshal(in.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal v2beta1 spec: %w", err)
	}

	if err := json.Unmarshal(specJSON, &out.Spec); err != nil {
		return fmt.Errorf("failed to unmarshal into v2 spec: %w", err)
	}

	fixupTransformations_V2beta1_to_V2(in, out)

	return nil
}

func fixupTransformations_V2beta1_to_V2(in *dashv2beta1.Dashboard, out *dashv2.Dashboard) {
	for key, element := range out.Spec.Elements {
		if element.PanelKind == nil {
			continue
		}

		inElement, ok := in.Spec.Elements[key]
		if !ok || inElement.PanelKind == nil {
			continue
		}

		inTransformations := inElement.PanelKind.Spec.Data.Spec.Transformations
		outTransformations := make([]dashv2.DashboardTransformationKind, len(inTransformations))

		for i, t := range inTransformations {
			outTransformations[i] = dashv2.DashboardTransformationKind{
				Kind:  "Transformation",
				Group: t.Kind, // v2beta1 kind is the transformation ID
				Spec: dashv2.DashboardTransformationSpec{
					Disabled: t.Spec.Disabled,
					Filter:   convertMatcherConfigToV2(t.Spec.Filter),
					Topic:    (*dashv2.DashboardDataTopic)(t.Spec.Topic),
					Options:  t.Spec.Options,
				},
			}
		}

		element.PanelKind.Spec.Data.Spec.Transformations = outTransformations
		out.Spec.Elements[key] = element
	}
}

func convertMatcherConfigToV2(in *dashv2beta1.DashboardMatcherConfig) *dashv2.DashboardMatcherConfig {
	if in == nil {
		return nil
	}
	out := &dashv2.DashboardMatcherConfig{
		Id:      in.Id,
		Options: in.Options,
	}
	if in.Scope != nil {
		scope := dashv2.DashboardMatcherScope(*in.Scope)
		out.Scope = &scope
	}
	return out
}
