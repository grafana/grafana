package v2

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDashboardElementUnmarshalDiscriminator verifies the generated Element-union
// UnmarshalJSON routes each `kind` to the matching union member. Cell is the newly
// added kind; Panel and LibraryPanel are asserted too so the union widening does
// not silently break routing for the pre-existing kinds.
func TestDashboardElementUnmarshalDiscriminator(t *testing.T) {
	tests := []struct {
		name  string
		input string
		check func(t *testing.T, el DashboardElement)
	}{
		{
			name:  "Panel",
			input: `{"kind":"Panel","spec":{"id":1,"title":"CPU"}}`,
			check: func(t *testing.T, el DashboardElement) {
				require.NotNil(t, el.PanelKind)
				assert.Nil(t, el.LibraryPanelKind)
				assert.Nil(t, el.CellKind)
				assert.Equal(t, "Panel", el.PanelKind.Kind)
			},
		},
		{
			name:  "LibraryPanel",
			input: `{"kind":"LibraryPanel","spec":{"id":2,"title":"Lib","libraryPanel":{"name":"n","uid":"u"}}}`,
			check: func(t *testing.T, el DashboardElement) {
				require.NotNil(t, el.LibraryPanelKind)
				assert.Nil(t, el.PanelKind)
				assert.Nil(t, el.CellKind)
				assert.Equal(t, "LibraryPanel", el.LibraryPanelKind.Kind)
			},
		},
		{
			name:  "Cell",
			input: `{"kind":"Cell","spec":{"content":{"kind":"Markdown","spec":{"text":"hi"}}}}`,
			check: func(t *testing.T, el DashboardElement) {
				require.NotNil(t, el.CellKind)
				assert.Nil(t, el.PanelKind)
				assert.Nil(t, el.LibraryPanelKind)
				assert.Equal(t, "Cell", el.CellKind.Kind)
				// The content union must route to the Markdown member on the round-trip.
				require.NotNil(t, el.CellKind.Spec.Content.MarkdownCellContentKind)
				assert.Nil(t, el.CellKind.Spec.Content.CodeCellContentKind)
				assert.Equal(t, "hi", el.CellKind.Spec.Content.MarkdownCellContentKind.Spec.Text)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var el DashboardElement
			require.NoError(t, json.Unmarshal([]byte(tt.input), &el))
			tt.check(t, el)
		})
	}
}

// TestDashboardLayoutUnmarshalDiscriminator verifies the generated layout-union
// UnmarshalJSON routes each `kind` to the matching member. NotebookLayout is the newly
// added kind; GridLayout is asserted to confirm the widening did not break the
// pre-existing kinds.
func TestDashboardLayoutUnmarshalDiscriminator(t *testing.T) {
	tests := []struct {
		name  string
		input string
		check func(t *testing.T, layout DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrNotebookLayoutKind)
	}{
		{
			name:  "GridLayout",
			input: `{"kind":"GridLayout","spec":{"items":[]}}`,
			check: func(t *testing.T, layout DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrNotebookLayoutKind) {
				require.NotNil(t, layout.GridLayoutKind)
				assert.Nil(t, layout.NotebookLayoutKind)
				assert.Equal(t, "GridLayout", layout.GridLayoutKind.Kind)
			},
		},
		{
			name:  "NotebookLayout",
			input: `{"kind":"NotebookLayout","spec":{"cells":[{"kind":"NotebookLayoutItem","spec":{"element":{"kind":"ElementReference","name":"cell-1"},"source":"assistant"}}]}}`,
			check: func(t *testing.T, layout DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrNotebookLayoutKind) {
				require.NotNil(t, layout.NotebookLayoutKind)
				assert.Nil(t, layout.GridLayoutKind)
				assert.Nil(t, layout.RowsLayoutKind)
				assert.Nil(t, layout.AutoGridLayoutKind)
				assert.Nil(t, layout.TabsLayoutKind)
				assert.Equal(t, "NotebookLayout", layout.NotebookLayoutKind.Kind)
				require.Len(t, layout.NotebookLayoutKind.Spec.Cells, 1)
				item := layout.NotebookLayoutKind.Spec.Cells[0]
				assert.Equal(t, DashboardNotebookLayoutItemSpecSourceAssistant, item.Spec.Source)
				assert.Equal(t, "cell-1", item.Spec.Element.Name)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var layout DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrNotebookLayoutKind
			require.NoError(t, json.Unmarshal([]byte(tt.input), &layout))
			tt.check(t, layout)
		})
	}
}

// TestNotebookLayoutRoundTrip marshals a constructed NotebookLayout and decodes it back
// through the layout union, proving Marshal and the discriminator UnmarshalJSON agree.
func TestNotebookLayoutRoundTrip(t *testing.T) {
	nb := NewDashboardNotebookLayoutKind()
	item := NewDashboardNotebookLayoutItemKind()
	item.Spec.Element.Name = "cell-1"
	item.Spec.Source = DashboardNotebookLayoutItemSpecSourceAssistant
	nb.Spec.Cells = append(nb.Spec.Cells, *item)

	raw, err := json.Marshal(nb)
	require.NoError(t, err)

	var layout DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrNotebookLayoutKind
	require.NoError(t, json.Unmarshal(raw, &layout))
	require.NotNil(t, layout.NotebookLayoutKind)
	assert.Equal(t, "NotebookLayout", layout.NotebookLayoutKind.Kind)
	require.Len(t, layout.NotebookLayoutKind.Spec.Cells, 1)
	assert.Equal(t, "cell-1", layout.NotebookLayoutKind.Spec.Cells[0].Spec.Element.Name)
}

// TestCellRoundTrip marshals a constructed Cell element and decodes it back through the
// Element union, proving Marshal and the discriminator UnmarshalJSON agree.
func TestCellRoundTrip(t *testing.T) {
	cell := NewDashboardCellKind()
	md := NewDashboardMarkdownCellContentKind()
	md.Spec.Text = "hi"
	cell.Spec.Content.MarkdownCellContentKind = md

	raw, err := json.Marshal(cell)
	require.NoError(t, err)

	var el DashboardElement
	require.NoError(t, json.Unmarshal(raw, &el))
	require.NotNil(t, el.CellKind)
	assert.Equal(t, "Cell", el.CellKind.Kind)
	require.NotNil(t, el.CellKind.Spec.Content.MarkdownCellContentKind)
	assert.Equal(t, "Markdown", el.CellKind.Spec.Content.MarkdownCellContentKind.Kind)
	assert.Equal(t, "hi", el.CellKind.Spec.Content.MarkdownCellContentKind.Spec.Text)
}
