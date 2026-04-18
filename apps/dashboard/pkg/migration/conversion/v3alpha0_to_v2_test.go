package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv3alpha0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v3alpha0"
)

// TestV3alpha0ToV2_EmptyRules verifies that a dashboard with no rules converts
// via JSON round-trip with no side effects.
func TestV3alpha0ToV2_EmptyRules(t *testing.T) {
	in := &dashv3alpha0.Dashboard{
		Spec: dashv3alpha0.DashboardSpec{
			Title: "NoRules",
			Layout: dashv3alpha0.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv3alpha0.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv3alpha0.DashboardGridLayoutSpec{Items: []dashv3alpha0.DashboardGridLayoutItemKind{}},
				},
			},
			Rules: []dashv3alpha0.DashboardDashboardRuleKind{},
		},
	}
	out := &dashv2.Dashboard{}
	err := Convert_V3alpha0_to_V2(in, out, nil)
	require.NoError(t, err)
	assert.Equal(t, "NoRules", out.Spec.Title)
}

// TestV3alpha0ToV2_VisibilitySubsetRoundTrips verifies that a v2-compatible
// visibility rule targeting an auto-grid item becomes an element-level
// conditionalRendering block in v2.
func TestV3alpha0ToV2_VisibilitySubsetRoundTrips(t *testing.T) {
	in := &dashv3alpha0.Dashboard{
		Spec: dashv3alpha0.DashboardSpec{
			Title: "VisSubset",
			Layout: dashv3alpha0.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				AutoGridLayoutKind: &dashv3alpha0.DashboardAutoGridLayoutKind{
					Kind: "AutoGridLayout",
					Spec: dashv3alpha0.DashboardAutoGridLayoutSpec{
						Items: []dashv3alpha0.DashboardAutoGridLayoutItemKind{
							{
								Kind: "AutoGridLayoutItem",
								Spec: dashv3alpha0.DashboardAutoGridLayoutItemSpec{
									Element: dashv3alpha0.DashboardElementReference{Kind: "ElementReference", Name: "panel-a"},
								},
							},
						},
					},
				},
			},
			Rules: []dashv3alpha0.DashboardDashboardRuleKind{
				{
					Kind: "DashboardRule",
					Spec: dashv3alpha0.DashboardDashboardRuleSpec{
						Name: ptr.To("show-on-1h"),
						Targets: []dashv3alpha0.DashboardElementReferenceOrLayoutItemReference{
							{ElementReference: &dashv3alpha0.DashboardElementReference{Kind: "ElementReference", Name: "panel-a"}},
						},
						Conditions: dashv3alpha0.DashboardDashboardRuleConditionsSpec{
							Match: dashv3alpha0.DashboardDashboardRuleConditionsSpecMatchAnd,
							Items: []dashv3alpha0.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKindOrConditionalRenderingUserTeamKind{
								{
									ConditionalRenderingTimeRangeSizeKind: &dashv3alpha0.DashboardConditionalRenderingTimeRangeSizeKind{
										Kind: "ConditionalRenderingTimeRangeSize",
										Spec: dashv3alpha0.DashboardConditionalRenderingTimeRangeSizeSpec{Value: "1h"},
									},
								},
							},
						},
						Outcomes: []dashv3alpha0.DashboardDashboardRuleOutcomeVisibilityKindOrDashboardRuleOutcomeCollapseKindOrDashboardRuleOutcomeRefreshIntervalKindOrDashboardRuleOutcomeOverrideQueryKind{
							{
								DashboardRuleOutcomeVisibilityKind: &dashv3alpha0.DashboardDashboardRuleOutcomeVisibilityKind{
									Kind: "DashboardRuleOutcomeVisibility",
									Spec: dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpec{
										Visibility: dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpecVisibilityShow,
									},
								},
							},
						},
					},
				},
			},
		},
	}
	out := &dashv2.Dashboard{}
	err := Convert_V3alpha0_to_V2(in, out, nil)
	require.NoError(t, err)

	require.NotNil(t, out.Spec.Layout.AutoGridLayoutKind)
	require.Len(t, out.Spec.Layout.AutoGridLayoutKind.Spec.Items, 1)
	item := out.Spec.Layout.AutoGridLayoutKind.Spec.Items[0]
	require.NotNil(t, item.Spec.ConditionalRendering, "compatible visibility rule should be reinstalled as conditionalRendering")
	assert.Equal(t, dashv2.DashboardConditionalRenderingGroupSpecVisibilityShow, item.Spec.ConditionalRendering.Spec.Visibility)
	require.Len(t, item.Spec.ConditionalRendering.Spec.Items, 1)
	require.NotNil(t, item.Spec.ConditionalRendering.Spec.Items[0].ConditionalRenderingTimeRangeSizeKind)
	assert.Equal(t, "1h", item.Spec.ConditionalRendering.Spec.Items[0].ConditionalRenderingTimeRangeSizeKind.Spec.Value)
}

// TestV3alpha0ToV2_CollapseOutcomeDropped verifies that a rule with a collapse
// outcome is NOT reinstalled as conditionalRendering (v2 has no equivalent).
func TestV3alpha0ToV2_CollapseOutcomeDropped(t *testing.T) {
	in := buildV3alpha0RuleDashboard(t, dashv3alpha0.DashboardDashboardRuleKind{
		Kind: "DashboardRule",
		Spec: dashv3alpha0.DashboardDashboardRuleSpec{
			Targets: []dashv3alpha0.DashboardElementReferenceOrLayoutItemReference{
				{LayoutItemReference: &dashv3alpha0.DashboardLayoutItemReference{Kind: "LayoutItemReference", Name: "Infra"}},
			},
			Conditions: dashv3alpha0.DashboardDashboardRuleConditionsSpec{
				Match: dashv3alpha0.DashboardDashboardRuleConditionsSpecMatchAnd,
				Items: []dashv3alpha0.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKindOrConditionalRenderingUserTeamKind{},
			},
			Outcomes: []dashv3alpha0.DashboardDashboardRuleOutcomeVisibilityKindOrDashboardRuleOutcomeCollapseKindOrDashboardRuleOutcomeRefreshIntervalKindOrDashboardRuleOutcomeOverrideQueryKind{
				{DashboardRuleOutcomeCollapseKind: &dashv3alpha0.DashboardDashboardRuleOutcomeCollapseKind{
					Kind: "DashboardRuleOutcomeCollapse",
					Spec: dashv3alpha0.DashboardDashboardRuleOutcomeCollapseSpec{Collapse: true},
				}},
			},
		},
	})
	out := &dashv2.Dashboard{}
	err := Convert_V3alpha0_to_V2(in, out, nil)
	require.NoError(t, err)
	// The Infra row should NOT have conditionalRendering attached because
	// collapse outcomes are not v2-compatible.
	require.NotNil(t, out.Spec.Layout.RowsLayoutKind)
	require.Len(t, out.Spec.Layout.RowsLayoutKind.Spec.Rows, 1)
	assert.Nil(t, out.Spec.Layout.RowsLayoutKind.Spec.Rows[0].Spec.ConditionalRendering)
}

// TestV3alpha0ToV2_UserTeamConditionDropped verifies that a rule whose
// conditions include a UserTeam entry is NOT reinstalled (UserTeam is not v2).
func TestV3alpha0ToV2_UserTeamConditionDropped(t *testing.T) {
	in := buildV3alpha0RuleDashboard(t, dashv3alpha0.DashboardDashboardRuleKind{
		Kind: "DashboardRule",
		Spec: dashv3alpha0.DashboardDashboardRuleSpec{
			Targets: []dashv3alpha0.DashboardElementReferenceOrLayoutItemReference{
				{LayoutItemReference: &dashv3alpha0.DashboardLayoutItemReference{Kind: "LayoutItemReference", Name: "Infra"}},
			},
			Conditions: dashv3alpha0.DashboardDashboardRuleConditionsSpec{
				Match: dashv3alpha0.DashboardDashboardRuleConditionsSpecMatchAnd,
				Items: []dashv3alpha0.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKindOrConditionalRenderingUserTeamKind{
					{ConditionalRenderingUserTeamKind: &dashv3alpha0.DashboardConditionalRenderingUserTeamKind{
						Kind: "ConditionalRenderingUserTeam",
						Spec: dashv3alpha0.DashboardConditionalRenderingUserTeamSpec{
							Operator: dashv3alpha0.DashboardConditionalRenderingUserTeamSpecOperatorIsMember,
							TeamUids: []string{"platform-sre"},
						},
					}},
				},
			},
			Outcomes: []dashv3alpha0.DashboardDashboardRuleOutcomeVisibilityKindOrDashboardRuleOutcomeCollapseKindOrDashboardRuleOutcomeRefreshIntervalKindOrDashboardRuleOutcomeOverrideQueryKind{
				{DashboardRuleOutcomeVisibilityKind: &dashv3alpha0.DashboardDashboardRuleOutcomeVisibilityKind{
					Kind: "DashboardRuleOutcomeVisibility",
					Spec: dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpec{
						Visibility: dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpecVisibilityHide,
					},
				}},
			},
		},
	})
	out := &dashv2.Dashboard{}
	err := Convert_V3alpha0_to_V2(in, out, nil)
	require.NoError(t, err)
	require.NotNil(t, out.Spec.Layout.RowsLayoutKind)
	assert.Nil(t, out.Spec.Layout.RowsLayoutKind.Spec.Rows[0].Spec.ConditionalRendering, "UserTeam-gated rules should drop on downgrade")
}

// TestV3alpha0ToV2_MultiTargetDropped verifies that multi-target rules are
// not reinstalled (v2 conditionalRendering is per-element).
func TestV3alpha0ToV2_MultiTargetDropped(t *testing.T) {
	in := buildV3alpha0RuleDashboard(t, dashv3alpha0.DashboardDashboardRuleKind{
		Kind: "DashboardRule",
		Spec: dashv3alpha0.DashboardDashboardRuleSpec{
			Targets: []dashv3alpha0.DashboardElementReferenceOrLayoutItemReference{
				{LayoutItemReference: &dashv3alpha0.DashboardLayoutItemReference{Kind: "LayoutItemReference", Name: "Infra"}},
				{LayoutItemReference: &dashv3alpha0.DashboardLayoutItemReference{Kind: "LayoutItemReference", Name: "Checkout"}},
			},
			Conditions: dashv3alpha0.DashboardDashboardRuleConditionsSpec{
				Match: dashv3alpha0.DashboardDashboardRuleConditionsSpecMatchAnd,
				Items: []dashv3alpha0.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKindOrConditionalRenderingUserTeamKind{},
			},
			Outcomes: []dashv3alpha0.DashboardDashboardRuleOutcomeVisibilityKindOrDashboardRuleOutcomeCollapseKindOrDashboardRuleOutcomeRefreshIntervalKindOrDashboardRuleOutcomeOverrideQueryKind{
				{DashboardRuleOutcomeVisibilityKind: &dashv3alpha0.DashboardDashboardRuleOutcomeVisibilityKind{
					Kind: "DashboardRuleOutcomeVisibility",
					Spec: dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpec{
						Visibility: dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpecVisibilityHide,
					},
				}},
			},
		},
	})
	out := &dashv2.Dashboard{}
	err := Convert_V3alpha0_to_V2(in, out, nil)
	require.NoError(t, err)
	require.NotNil(t, out.Spec.Layout.RowsLayoutKind)
	assert.Nil(t, out.Spec.Layout.RowsLayoutKind.Spec.Rows[0].Spec.ConditionalRendering, "multi-target rules should drop on downgrade")
}

// buildV3alpha0RuleDashboard creates a minimal v3alpha0 dashboard with a single
// row named "Infra" and the supplied rule.
func buildV3alpha0RuleDashboard(t *testing.T, rule dashv3alpha0.DashboardDashboardRuleKind) *dashv3alpha0.Dashboard {
	t.Helper()
	return &dashv3alpha0.Dashboard{
		Spec: dashv3alpha0.DashboardSpec{
			Title: "RuleCarrier",
			Layout: dashv3alpha0.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				RowsLayoutKind: &dashv3alpha0.DashboardRowsLayoutKind{
					Kind: "RowsLayout",
					Spec: dashv3alpha0.DashboardRowsLayoutSpec{
						Rows: []dashv3alpha0.DashboardRowsLayoutRowKind{
							{
								Kind: "RowsLayoutRow",
								Spec: dashv3alpha0.DashboardRowsLayoutRowSpec{
									Name:  ptr.To("Infra"),
									Title: ptr.To("Infra"),
									Layout: dashv3alpha0.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
										GridLayoutKind: &dashv3alpha0.DashboardGridLayoutKind{
											Kind: "GridLayout",
											Spec: dashv3alpha0.DashboardGridLayoutSpec{Items: []dashv3alpha0.DashboardGridLayoutItemKind{}},
										},
									},
								},
							},
						},
					},
				},
			},
			Rules: []dashv3alpha0.DashboardDashboardRuleKind{rule},
		},
	}
}
