package builders

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"unicode/utf8"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// NOTEBOOK_CONTENT is the name of the content field declared for notebooks in
// apps/dashboard/kinds/notebook.cue.
const NOTEBOOK_CONTENT = "content"

// maxNotebookContentBytes caps the Markdown text indexed per notebook, so one
// very long notebook cannot bloat the index.
const maxNotebookContentBytes = 64 * 1024

func GetNotebookSearchBuilder(registry *resource.SearchFieldsRegistry) (resource.DocumentBuilderInfo, error) {
	return resource.DocumentBuilderInfo{
		GroupResource: dashv2beta1.NotebookResourceInfo.GroupResource(),
		Builder:       &notebookSearchBuilder{declared: resource.StandardDocumentBuilder(registry)},
	}, nil
}

var _ resource.DocumentBuilder = (*notebookSearchBuilder)(nil)

// notebookSearchBuilder builds a Notebook search document. It delegates the
// standard fields to the standard document builder, then adds the text of the
// Markdown cells, which sit in a keyed elements map that the path extractor
// cannot traverse.
type notebookSearchBuilder struct {
	declared resource.DocumentBuilder
}

// notebookContentSource holds the parts of a notebook the content is read from.
//
// Elements and the layout stay raw and are decoded into the generated notebook types
// separately, so that renaming a field the content depends on breaks the build rather than
// quietly emptying the index, and so that a problem with one cell, or with the layout, costs
// only that cell or only the ordering. The elements are not decoded as a whole because most of
// their weight is panels, which are not indexed.
type notebookContentSource struct {
	Spec struct {
		Elements map[string]json.RawMessage `json:"elements"`
		Layout   json.RawMessage            `json:"layout"`
	} `json:"spec"`
}

func (b *notebookSearchBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	doc, err := b.declared.BuildDocument(ctx, key, rv, value)
	if err != nil {
		return nil, err
	}

	// A build error leaves the notebook out of the index altogether, title included, so a
	// shape this does not understand costs the content and nothing else.
	notebook := &notebookContentSource{}
	if err := json.Unmarshal(value, notebook); err != nil {
		return doc, nil
	}

	if content := notebookMarkdownContent(notebook); content != "" {
		if doc.Fields == nil {
			doc.Fields = make(map[string]any)
		}
		doc.Fields[NOTEBOOK_CONTENT] = content
	}
	return doc, nil
}

// notebookMarkdownContent joins the text of the Markdown cells in layout order,
// then any that the layout does not reference in key order, so the result is
// stable across rebuilds. It is cut to maxNotebookContentBytes.
func notebookMarkdownContent(notebook *notebookContentSource) string {
	elements := notebook.Spec.Elements
	if len(elements) == 0 {
		return ""
	}

	ids := make([]string, 0, len(elements))
	seen := make(map[string]bool, len(elements))
	for _, id := range notebookLayoutOrder(notebook.Spec.Layout) {
		if _, ok := elements[id]; ok && !seen[id] {
			ids = append(ids, id)
			seen[id] = true
		}
	}
	rest := make([]string, 0, len(elements)-len(ids))
	for id := range elements {
		if !seen[id] {
			rest = append(rest, id)
		}
	}
	slices.Sort(rest)
	ids = append(ids, rest...)

	var texts []string
	for _, id := range ids {
		if text := strings.TrimSpace(notebookMarkdownText(elements[id])); text != "" {
			texts = append(texts, text)
		}
	}
	return truncateUTF8(strings.Join(texts, "\n"), maxNotebookContentBytes)
}

// notebookLayoutOrder lists the elements the layout references, in order. A layout that cannot
// be read gives no order, which leaves the cells in key order.
func notebookLayoutOrder(raw json.RawMessage) []string {
	if len(raw) == 0 {
		return nil
	}
	layout := dashv2beta1.NotebookNotebookLayoutKind{}
	if err := json.Unmarshal(raw, &layout); err != nil {
		return nil
	}
	ids := make([]string, 0, len(layout.Spec.Cells))
	for _, cell := range layout.Spec.Cells {
		ids = append(ids, cell.Spec.Element.Name)
	}
	return ids
}

// notebookMarkdownText returns the text of an element that is a Markdown cell, and nothing for
// a code cell, a panel, a library panel or an element that cannot be read.
func notebookMarkdownText(raw json.RawMessage) string {
	cell := dashv2beta1.NotebookCellKind{}
	if err := json.Unmarshal(raw, &cell); err != nil {
		return ""
	}
	markdown := cell.Spec.Content.MarkdownCellContentKind
	if markdown == nil {
		return ""
	}
	return markdown.Spec.Text
}

// truncateUTF8 cuts s to at most n bytes without splitting a rune.
func truncateUTF8(s string, n int) string {
	if len(s) <= n {
		return s
	}
	for n > 0 && !utf8.RuneStart(s[n]) {
		n--
	}
	return s[:n]
}
