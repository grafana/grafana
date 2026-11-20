package builders

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashboardapp "github.com/grafana/grafana/apps/dashboard/pkg/apis"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func notebookKey(name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "notebooks",
		Name:      name,
	}
}

// notebookTestRegistry seeds a registry with the dashboard app's declared fields so the
// builder extracts them as it does in production.
func notebookTestRegistry(t *testing.T) *resource.SearchFieldsRegistry {
	t.Helper()
	manifest := dashboardapp.LocalManifest().ManifestData
	sel, hashes, providers, err := resource.SearchFieldsForManifests(manifest)
	require.NoError(t, err)
	return resource.NewSearchFieldsRegistry(sel, hashes, providers)
}

func buildNotebookDoc(t *testing.T, value string) *resource.IndexableDocument {
	t.Helper()
	info, err := GetNotebookSearchBuilder(notebookTestRegistry(t))
	require.NoError(t, err)
	doc, err := info.Builder.BuildDocument(context.Background(), notebookKey("nb1"), 1, []byte(value))
	require.NoError(t, err)
	return doc
}

func markdownElement(text string) string {
	return `{"kind":"Cell","spec":{"content":{"kind":"Markdown","spec":{"text":` + quote(text) + `}}}}`
}

func quote(s string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`).Replace(s) + `"`
}

func layoutOf(ids ...string) string {
	cells := make([]string, 0, len(ids))
	for _, id := range ids {
		cells = append(cells, `{"kind":"NotebookLayoutItem","spec":{"element":{"kind":"ElementReference","name":"`+id+`"},"source":"user"}}`)
	}
	return `{"kind":"NotebookLayout","spec":{"cells":[` + strings.Join(cells, ",") + `]}}`
}

func notebookJSON(elements, layout string) string {
	return `{
		"apiVersion": "dashboard.grafana.app/v2beta1",
		"kind": "Notebook",
		"metadata": {"name": "nb1"},
		"spec": {"title": "Latency review", "elements": {` + elements + `}, "layout": ` + layout + `}
	}`
}

func TestNotebookBuilder_indexes_markdown_in_layout_order(t *testing.T) {
	doc := buildNotebookDoc(t, notebookJSON(
		`"a": `+markdownElement("first cell")+`, "b": `+markdownElement("second cell"),
		layoutOf("b", "a"),
	))

	assert.Equal(t, "Latency review", doc.Title)
	assert.Equal(t, "second cell\nfirst cell", doc.Fields[NOTEBOOK_CONTENT])
}

func TestNotebookBuilder_skips_code_cells_and_panels(t *testing.T) {
	code := `{"kind":"Cell","spec":{"content":{"kind":"Code","spec":{"language":"sql","code":"select secret"}}}}`
	panel := `{"kind":"Panel","spec":{"id":1,"title":"A panel title"}}`

	doc := buildNotebookDoc(t, notebookJSON(
		`"a": `+markdownElement("kept")+`, "b": `+code+`, "c": `+panel,
		layoutOf("a", "b", "c"),
	))

	assert.Equal(t, "kept", doc.Fields[NOTEBOOK_CONTENT])
}

func TestNotebookBuilder_orders_cells_missing_from_layout_by_key(t *testing.T) {
	doc := buildNotebookDoc(t, notebookJSON(
		`"z": `+markdownElement("last")+`, "a": `+markdownElement("middle")+`, "m": `+markdownElement("first"),
		layoutOf("m"),
	))

	assert.Equal(t, "first\nmiddle\nlast", doc.Fields[NOTEBOOK_CONTENT])
}

func TestNotebookBuilder_ignores_layout_references_to_missing_or_repeated_elements(t *testing.T) {
	doc := buildNotebookDoc(t, notebookJSON(
		`"a": `+markdownElement("once"),
		layoutOf("gone", "a", "a"),
	))

	assert.Equal(t, "once", doc.Fields[NOTEBOOK_CONTENT])
}

func TestNotebookBuilder_omits_content_without_markdown(t *testing.T) {
	empty := buildNotebookDoc(t, notebookJSON("", layoutOf()))
	assert.NotContains(t, empty.Fields, NOTEBOOK_CONTENT)

	blank := buildNotebookDoc(t, notebookJSON(`"a": `+markdownElement("  \n "), layoutOf("a")))
	assert.NotContains(t, blank.Fields, NOTEBOOK_CONTENT)
}

func TestNotebookBuilder_caps_content_without_splitting_a_rune(t *testing.T) {
	// Each "é" is two bytes, so the cap falls inside a rune when the byte limit is odd-aligned.
	text := strings.Repeat("é", maxNotebookContentBytes)
	doc := buildNotebookDoc(t, notebookJSON(`"a": `+markdownElement(text), layoutOf("a")))

	content, ok := doc.Fields[NOTEBOOK_CONTENT].(string)
	require.True(t, ok)
	assert.LessOrEqual(t, len(content), maxNotebookContentBytes)
	assert.Greater(t, len(content), maxNotebookContentBytes-4)
	assert.Equal(t, strings.Repeat("é", len(content)/2), content)
}

func TestNotebookBuilder_keeps_the_document_when_the_content_cannot_be_read(t *testing.T) {
	// Valid JSON, but the cell text is a number, which the content decode cannot take.
	badText := `{"kind":"Cell","spec":{"content":{"kind":"Markdown","spec":{"text":42}}}}`

	doc := buildNotebookDoc(t, notebookJSON(`"a": `+badText, layoutOf("a")))

	assert.Equal(t, "Latency review", doc.Title, "the notebook is still indexed by its title")
	assert.NotContains(t, doc.Fields, NOTEBOOK_CONTENT)
}

func TestNotebookBuilder_loses_only_the_unreadable_cell(t *testing.T) {
	badText := `{"kind":"Cell","spec":{"content":{"kind":"Markdown","spec":{"text":42}}}}`

	doc := buildNotebookDoc(t, notebookJSON(
		`"a": `+markdownElement("readable")+`, "b": `+badText,
		layoutOf("b", "a"),
	))

	assert.Equal(t, "readable", doc.Fields[NOTEBOOK_CONTENT])
}

func TestNotebookBuilder_falls_back_to_key_order_when_the_layout_cannot_be_read(t *testing.T) {
	doc := buildNotebookDoc(t, notebookJSON(
		`"b": `+markdownElement("second")+`, "a": `+markdownElement("first"),
		`{"kind":"NotebookLayout","spec":{"cells":"not a list"}}`,
	))

	assert.Equal(t, "first\nsecond", doc.Fields[NOTEBOOK_CONTENT])
}

func TestNotebookBuilder_rejects_malformed_json(t *testing.T) {
	info, err := GetNotebookSearchBuilder(notebookTestRegistry(t))
	require.NoError(t, err)
	_, err = info.Builder.BuildDocument(context.Background(), notebookKey("nb1"), 1, []byte(`{`))
	require.Error(t, err)
}
