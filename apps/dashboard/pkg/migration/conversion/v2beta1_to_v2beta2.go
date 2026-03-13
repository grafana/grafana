package conversion

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	dashv2beta2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta2"
)

// v2beta1 -> v2beta2: TransformationKind alignment with VizConfigKind/DataQueryKind.
// Moves transformation ID from kind to group, makes kind a fixed "Transformation" literal.

func Convert_V2beta1_to_V2beta2(in *dashv2beta1.Dashboard, out *dashv2beta2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2beta2.APIVERSION
	out.Kind = in.Kind

	specJSON, err := json.Marshal(in.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal v2beta1 spec: %w", err)
	}

	if err := json.Unmarshal(specJSON, &out.Spec); err != nil {
		return fmt.Errorf("failed to unmarshal into v2beta2 spec: %w", err)
	}

	fixupTransformations_V2beta1_to_V2beta2(in, out)

	return nil
}

func fixupTransformations_V2beta1_to_V2beta2(in *dashv2beta1.Dashboard, out *dashv2beta2.Dashboard) {
	for key, element := range out.Spec.Elements {
		if element.PanelKind == nil {
			continue
		}

		inElement, ok := in.Spec.Elements[key]
		if !ok || inElement.PanelKind == nil {
			continue
		}

		inTransformations := inElement.PanelKind.Spec.Data.Spec.Transformations
		outTransformations := make([]dashv2beta2.DashboardTransformationKind, len(inTransformations))

		for i, t := range inTransformations {
			outTransformations[i] = dashv2beta2.DashboardTransformationKind{
				Kind:  "Transformation",
				Group: t.Kind, // v2beta1 kind is the transformation ID
				Spec: dashv2beta2.DashboardTransformationSpec{
					Disabled: t.Spec.Disabled,
					Filter:   (*dashv2beta2.DashboardMatcherConfig)(t.Spec.Filter),
					Topic:    (*dashv2beta2.DashboardDataTopic)(t.Spec.Topic),
					Options:  t.Spec.Options,
				},
			}
		}

		element.PanelKind.Spec.Data.Spec.Transformations = outTransformations
		out.Spec.Elements[key] = element
	}
}
