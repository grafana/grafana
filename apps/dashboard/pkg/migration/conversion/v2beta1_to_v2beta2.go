package conversion

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	dashv2beta2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta2"
)

// Schema Migration: v2beta1 -> v2beta2
//
// This file handles the conversion from Dashboard v2beta1 to v2beta2 schema.
// The only structural change between v2beta1 and v2beta2 is the TransformationKind:
//
// v2beta1 TransformationKind:
//   - kind: string (transformation ID, e.g. "calculateField")
//   - spec: DataTransformerConfig { id, disabled, filter, topic, options }
//
// v2beta2 TransformationKind (aligned with VizConfigKind and DataQueryKind):
//   - kind: "Transformation" (fixed literal)
//   - group: string (transformation ID, e.g. "calculateField")
//   - spec: TransformationSpec { disabled, filter, topic, options }
//
// The "id" field is removed from the spec since it's redundant with "group".

func Convert_V2beta1_to_V2beta2(in *dashv2beta1.Dashboard, out *dashv2beta2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2beta2.APIVERSION
	out.Kind = in.Kind

	// Use JSON round-trip for the spec since v2beta1 and v2beta2 are nearly identical.
	// The only structural difference is TransformationKind, which we fix up after unmarshaling.
	specJSON, err := json.Marshal(in.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal v2beta1 spec: %w", err)
	}

	if err := json.Unmarshal(specJSON, &out.Spec); err != nil {
		return fmt.Errorf("failed to unmarshal into v2beta2 spec: %w", err)
	}

	// Fix up transformations in all elements' query groups.
	// The JSON round-trip handles all identical fields, but TransformationKind
	// needs explicit conversion because its structure changed.
	fixupTransformations_V2beta1_to_V2beta2(in, out)

	return nil
}

// fixupTransformations_V2beta1_to_V2beta2 converts transformation structures
// from v2beta1 format (kind=transformationID, spec.id) to v2beta2 format
// (kind="Transformation", group=transformationID, no spec.id).
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
