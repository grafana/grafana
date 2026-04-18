package conversion

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/utils/ptr"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv3alpha0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v3alpha0"
)

// Schema migration: v2 (stable) → v3alpha0
//
// v2 stable predates Dashboard Rules. Rules are a v3alpha0-and-newer concept.
// Shared spec fields are copied via JSON round-trip. The semantic migration step
// promotes element-level and layout-item-level conditionalRendering blocks into
// first-class DashboardRule entries targeting those elements with a visibility
// outcome. Nothing from v2 is lost: a v2 dashboard with conditionalRendering
// becomes a v3alpha0 dashboard whose `rules` array mirrors that behaviour. A v2
// dashboard without any conditionalRendering produces `rules: []`.

func Convert_V2_to_V3alpha0(in *dashv2.Dashboard, out *dashv3alpha0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv3alpha0.APIVERSION
	out.Kind = in.Kind

	specJSON, err := json.Marshal(in.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal v2 spec: %w", err)
	}

	if err := json.Unmarshal(specJSON, &out.Spec); err != nil {
		return fmt.Errorf("failed to unmarshal into v3alpha0 spec: %w", err)
	}

	// Transformations use the same v2-shape in v3alpha0 (we copied v2beta1 which
	// was the same as v2 with respect to transformation wire format is *not* the
	// case — v3alpha0 inherits v2beta1's shape. Re-emit the v2-shaped
	// DashboardTransformationKind as v3alpha0 expects it.
	fixupTransformations_V2_to_V3alpha0(in, out)

	// Semantic migration: promote element-level and layout-item-level
	// conditionalRendering into DashboardRule entries.
	out.Spec.Rules = promoteConditionalRenderingToRules_V2_to_V3alpha0(&in.Spec)

	return nil
}

// fixupTransformations_V2_to_V3alpha0 mirrors fixupTransformations_V2_to_V2beta1
// because v3alpha0 inherits v2beta1's DataTransformerConfig wire format.
func fixupTransformations_V2_to_V3alpha0(in *dashv2.Dashboard, out *dashv3alpha0.Dashboard) {
	for key, element := range out.Spec.Elements {
		if element.PanelKind == nil {
			continue
		}

		inElement, ok := in.Spec.Elements[key]
		if !ok || inElement.PanelKind == nil {
			continue
		}

		inTransformations := inElement.PanelKind.Spec.Data.Spec.Transformations
		outTransformations := make([]dashv3alpha0.DashboardTransformationKind, len(inTransformations))

		for i, t := range inTransformations {
			outTransformations[i] = dashv3alpha0.DashboardTransformationKind{
				Kind: t.Group, // v2 group becomes v3alpha0 kind
				Spec: dashv3alpha0.DashboardDataTransformerConfig{
					Id:       t.Group, // group also becomes spec.id in v3alpha0
					Disabled: t.Spec.Disabled,
					Filter:   convertMatcherConfigToV3alpha0(t.Spec.Filter),
					Topic:    (*dashv3alpha0.DashboardDataTopic)(t.Spec.Topic),
					Options:  t.Spec.Options,
				},
			}
		}

		element.PanelKind.Spec.Data.Spec.Transformations = outTransformations
		out.Spec.Elements[key] = element
	}
}

func convertMatcherConfigToV3alpha0(in *dashv2.DashboardMatcherConfig) *dashv3alpha0.DashboardMatcherConfig {
	if in == nil {
		return nil
	}
	out := &dashv3alpha0.DashboardMatcherConfig{
		Id:      in.Id,
		Options: in.Options,
	}
	if in.Scope != nil {
		scope := dashv3alpha0.DashboardMatcherScope(*in.Scope)
		out.Scope = &scope
	}
	return out
}

// promoteConditionalRenderingToRules_V2_to_V3alpha0 walks the layout tree and
// synthesises a DashboardRule for every conditionalRendering block on an
// element-level or layout-item-level target. The rule targets the element/row/tab
// and carries a single visibility outcome matching the v2 "show" / "hide"
// semantics.
//
// v2 conditionalRendering.condition maps 1:1 to v3alpha0 DashboardRuleConditionsSpec.match.
// v2 conditionalRendering.items copy over field-for-field — UserTeam is not a
// v2 condition type, so the transform only has to handle Variable / Data /
// TimeRangeSize.
func promoteConditionalRenderingToRules_V2_to_V3alpha0(in *dashv2.DashboardSpec) []dashv3alpha0.DashboardDashboardRuleKind {
	rules := []dashv3alpha0.DashboardDashboardRuleKind{}

	// Element-level conditionalRendering lives on the layout items that wrap an
	// element reference, not on the element itself. We walk the layout tree
	// rooted at in.Layout to find every conditionalRendering block and its
	// implied target.
	walkTabLayoutForConditionalRendering_V2(&in.Layout, func(targetElementName string, targetLayoutItemName string, cr *dashv2.DashboardConditionalRenderingGroupKind) {
		if cr == nil {
			return
		}
		rule := buildVisibilityRule_V2_to_V3alpha0(targetElementName, targetLayoutItemName, cr)
		rules = append(rules, rule)
	})

	return rules
}

// walkLayoutForConditionalRendering_V2 descends the layout tree. For each
// layout item that carries a conditionalRendering block, the visit callback is
// invoked with a target descriptor (either an element name or a layout-item
// name — never both).
//
// v2 has three places where conditionalRendering lives:
// - RowsLayoutRowSpec (layout item, targeted by title)
// - TabsLayoutTabSpec (layout item, targeted by title)
// - AutoGridLayoutItemSpec (element-level, targeted by element name)
//
// GridLayoutItemSpec in v2 does NOT carry conditionalRendering; the grid layout
// predates the feature. Only the newer auto-grid / rows / tabs layouts carry
// the field.
func walkRowLayoutForConditionalRendering_V2(layout *dashv2.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind, visit func(elementName, layoutItemName string, cr *dashv2.DashboardConditionalRenderingGroupKind)) {
	if layout == nil {
		return
	}
	if layout.AutoGridLayoutKind != nil {
		for _, item := range layout.AutoGridLayoutKind.Spec.Items {
			if item.Spec.ConditionalRendering != nil {
				visit(item.Spec.Element.Name, "", item.Spec.ConditionalRendering)
			}
		}
	}
	if layout.RowsLayoutKind != nil {
		for _, row := range layout.RowsLayoutKind.Spec.Rows {
			title := ""
			if row.Spec.Title != nil {
				title = *row.Spec.Title
			}
			if row.Spec.ConditionalRendering != nil {
				visit("", title, row.Spec.ConditionalRendering)
			}
			walkRowLayoutForConditionalRendering_V2(&row.Spec.Layout, visit)
		}
	}
	if layout.TabsLayoutKind != nil {
		for _, tab := range layout.TabsLayoutKind.Spec.Tabs {
			title := ""
			if tab.Spec.Title != nil {
				title = *tab.Spec.Title
			}
			if tab.Spec.ConditionalRendering != nil {
				visit("", title, tab.Spec.ConditionalRendering)
			}
			walkTabLayoutForConditionalRendering_V2(&tab.Spec.Layout, visit)
		}
	}
}

func walkTabLayoutForConditionalRendering_V2(layout *dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, visit func(elementName, layoutItemName string, cr *dashv2.DashboardConditionalRenderingGroupKind)) {
	if layout == nil {
		return
	}
	if layout.AutoGridLayoutKind != nil {
		for _, item := range layout.AutoGridLayoutKind.Spec.Items {
			if item.Spec.ConditionalRendering != nil {
				visit(item.Spec.Element.Name, "", item.Spec.ConditionalRendering)
			}
		}
	}
	if layout.RowsLayoutKind != nil {
		for _, row := range layout.RowsLayoutKind.Spec.Rows {
			title := ""
			if row.Spec.Title != nil {
				title = *row.Spec.Title
			}
			if row.Spec.ConditionalRendering != nil {
				visit("", title, row.Spec.ConditionalRendering)
			}
			walkRowLayoutForConditionalRendering_V2(&row.Spec.Layout, visit)
		}
	}
	if layout.TabsLayoutKind != nil {
		for _, tab := range layout.TabsLayoutKind.Spec.Tabs {
			title := ""
			if tab.Spec.Title != nil {
				title = *tab.Spec.Title
			}
			if tab.Spec.ConditionalRendering != nil {
				visit("", title, tab.Spec.ConditionalRendering)
			}
			walkTabLayoutForConditionalRendering_V2(&tab.Spec.Layout, visit)
		}
	}
}

func buildVisibilityRule_V2_to_V3alpha0(elementName, layoutItemName string, cr *dashv2.DashboardConditionalRenderingGroupKind) dashv3alpha0.DashboardDashboardRuleKind {
	targets := []dashv3alpha0.DashboardElementReferenceOrLayoutItemReference{}
	if elementName != "" {
		targets = append(targets, dashv3alpha0.DashboardElementReferenceOrLayoutItemReference{
			ElementReference: &dashv3alpha0.DashboardElementReference{
				Kind: "ElementReference",
				Name: elementName,
			},
		})
	} else if layoutItemName != "" {
		targets = append(targets, dashv3alpha0.DashboardElementReferenceOrLayoutItemReference{
			LayoutItemReference: &dashv3alpha0.DashboardLayoutItemReference{
				Kind: "LayoutItemReference",
				Name: layoutItemName,
			},
		})
	}

	visibility := dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpecVisibility(cr.Spec.Visibility)

	return dashv3alpha0.DashboardDashboardRuleKind{
		Kind: "DashboardRule",
		Spec: dashv3alpha0.DashboardDashboardRuleSpec{
			Name:    ptr.To(""), // unnamed auto-migrated rule
			Targets: targets,
			Conditions: dashv3alpha0.DashboardDashboardRuleConditionsSpec{
				Match: dashv3alpha0.DashboardDashboardRuleConditionsSpecMatch(cr.Spec.Condition),
				Items: convertConditionItems_V2_to_V3alpha0(cr.Spec.Items),
			},
			Outcomes: []dashv3alpha0.DashboardDashboardRuleOutcomeVisibilityKindOrDashboardRuleOutcomeCollapseKindOrDashboardRuleOutcomeRefreshIntervalKindOrDashboardRuleOutcomeOverrideQueryKind{
				{
					DashboardRuleOutcomeVisibilityKind: &dashv3alpha0.DashboardDashboardRuleOutcomeVisibilityKind{
						Kind: "DashboardRuleOutcomeVisibility",
						Spec: dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpec{
							Visibility: visibility,
						},
					},
				},
			},
		},
	}
}

func convertConditionItems_V2_to_V3alpha0(in []dashv2.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind) []dashv3alpha0.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKindOrConditionalRenderingUserTeamKind {
	out := make([]dashv3alpha0.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKindOrConditionalRenderingUserTeamKind, 0, len(in))
	for _, item := range in {
		converted := dashv3alpha0.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKindOrConditionalRenderingUserTeamKind{}
		if item.ConditionalRenderingVariableKind != nil {
			converted.ConditionalRenderingVariableKind = &dashv3alpha0.DashboardConditionalRenderingVariableKind{
				Kind: item.ConditionalRenderingVariableKind.Kind,
				Spec: dashv3alpha0.DashboardConditionalRenderingVariableSpec{
					Variable: item.ConditionalRenderingVariableKind.Spec.Variable,
					Operator: dashv3alpha0.DashboardConditionalRenderingVariableSpecOperator(item.ConditionalRenderingVariableKind.Spec.Operator),
					Value:    item.ConditionalRenderingVariableKind.Spec.Value,
				},
			}
		}
		if item.ConditionalRenderingDataKind != nil {
			converted.ConditionalRenderingDataKind = &dashv3alpha0.DashboardConditionalRenderingDataKind{
				Kind: item.ConditionalRenderingDataKind.Kind,
				Spec: dashv3alpha0.DashboardConditionalRenderingDataSpec{
					Value: item.ConditionalRenderingDataKind.Spec.Value,
				},
			}
		}
		if item.ConditionalRenderingTimeRangeSizeKind != nil {
			converted.ConditionalRenderingTimeRangeSizeKind = &dashv3alpha0.DashboardConditionalRenderingTimeRangeSizeKind{
				Kind: item.ConditionalRenderingTimeRangeSizeKind.Kind,
				Spec: dashv3alpha0.DashboardConditionalRenderingTimeRangeSizeSpec{
					Value: item.ConditionalRenderingTimeRangeSizeKind.Spec.Value,
				},
			}
		}
		out = append(out, converted)
	}
	return out
}
