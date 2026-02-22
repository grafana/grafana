package conversion

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	dashv2beta2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta2"
)

// Schema Migration: v2beta2 -> v2beta1
//
// This file handles the conversion from Dashboard v2beta2 to v2beta1 schema.
// This is the reverse of v2beta1_to_v2beta2.go conversion.
//
// v2beta2 TransformationKind:
//   - kind: "Transformation" (fixed literal)
//   - group: string (transformation ID, e.g. "calculateField")
//   - spec: TransformationSpec { disabled, filter, topic, options }
//
// v2beta1 TransformationKind:
//   - kind: string (transformation ID, e.g. "calculateField")
//   - spec: DataTransformerConfig { id, disabled, filter, topic, options }
//
// The "group" field becomes both "kind" and "spec.id" in v2beta1.

func Convert_V2beta2_to_V2beta1(in *dashv2beta2.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2beta1.APIVERSION
	out.Kind = in.Kind

	// Use JSON round-trip for the spec since v2beta2 and v2beta1 are nearly identical.
	// The only structural difference is TransformationKind, which we fix up after unmarshaling.
	specJSON, err := json.Marshal(in.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal v2beta2 spec: %w", err)
	}

	if err := json.Unmarshal(specJSON, &out.Spec); err != nil {
		return fmt.Errorf("failed to unmarshal into v2beta1 spec: %w", err)
	}

	// Fix up transformations in all elements' query groups.
	fixupTransformations_V2beta2_to_V2beta1(in, out)

	return nil
}

// fixupTransformations_V2beta2_to_V2beta1 converts transformation structures
// from v2beta2 format (kind="Transformation", group=transformationID) to
// v2beta1 format (kind=transformationID, spec.id=transformationID).
func fixupTransformations_V2beta2_to_V2beta1(in *dashv2beta2.Dashboard, out *dashv2beta1.Dashboard) {
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
				Kind: t.Group, // v2beta2 group becomes v2beta1 kind
				Spec: dashv2beta1.DashboardDataTransformerConfig{
					Id:       t.Group, // group also becomes spec.id in v2beta1
					Disabled: t.Spec.Disabled,
					Filter:   (*dashv2beta1.DashboardMatcherConfig)(t.Spec.Filter),
					Topic:    (*dashv2beta1.DashboardDataTopic)(t.Spec.Topic),
					Options:  t.Spec.Options,
				},
			}
		}

		element.PanelKind.Spec.Data.Spec.Transformations = outTransformations
		out.Spec.Elements[key] = element
	}
}
