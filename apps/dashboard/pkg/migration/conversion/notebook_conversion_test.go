package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

// notebookConversionScheme registers the dashboard conversions so the tests can exercise
// the real scheme.Convert path rather than calling individual conversion functions.
func notebookConversionScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)
	scheme := runtime.NewScheme()
	require.NoError(t, RegisterConversions(scheme, dsProvider, leProvider))
	return scheme
}

// TestV2ToV2beta1NotebookRoundTrip covers the JSON-marshal conversion path. Before the
// notebook kinds were added to v2beta1 this silently dropped the layout and cells (the
// v2beta1 discriminator had no matching case); now they must survive a full round-trip.
func TestV2ToV2beta1NotebookRoundTrip(t *testing.T) {
	scheme := notebookConversionScheme(t)
	collapsed := true
	annotation := "highlights the failing query"
	original := &dashv2.Dashboard{
		Spec: dashv2.DashboardSpec{
			Title: "Notebook",
			Elements: map[string]dashv2.DashboardElement{
				"cell-md": {CellKind: &dashv2.DashboardCellKind{
					Kind: "Cell",
					Spec: dashv2.DashboardCellSpec{Content: dashv2.DashboardCellContentKind{
						MarkdownCellContentKind: &dashv2.DashboardMarkdownCellContentKind{
							Kind: "Markdown",
							Spec: dashv2.DashboardMarkdownCellContentSpec{Text: "# Findings"},
						},
					}},
				}},
				"cell-code": {CellKind: &dashv2.DashboardCellKind{
					Kind: "Cell",
					Spec: dashv2.DashboardCellSpec{Content: dashv2.DashboardCellContentKind{
						CodeCellContentKind: &dashv2.DashboardCodeCellContentKind{
							Kind: "Code",
							Spec: dashv2.DashboardCodeCellContentSpec{
								Language:   "promql",
								Code:       "up",
								Highlight:  []int64{1},
								Annotation: &annotation,
							},
						},
					}},
				}},
			},
			Layout: dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrNotebookLayoutKind{
				NotebookLayoutKind: &dashv2.DashboardNotebookLayoutKind{
					Kind: "NotebookLayout",
					Spec: dashv2.DashboardNotebookLayoutSpec{Cells: []dashv2.DashboardNotebookLayoutItemKind{
						{Kind: "NotebookLayoutItem", Spec: dashv2.DashboardNotebookLayoutItemSpec{
							Element:   dashv2.DashboardElementReference{Kind: "ElementReference", Name: "cell-md"},
							Source:    dashv2.DashboardNotebookLayoutItemSpecSourceAssistant,
							Collapsed: &collapsed,
						}},
						{Kind: "NotebookLayoutItem", Spec: dashv2.DashboardNotebookLayoutItemSpec{
							Element: dashv2.DashboardElementReference{Kind: "ElementReference", Name: "cell-code"},
							Source:  dashv2.DashboardNotebookLayoutItemSpecSourceUser,
						}},
					}},
				},
			},
		},
	}

	var beta dashv2beta1.Dashboard
	require.NoError(t, scheme.Convert(original, &beta, nil))

	// The layout and both cell elements must survive the downconvert to v2beta1.
	require.NotNil(t, beta.Spec.Layout.NotebookLayoutKind)
	require.Len(t, beta.Spec.Layout.NotebookLayoutKind.Spec.Cells, 2)
	require.NotNil(t, beta.Spec.Elements["cell-md"].CellKind)
	md := beta.Spec.Elements["cell-md"].CellKind.Spec.Content.MarkdownCellContentKind
	require.NotNil(t, md)
	assert.Equal(t, "# Findings", md.Spec.Text)

	var back dashv2.Dashboard
	require.NoError(t, scheme.Convert(&beta, &back, nil))
	assert.Equal(t, original.Spec, back.Spec, "v2 spec must be unchanged after v2 -> v2beta1 -> v2 round-trip")
}

// TestV2alpha1ToV2beta1NotebookRoundTrip covers the field-by-field conversion path. That
// path only preserves what the conversion code explicitly copies, so it exercises the
// Cell-element and NotebookLayout passthrough added to convertElement/convertLayout.
func TestV2alpha1ToV2beta1NotebookRoundTrip(t *testing.T) {
	scheme := notebookConversionScheme(t)
	collapsed := true
	original := &dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Title: "Notebook",
			Elements: map[string]dashv2alpha1.DashboardElement{
				"cell-code": {CellKind: &dashv2alpha1.DashboardCellKind{
					Kind: "Cell",
					Spec: dashv2alpha1.DashboardCellSpec{Content: dashv2alpha1.DashboardCellContentKind{
						CodeCellContentKind: &dashv2alpha1.DashboardCodeCellContentKind{
							Kind: "Code",
							Spec: dashv2alpha1.DashboardCodeCellContentSpec{Language: "promql", Code: "up"},
						},
					}},
				}},
			},
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrNotebookLayoutKind{
				NotebookLayoutKind: &dashv2alpha1.DashboardNotebookLayoutKind{
					Kind: "NotebookLayout",
					Spec: dashv2alpha1.DashboardNotebookLayoutSpec{Cells: []dashv2alpha1.DashboardNotebookLayoutItemKind{
						{Kind: "NotebookLayoutItem", Spec: dashv2alpha1.DashboardNotebookLayoutItemSpec{
							Element:   dashv2alpha1.DashboardElementReference{Kind: "ElementReference", Name: "cell-code"},
							Source:    dashv2alpha1.DashboardNotebookLayoutItemSpecSourceAssistant,
							Collapsed: &collapsed,
						}},
					}},
				},
			},
		},
	}

	var beta dashv2beta1.Dashboard
	require.NoError(t, scheme.Convert(original, &beta, nil))

	require.NotNil(t, beta.Spec.Layout.NotebookLayoutKind)
	require.NotNil(t, beta.Spec.Elements["cell-code"].CellKind)
	code := beta.Spec.Elements["cell-code"].CellKind.Spec.Content.CodeCellContentKind
	require.NotNil(t, code)
	assert.Equal(t, "up", code.Spec.Code)

	var back dashv2alpha1.Dashboard
	require.NoError(t, scheme.Convert(&beta, &back, nil))
	// The notebook layout and cell elements must be byte-identical after the field-by-field
	// round-trip; other spec defaulting is out of scope for this assertion.
	assert.Equal(t, original.Spec.Layout, back.Spec.Layout, "notebook layout must survive v2alpha1 -> v2beta1 -> v2alpha1")
	assert.Equal(t, original.Spec.Elements, back.Spec.Elements, "cell elements must survive v2alpha1 -> v2beta1 -> v2alpha1")
}
