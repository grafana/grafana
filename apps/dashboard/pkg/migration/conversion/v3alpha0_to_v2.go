package conversion

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/utils/ptr"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv3alpha0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v3alpha0"
)

// Schema migration: v3alpha0 → v2 (stable)
//
// v2 stable predates Dashboard Rules and cannot represent the full rule shape
// (collapse outcomes, refresh-interval overrides, query overrides, multi-target
// rules, user-team conditions). The conversion is lossy on purpose.
//
// The v2-compatible rule subset — visibility-only outcome, single target,
// conditions limited to Variable / Data / TimeRangeSize — is round-tripped by
// reinstalling each rule as a per-element / per-layout-item conditionalRendering
// block. Rules outside that subset are dropped. Lossy fields are declared in
// conversion_data_loss_detection.go.

func Convert_V3alpha0_to_V2(in *dashv3alpha0.Dashboard, out *dashv2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2.APIVERSION
	out.Kind = in.Kind

	specJSON, err := json.Marshal(in.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal v3alpha0 spec: %w", err)
	}

	if err := json.Unmarshal(specJSON, &out.Spec); err != nil {
		return fmt.Errorf("failed to unmarshal into v2 spec: %w", err)
	}

	// v3alpha0 ↔ v2 transformation format differs (v2 uses kind:"Transformation"
	// literal + group:<id>, v3alpha0 inherits the v2beta1 shape where kind is the
	// transformation ID). Re-emit transformations as v2 expects them.
	fixupTransformations_V3alpha0_to_V2(in, out)

	// Reinstall the v2-compatible rule subset as element/layout-item-level
	// conditionalRendering blocks. Incompatible rules are silently dropped (and
	// flagged by the data-loss detector).
	reinstallVisibilityRules_V3alpha0_to_V2(in.Spec.Rules, out)

	return nil
}

// fixupTransformations_V3alpha0_to_V2 is the mirror of fixupTransformations_V2_to_V3alpha0.
func fixupTransformations_V3alpha0_to_V2(in *dashv3alpha0.Dashboard, out *dashv2.Dashboard) {
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
				Group: t.Kind, // v3alpha0 kind carries the transformation ID
				Spec: dashv2.DashboardTransformationSpec{
					Disabled: t.Spec.Disabled,
					Filter:   convertMatcherConfigFromV3alpha0ToV2(t.Spec.Filter),
					Topic:    (*dashv2.DashboardDataTopic)(t.Spec.Topic),
					Options:  t.Spec.Options,
				},
			}
		}

		element.PanelKind.Spec.Data.Spec.Transformations = outTransformations
		out.Spec.Elements[key] = element
	}
}

func convertMatcherConfigFromV3alpha0ToV2(in *dashv3alpha0.DashboardMatcherConfig) *dashv2.DashboardMatcherConfig {
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

// reinstallVisibilityRules_V3alpha0_to_V2 walks the rules array and attaches a
// conditionalRendering block to each rule's target when the rule matches the
// v2-compatible subset. Non-matching rules are dropped.
//
// v2-compatible means:
//   - exactly one target
//   - exactly one outcome, of kind DashboardRuleOutcomeVisibility
//   - all conditions are Variable / Data / TimeRangeSize (UserTeam is not
//     expressible in v2)
func reinstallVisibilityRules_V3alpha0_to_V2(rules []dashv3alpha0.DashboardDashboardRuleKind, out *dashv2.Dashboard) {
	for _, rule := range rules {
		if !isV2CompatibleRule_V3alpha0(&rule) {
			continue
		}

		target := rule.Spec.Targets[0]
		visibility := rule.Spec.Outcomes[0].DashboardRuleOutcomeVisibilityKind.Spec.Visibility

		cr := &dashv2.DashboardConditionalRenderingGroupKind{
			Kind: "ConditionalRenderingGroup",
			Spec: dashv2.DashboardConditionalRenderingGroupSpec{
				Visibility: dashv2.DashboardConditionalRenderingGroupSpecVisibility(visibility),
				Condition:  dashv2.DashboardConditionalRenderingGroupSpecCondition(rule.Spec.Conditions.Match),
				Items:      convertConditionItems_V3alpha0_to_V2(rule.Spec.Conditions.Items),
			},
		}

		if target.ElementReference != nil {
			attachConditionalRenderingToElement_V2(&out.Spec.Layout, target.ElementReference.Name, cr)
		} else if target.LayoutItemReference != nil {
			attachConditionalRenderingToLayoutItem_V2(&out.Spec.Layout, target.LayoutItemReference.Name, cr)
		}
	}
}

func isV2CompatibleRule_V3alpha0(rule *dashv3alpha0.DashboardDashboardRuleKind) bool {
	if len(rule.Spec.Targets) != 1 {
		return false
	}
	if len(rule.Spec.Outcomes) != 1 {
		return false
	}
	if rule.Spec.Outcomes[0].DashboardRuleOutcomeVisibilityKind == nil {
		return false
	}
	for _, item := range rule.Spec.Conditions.Items {
		if item.ConditionalRenderingUserTeamKind != nil {
			return false
		}
	}
	return true
}

func convertConditionItems_V3alpha0_to_V2(in []dashv3alpha0.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKindOrConditionalRenderingUserTeamKind) []dashv2.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind {
	out := make([]dashv2.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind, 0, len(in))
	for _, item := range in {
		converted := dashv2.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind{}
		if item.ConditionalRenderingVariableKind != nil {
			converted.ConditionalRenderingVariableKind = &dashv2.DashboardConditionalRenderingVariableKind{
				Kind: item.ConditionalRenderingVariableKind.Kind,
				Spec: dashv2.DashboardConditionalRenderingVariableSpec{
					Variable: item.ConditionalRenderingVariableKind.Spec.Variable,
					Operator: dashv2.DashboardConditionalRenderingVariableSpecOperator(item.ConditionalRenderingVariableKind.Spec.Operator),
					Value:    item.ConditionalRenderingVariableKind.Spec.Value,
				},
			}
		}
		if item.ConditionalRenderingDataKind != nil {
			converted.ConditionalRenderingDataKind = &dashv2.DashboardConditionalRenderingDataKind{
				Kind: item.ConditionalRenderingDataKind.Kind,
				Spec: dashv2.DashboardConditionalRenderingDataSpec{
					Value: item.ConditionalRenderingDataKind.Spec.Value,
				},
			}
		}
		if item.ConditionalRenderingTimeRangeSizeKind != nil {
			converted.ConditionalRenderingTimeRangeSizeKind = &dashv2.DashboardConditionalRenderingTimeRangeSizeKind{
				Kind: item.ConditionalRenderingTimeRangeSizeKind.Kind,
				Spec: dashv2.DashboardConditionalRenderingTimeRangeSizeSpec{
					Value: item.ConditionalRenderingTimeRangeSizeKind.Spec.Value,
				},
			}
		}
		// UserTeam items are filtered out by isV2CompatibleRule_V3alpha0; still
		// handle defensively.
		out = append(out, converted)
	}
	return out
}

// attachConditionalRenderingToElement_V2 walks the v2 layout tree and sets the
// conditionalRendering field on the layout item whose element reference matches
// the target name. AutoGridLayoutItemSpec is the only v2 layout item that
// carries both an element reference and a conditionalRendering field, so the
// attach is scoped to auto-grid items.
func attachConditionalRenderingToElement_V2(layout *dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, elementName string, cr *dashv2.DashboardConditionalRenderingGroupKind) {
	if layout == nil {
		return
	}
	if layout.AutoGridLayoutKind != nil {
		for i := range layout.AutoGridLayoutKind.Spec.Items {
			item := &layout.AutoGridLayoutKind.Spec.Items[i]
			if item.Spec.Element.Name == elementName {
				item.Spec.ConditionalRendering = cr
				return
			}
		}
	}
	if layout.RowsLayoutKind != nil {
		for i := range layout.RowsLayoutKind.Spec.Rows {
			row := &layout.RowsLayoutKind.Spec.Rows[i]
			attachConditionalRenderingToElementInRowLayout_V2(&row.Spec.Layout, elementName, cr)
		}
	}
	if layout.TabsLayoutKind != nil {
		for i := range layout.TabsLayoutKind.Spec.Tabs {
			tab := &layout.TabsLayoutKind.Spec.Tabs[i]
			attachConditionalRenderingToElement_V2(&tab.Spec.Layout, elementName, cr)
		}
	}
}

func attachConditionalRenderingToElementInRowLayout_V2(layout *dashv2.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind, elementName string, cr *dashv2.DashboardConditionalRenderingGroupKind) {
	if layout == nil {
		return
	}
	if layout.AutoGridLayoutKind != nil {
		for i := range layout.AutoGridLayoutKind.Spec.Items {
			item := &layout.AutoGridLayoutKind.Spec.Items[i]
			if item.Spec.Element.Name == elementName {
				item.Spec.ConditionalRendering = cr
				return
			}
		}
	}
	if layout.RowsLayoutKind != nil {
		for i := range layout.RowsLayoutKind.Spec.Rows {
			row := &layout.RowsLayoutKind.Spec.Rows[i]
			attachConditionalRenderingToElementInRowLayout_V2(&row.Spec.Layout, elementName, cr)
		}
	}
	if layout.TabsLayoutKind != nil {
		for i := range layout.TabsLayoutKind.Spec.Tabs {
			tab := &layout.TabsLayoutKind.Spec.Tabs[i]
			attachConditionalRenderingToElement_V2(&tab.Spec.Layout, elementName, cr)
		}
	}
}

// attachConditionalRenderingToLayoutItem_V2 walks the v2 layout tree and sets
// the conditionalRendering field on the row or tab whose title matches the
// target layoutItemName. v2 rows and tabs have no stable "name" field, so title
// matching is the best we can do; this mirrors how the v2 → v3alpha0 upgrade
// uses title as the LayoutItemReference.name.
func attachConditionalRenderingToLayoutItem_V2(layout *dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, layoutItemName string, cr *dashv2.DashboardConditionalRenderingGroupKind) {
	if layout == nil {
		return
	}
	if layout.RowsLayoutKind != nil {
		for i := range layout.RowsLayoutKind.Spec.Rows {
			row := &layout.RowsLayoutKind.Spec.Rows[i]
			title := ""
			if row.Spec.Title != nil {
				title = *row.Spec.Title
			}
			if title == layoutItemName {
				row.Spec.ConditionalRendering = cr
				return
			}
			attachConditionalRenderingToLayoutItemInRowLayout_V2(&row.Spec.Layout, layoutItemName, cr)
		}
	}
	if layout.TabsLayoutKind != nil {
		for i := range layout.TabsLayoutKind.Spec.Tabs {
			tab := &layout.TabsLayoutKind.Spec.Tabs[i]
			title := ""
			if tab.Spec.Title != nil {
				title = *tab.Spec.Title
			}
			if title == layoutItemName {
				tab.Spec.ConditionalRendering = cr
				return
			}
			attachConditionalRenderingToLayoutItem_V2(&tab.Spec.Layout, layoutItemName, cr)
		}
	}
}

func attachConditionalRenderingToLayoutItemInRowLayout_V2(layout *dashv2.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind, layoutItemName string, cr *dashv2.DashboardConditionalRenderingGroupKind) {
	if layout == nil {
		return
	}
	if layout.RowsLayoutKind != nil {
		for i := range layout.RowsLayoutKind.Spec.Rows {
			row := &layout.RowsLayoutKind.Spec.Rows[i]
			title := ""
			if row.Spec.Title != nil {
				title = *row.Spec.Title
			}
			if title == layoutItemName {
				row.Spec.ConditionalRendering = cr
				return
			}
			attachConditionalRenderingToLayoutItemInRowLayout_V2(&row.Spec.Layout, layoutItemName, cr)
		}
	}
	if layout.TabsLayoutKind != nil {
		for i := range layout.TabsLayoutKind.Spec.Tabs {
			tab := &layout.TabsLayoutKind.Spec.Tabs[i]
			title := ""
			if tab.Spec.Title != nil {
				title = *tab.Spec.Title
			}
			if title == layoutItemName {
				tab.Spec.ConditionalRendering = cr
				return
			}
			attachConditionalRenderingToLayoutItem_V2(&tab.Spec.Layout, layoutItemName, cr)
		}
	}
}

// Suppress unused import warning from ptr package when all helpers above are
// field-copies only; exported for future use in default-spec plumbing.
var _ = ptr.To[string]
