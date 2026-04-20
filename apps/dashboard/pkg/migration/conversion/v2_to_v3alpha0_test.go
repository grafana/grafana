package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/ptr"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv3alpha0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v3alpha0"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

func newV3alpha0ConversionScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)
	scheme := runtime.NewScheme()
	require.NoError(t, RegisterConversions(scheme, dsProvider, leProvider))
	return scheme
}

// TestV2ToV3alpha0_EmptyDashboard ensures the JSON round-trip path works for a
// dashboard without any conditionalRendering blocks and produces rules: [].
func TestV2ToV3alpha0_EmptyDashboard(t *testing.T) {
	in := &dashv2.Dashboard{
		Spec: dashv2.DashboardSpec{
			Title: "Empty",
			Layout: dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2.DashboardGridLayoutSpec{Items: []dashv2.DashboardGridLayoutItemKind{}},
				},
			},
		},
	}
	out := &dashv3alpha0.Dashboard{}
	err := Convert_V2_to_V3alpha0(in, out, nil)
	require.NoError(t, err)
	assert.Equal(t, "Empty", out.Spec.Title)
	assert.Empty(t, out.Spec.Rules)
}

// TestV2ToV3alpha0_AutoGridVisibilityPromoted verifies that an element-level
// conditionalRendering block on an AutoGridLayoutItem becomes a DashboardRule
// with a visibility outcome targeting that element.
func TestV2ToV3alpha0_AutoGridVisibilityPromoted(t *testing.T) {
	in := &dashv2.Dashboard{
		Spec: dashv2.DashboardSpec{
			Title: "Promote",
			Layout: dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				AutoGridLayoutKind: &dashv2.DashboardAutoGridLayoutKind{
					Kind: "AutoGridLayout",
					Spec: dashv2.DashboardAutoGridLayoutSpec{
						Items: []dashv2.DashboardAutoGridLayoutItemKind{
							{
								Kind: "AutoGridLayoutItem",
								Spec: dashv2.DashboardAutoGridLayoutItemSpec{
									Element: dashv2.DashboardElementReference{Kind: "ElementReference", Name: "panel-1"},
									ConditionalRendering: &dashv2.DashboardConditionalRenderingGroupKind{
										Kind: "ConditionalRenderingGroup",
										Spec: dashv2.DashboardConditionalRenderingGroupSpec{
											Visibility: dashv2.DashboardConditionalRenderingGroupSpecVisibilityShow,
											Condition:  dashv2.DashboardConditionalRenderingGroupSpecConditionAnd,
											Items: []dashv2.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind{
												{
													ConditionalRenderingTimeRangeSizeKind: &dashv2.DashboardConditionalRenderingTimeRangeSizeKind{
														Kind: "ConditionalRenderingTimeRangeSize",
														Spec: dashv2.DashboardConditionalRenderingTimeRangeSizeSpec{Value: "1h"},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
	out := &dashv3alpha0.Dashboard{}
	err := Convert_V2_to_V3alpha0(in, out, nil)
	require.NoError(t, err)

	require.Len(t, out.Spec.Rules, 1, "expected one promoted rule")
	rule := out.Spec.Rules[0]
	assert.Equal(t, "DashboardRule", rule.Kind)
	require.Len(t, rule.Spec.Targets, 1)
	require.NotNil(t, rule.Spec.Targets[0].ElementReference, "target should be element reference")
	assert.Equal(t, "panel-1", rule.Spec.Targets[0].ElementReference.Name)

	require.Len(t, rule.Spec.Outcomes, 1)
	require.NotNil(t, rule.Spec.Outcomes[0].DashboardRuleOutcomeVisibilityKind)
	assert.Equal(t, dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpecVisibilityShow, rule.Spec.Outcomes[0].DashboardRuleOutcomeVisibilityKind.Spec.Visibility)

	require.Len(t, rule.Spec.Conditions.Items, 1)
	require.NotNil(t, rule.Spec.Conditions.Items[0].ConditionalRenderingTimeRangeSizeKind)
	assert.Equal(t, "1h", rule.Spec.Conditions.Items[0].ConditionalRenderingTimeRangeSizeKind.Spec.Value)

	// The legacy conditionalRendering block must be cleared on the v3alpha0 output
	// so the visibility predicate isn't double-represented (once as a rule, once
	// inline on the layout item).
	require.NotNil(t, out.Spec.Layout.AutoGridLayoutKind)
	require.Len(t, out.Spec.Layout.AutoGridLayoutKind.Spec.Items, 1)
	assert.Nil(t, out.Spec.Layout.AutoGridLayoutKind.Spec.Items[0].Spec.ConditionalRendering,
		"conditionalRendering must be cleared on the v3alpha0 output after promotion to a rule")
}

// TestV2ToV3alpha0_RowVisibilityPromotedAsLayoutItem verifies that a
// row-level conditionalRendering block becomes a DashboardRule whose target
// is a LayoutItemReference (not an ElementReference).
func TestV2ToV3alpha0_RowVisibilityPromotedAsLayoutItem(t *testing.T) {
	in := &dashv2.Dashboard{
		Spec: dashv2.DashboardSpec{
			Title: "RowHide",
			Layout: dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				RowsLayoutKind: &dashv2.DashboardRowsLayoutKind{
					Kind: "RowsLayout",
					Spec: dashv2.DashboardRowsLayoutSpec{
						Rows: []dashv2.DashboardRowsLayoutRowKind{
							{
								Kind: "RowsLayoutRow",
								Spec: dashv2.DashboardRowsLayoutRowSpec{
									Title: ptr.To("SRE"),
									ConditionalRendering: &dashv2.DashboardConditionalRenderingGroupKind{
										Kind: "ConditionalRenderingGroup",
										Spec: dashv2.DashboardConditionalRenderingGroupSpec{
											Visibility: dashv2.DashboardConditionalRenderingGroupSpecVisibilityHide,
											Condition:  dashv2.DashboardConditionalRenderingGroupSpecConditionAnd,
											Items:      []dashv2.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind{},
										},
									},
									Layout: dashv2.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
										GridLayoutKind: &dashv2.DashboardGridLayoutKind{
											Kind: "GridLayout",
											Spec: dashv2.DashboardGridLayoutSpec{Items: []dashv2.DashboardGridLayoutItemKind{}},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
	out := &dashv3alpha0.Dashboard{}
	err := Convert_V2_to_V3alpha0(in, out, nil)
	require.NoError(t, err)
	require.Len(t, out.Spec.Rules, 1)

	rule := out.Spec.Rules[0]
	require.Len(t, rule.Spec.Targets, 1)
	require.Nil(t, rule.Spec.Targets[0].ElementReference)
	require.NotNil(t, rule.Spec.Targets[0].LayoutItemReference)
	assert.Equal(t, "SRE", rule.Spec.Targets[0].LayoutItemReference.Name)
	assert.Equal(t, dashv3alpha0.DashboardDashboardRuleOutcomeVisibilitySpecVisibilityHide, rule.Spec.Outcomes[0].DashboardRuleOutcomeVisibilityKind.Spec.Visibility)

	// Row-level conditionalRendering must be cleared on the v3alpha0 output.
	require.NotNil(t, out.Spec.Layout.RowsLayoutKind)
	require.Len(t, out.Spec.Layout.RowsLayoutKind.Spec.Rows, 1)
	assert.Nil(t, out.Spec.Layout.RowsLayoutKind.Spec.Rows[0].Spec.ConditionalRendering,
		"row-level conditionalRendering must be cleared on the v3alpha0 output after promotion")
}

// TestV2ToV3alpha0_ViaScheme exercises the conversion via the runtime scheme
// registration, ensuring apiVersion and Kind are populated by the normalizer.
func TestV2ToV3alpha0_ViaScheme(t *testing.T) {
	scheme := newV3alpha0ConversionScheme(t)

	in := &dashv2.Dashboard{
		Spec: dashv2.DashboardSpec{
			Title: "ViaScheme",
			Layout: dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2.DashboardGridLayoutSpec{Items: []dashv2.DashboardGridLayoutItemKind{}},
				},
			},
		},
	}
	out := &dashv3alpha0.Dashboard{}
	require.NoError(t, scheme.Convert(in, out, nil))
	assert.Equal(t, dashv3alpha0.APIVERSION, out.APIVersion)
	assert.Equal(t, "ViaScheme", out.Spec.Title)
}
