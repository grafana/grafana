package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"sort"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

// maxExampleDepth caps recursion when synthesizing example payloads to keep
// output manageable for very nested schemas (e.g. Dashboard).
const maxExampleDepth = 4

// apidocs serves agent-friendly markdown views of the classic /api/* OpenAPI
// surface (sourced from public/openapi3.json). The /apis/* (App Platform)
// surface is a follow-up.

type operationEntry struct {
	OperationID string
	Method      string
	Path        string
	Summary     string
	Description string
	Tags        []string
	Operation   *openapi3.Operation
}

// apiDocsState holds the parsed spec plus the derived lookup structures the
// handlers need. Built once at route registration and captured by the
// per-handler closures, so there's no shared mutable state at request time.
type apiDocsState struct {
	spec    *openapi3.T
	ops     map[string]*operationEntry
	ordered []*operationEntry
}

// registerAPIDocs loads the spec once at startup and, if it's available, wires
// up the agent-friendly markdown endpoints. Public posture mirrors /swagger.
// A missing spec is logged but non-fatal — the routes simply won't be served
func (hs *HTTPServer) registerAPIDocs(r routing.RouteRegister) {
	specPath := filepath.Join(hs.Cfg.StaticRootPath, "openapi3.json")
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromFile(specPath)
	if err != nil {
		hs.log.Warn("api-docs: openapi3 spec not available, skipping registration",
			"path", specPath, "error", err)
		return
	}
	state := buildAPIDocsState(doc)

	r.Get("/llms.txt", routing.Wrap(state.llmsTxtHandler))
	r.Get("/llms-full.txt", routing.Wrap(state.llmsFullTxtHandler))
	r.Get("/api-docs/index.json", routing.Wrap(state.manifestHandler))
	r.Get("/api-docs/operations/:operationId", routing.Wrap(state.operationHandler))
}

func (s *apiDocsState) llmsTxtHandler(_ *contextmodel.ReqContext) response.Response {
	return markdownResponse(http.StatusOK, renderLLMsTxt(s))
}

func (s *apiDocsState) llmsFullTxtHandler(_ *contextmodel.ReqContext) response.Response {
	return markdownResponse(http.StatusOK, renderLLMsFullTxt(s))
}

func renderLLMsTxt(s *apiDocsState) string {
	var b strings.Builder
	title := "Grafana HTTP API"
	if s.spec.Info != nil && s.spec.Info.Title != "" {
		title = s.spec.Info.Title
	}
	fmt.Fprintf(&b, "# %s\n\n", title)
	if s.spec.Info != nil && s.spec.Info.Description != "" {
		fmt.Fprintf(&b, "> %s\n\n", oneLine(s.spec.Info.Description))
	} else {
		b.WriteString("> Grafana's HTTP API. Per-operation docs for AI/agent consumption.\n\n")
	}

	b.WriteString("## Discovery\n\n")
	b.WriteString("- [Operations manifest (JSON)](/api-docs/index.json)\n")
	b.WriteString("- [Full markdown bundle](/llms-full.txt)\n")
	b.WriteString("- [Swagger UI](/swagger)\n\n")

	byTag := map[string][]*operationEntry{}
	for _, e := range s.ordered {
		if len(e.Tags) == 0 {
			byTag["(untagged)"] = append(byTag["(untagged)"], e)
			continue
		}
		for _, t := range e.Tags {
			byTag[t] = append(byTag[t], e)
		}
	}
	tags := make([]string, 0, len(byTag))
	for t := range byTag {
		tags = append(tags, t)
	}
	sort.Strings(tags)

	for _, t := range tags {
		fmt.Fprintf(&b, "## %s\n\n", t)
		for _, e := range byTag[t] {
			summary := e.Summary
			if summary == "" {
				summary = oneLine(e.Description)
			}
			fmt.Fprintf(&b, "- [%s %s](/api-docs/operations/%s): %s\n",
				e.Method, e.Path, e.OperationID, summary)
		}
		b.WriteString("\n")
	}
	return b.String()
}

func renderLLMsFullTxt(s *apiDocsState) string {
	var b strings.Builder
	title := "Grafana HTTP API"
	if s.spec.Info != nil && s.spec.Info.Title != "" {
		title = s.spec.Info.Title
	}
	fmt.Fprintf(&b, "# %s — Full Operation Reference\n\n", title)
	for _, e := range s.ordered {
		b.WriteString(renderOperationMarkdown(e))
		b.WriteString("\n---\n\n")
	}
	return b.String()
}

type apiDocsManifestEntry struct {
	OperationID string   `json:"operationId"`
	Method      string   `json:"method"`
	Path        string   `json:"path"`
	Summary     string   `json:"summary,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	MarkdownURL string   `json:"markdownUrl"`
}

type apiDocsManifest struct {
	Title      string                 `json:"title"`
	Version    string                 `json:"version,omitempty"`
	Operations []apiDocsManifestEntry `json:"operations"`
}

func (s *apiDocsState) manifestHandler(_ *contextmodel.ReqContext) response.Response {
	m := apiDocsManifest{
		Operations: make([]apiDocsManifestEntry, 0, len(s.ordered)),
	}
	if s.spec.Info != nil {
		m.Title = s.spec.Info.Title
		m.Version = s.spec.Info.Version
	}
	for _, e := range s.ordered {
		m.Operations = append(m.Operations, apiDocsManifestEntry{
			OperationID: e.OperationID,
			Method:      e.Method,
			Path:        e.Path,
			Summary:     e.Summary,
			Tags:        e.Tags,
			MarkdownURL: "/api-docs/operations/" + e.OperationID,
		})
	}
	return response.JSON(http.StatusOK, m)
}

func (s *apiDocsState) operationHandler(c *contextmodel.ReqContext) response.Response {
	opID := strings.TrimSuffix(web.Params(c.Req)[":operationId"], ".md")
	entry, ok := s.ops[opID]
	if !ok {
		return response.Error(http.StatusNotFound, "unknown operationId: "+opID, nil)
	}
	return markdownResponse(http.StatusOK, renderOperationMarkdown(entry))
}

func markdownResponse(status int, body string) response.Response {
	h := http.Header{}
	h.Set("Content-Type", "text/markdown; charset=utf-8")
	h.Set("Cache-Control", "public, max-age=300")
	return response.CreateNormalResponse(h, []byte(body), status)
}

func buildAPIDocsState(doc *openapi3.T) *apiDocsState {
	s := &apiDocsState{spec: doc, ops: map[string]*operationEntry{}}
	if doc.Paths == nil {
		return s
	}

	paths := doc.Paths.Map()
	pathKeys := make([]string, 0, len(paths))
	for k := range paths {
		pathKeys = append(pathKeys, k)
	}
	sort.Strings(pathKeys)

	for _, p := range pathKeys {
		item := paths[p]
		if item == nil {
			continue
		}
		for method, op := range item.Operations() {
			if op == nil {
				continue
			}
			id := op.OperationID
			if id == "" {
				id = synthesizeOperationID(method, p)
			}
			entry := &operationEntry{
				OperationID: id,
				Method:      strings.ToUpper(method),
				Path:        p,
				Summary:     op.Summary,
				Description: op.Description,
				Tags:        op.Tags,
				Operation:   op,
			}
			s.ops[id] = entry
			s.ordered = append(s.ordered, entry)
		}
	}

	sort.SliceStable(s.ordered, func(i, j int) bool {
		if s.ordered[i].Path == s.ordered[j].Path {
			return s.ordered[i].Method < s.ordered[j].Method
		}
		return s.ordered[i].Path < s.ordered[j].Path
	})

	return s
}

// synthesizeOperationID produces a stable identifier when the spec omits one.
func synthesizeOperationID(method, path string) string {
	s := strings.ToLower(method) + "_" + path
	out := make([]rune, 0, len(s))
	prevUnderscore := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			out = append(out, r)
			prevUnderscore = false
		default:
			if !prevUnderscore {
				out = append(out, '_')
				prevUnderscore = true
			}
		}
	}
	return strings.Trim(string(out), "_")
}

func renderOperationMarkdown(e *operationEntry) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# %s %s\n\n", e.Method, e.Path)
	if e.Summary != "" {
		fmt.Fprintf(&b, "%s\n\n", e.Summary)
	}
	if e.Description != "" {
		fmt.Fprintf(&b, "%s\n\n", strings.TrimSpace(e.Description))
	}
	fmt.Fprintf(&b, "- Operation ID: `%s`\n", e.OperationID)
	if len(e.Tags) > 0 {
		fmt.Fprintf(&b, "- Tags: %s\n", strings.Join(e.Tags, ", "))
	}
	if e.Operation.Deprecated {
		b.WriteString("- Deprecated: yes\n")
	}
	b.WriteString("\n")

	if len(e.Operation.Parameters) > 0 {
		b.WriteString("## Parameters\n\n")
		for _, pref := range e.Operation.Parameters {
			if pref == nil || pref.Value == nil {
				continue
			}
			p := pref.Value
			req := ""
			if p.Required {
				req = ", required"
			}
			fmt.Fprintf(&b, "- `%s` (%s, %s%s): %s\n",
				p.Name, p.In, paramTypeOf(p), req, oneLine(p.Description))
		}
		b.WriteString("\n")
	}

	if e.Operation.RequestBody != nil && e.Operation.RequestBody.Value != nil {
		rb := e.Operation.RequestBody.Value
		b.WriteString("## Request Body\n\n")
		if rb.Required {
			b.WriteString("Required.\n\n")
		}
		if rb.Description != "" {
			fmt.Fprintf(&b, "%s\n\n", oneLine(rb.Description))
		}
		mediaTypes := make([]string, 0, len(rb.Content))
		for mt := range rb.Content {
			mediaTypes = append(mediaTypes, mt)
		}
		sort.Strings(mediaTypes)
		for _, mt := range mediaTypes {
			media := rb.Content[mt]
			fmt.Fprintf(&b, "- Content-Type: `%s`", mt)
			if media != nil && media.Schema != nil {
				if ref := refName(media.Schema.Ref); ref != "" {
					fmt.Fprintf(&b, " — schema: `%s`", ref)
				} else if media.Schema.Value != nil {
					fmt.Fprintf(&b, " — type: `%s`", schemaType(media.Schema.Value))
				}
			}
			b.WriteString("\n")
			if media != nil {
				if ex := exampleJSON(media.Schema); ex != "" {
					fmt.Fprintf(&b, "\n  Example:\n\n  ```json\n%s\n  ```\n", indentBlock(ex, "  "))
				}
			}
		}
		b.WriteString("\n")
	}

	if e.Operation.Responses != nil {
		resps := e.Operation.Responses.Map()
		if len(resps) > 0 {
			b.WriteString("## Responses\n\n")
			codes := make([]string, 0, len(resps))
			for c := range resps {
				codes = append(codes, c)
			}
			sort.Strings(codes)
			for _, code := range codes {
				rref := resps[code]
				if rref == nil || rref.Value == nil {
					continue
				}
				r := rref.Value
				desc := ""
				if r.Description != nil {
					desc = oneLine(*r.Description)
				}
				fmt.Fprintf(&b, "- `%s`: %s", code, desc)
				mediaTypes := make([]string, 0, len(r.Content))
				for mt := range r.Content {
					mediaTypes = append(mediaTypes, mt)
				}
				sort.Strings(mediaTypes)
				for _, mt := range mediaTypes {
					media := r.Content[mt]
					if media != nil && media.Schema != nil {
						if ref := refName(media.Schema.Ref); ref != "" {
							fmt.Fprintf(&b, " (`%s` → `%s`)", mt, ref)
						} else if media.Schema.Value != nil {
							fmt.Fprintf(&b, " (`%s` → `%s`)", mt, schemaType(media.Schema.Value))
						}
					}
				}
				b.WriteString("\n")
				for _, mt := range mediaTypes {
					media := r.Content[mt]
					if media == nil {
						continue
					}
					if ex := exampleJSON(media.Schema); ex != "" {
						fmt.Fprintf(&b, "\n  Example (`%s`):\n\n  ```json\n%s\n  ```\n", mt, indentBlock(ex, "  "))
					}
				}
			}
			b.WriteString("\n")
		}
	}

	if e.Operation.Security != nil && len(*e.Operation.Security) > 0 {
		b.WriteString("## Security\n\n")
		for _, sec := range *e.Operation.Security {
			for name := range sec {
				fmt.Fprintf(&b, "- %s\n", name)
			}
		}
		b.WriteString("\n")
	}

	return b.String()
}

func paramTypeOf(p *openapi3.Parameter) string {
	if p.Schema == nil {
		return "any"
	}
	if ref := refName(p.Schema.Ref); ref != "" {
		return ref
	}
	if p.Schema.Value == nil {
		return "any"
	}
	return schemaType(p.Schema.Value)
}

func schemaType(s *openapi3.Schema) string {
	if s == nil || s.Type == nil {
		return "any"
	}
	ts := s.Type.Slice()
	if len(ts) == 0 {
		return "any"
	}
	return strings.Join(ts, "|")
}

func refName(ref string) string {
	if ref == "" {
		return ""
	}
	idx := strings.LastIndex(ref, "/")
	if idx < 0 {
		return ref
	}
	return ref[idx+1:]
}

func oneLine(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "\r", " ")
	for strings.Contains(s, "  ") {
		s = strings.ReplaceAll(s, "  ", " ")
	}
	return s
}

// indentBlock prefixes every line of s with prefix. Used to align JSON
// examples inside a Markdown list item so they render correctly.
func indentBlock(s, prefix string) string {
	if s == "" {
		return s
	}
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = prefix + l
	}
	return strings.Join(lines, "\n")
}

// exampleJSON synthesizes a representative JSON payload for the given schema
// and returns it pretty-printed. Returns an empty string when no useful value
// can be produced (e.g. nil schema or unresolved $ref).
func exampleJSON(sref *openapi3.SchemaRef) string {
	v := exampleValueForSchema(sref, map[string]bool{}, 0)
	if v == nil {
		return ""
	}
	buf, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return ""
	}
	return string(buf)
}

// exampleValueForSchema walks a resolved schema and builds a Go value that
// JSON-marshals to a plausible example payload. It honors any explicit
// `example` field on the schema, picks Enum[0] or Default where available,
// and falls back to format-aware placeholders. Depth-limited via
// maxExampleDepth, cycle-safe via the visited ref-name set.
func exampleValueForSchema(sref *openapi3.SchemaRef, visited map[string]bool, depth int) any {
	if sref == nil || depth > maxExampleDepth || sref.Value == nil {
		return nil
	}
	s := sref.Value

	if s.Example != nil {
		return s.Example
	}

	refKey := refName(sref.Ref)
	if refKey != "" {
		if visited[refKey] {
			return map[string]any{"$ref": refKey}
		}
		visited[refKey] = true
		defer delete(visited, refKey)
	}

	// allOf: merge object properties from all members plus our own.
	if len(s.AllOf) > 0 {
		merged := map[string]any{}
		for _, m := range s.AllOf {
			if v, ok := exampleValueForSchema(m, visited, depth+1).(map[string]any); ok {
				for k, val := range v {
					merged[k] = val
				}
			}
		}
		for name, prop := range s.Properties {
			merged[name] = exampleValueForSchema(prop, visited, depth+1)
		}
		if len(merged) > 0 {
			return merged
		}
	}

	if len(s.OneOf) > 0 {
		return exampleValueForSchema(s.OneOf[0], visited, depth+1)
	}
	if len(s.AnyOf) > 0 {
		return exampleValueForSchema(s.AnyOf[0], visited, depth+1)
	}

	primary := ""
	if s.Type != nil {
		if ts := s.Type.Slice(); len(ts) > 0 {
			primary = ts[0]
		}
	}
	if primary == "" && len(s.Properties) > 0 {
		primary = "object"
	}

	switch primary {
	case "object":
		out := map[string]any{}
		for name, prop := range s.Properties {
			out[name] = exampleValueForSchema(prop, visited, depth+1)
		}
		return out
	case "array":
		return []any{exampleValueForSchema(s.Items, visited, depth+1)}
	case "string":
		if s.Default != nil {
			return s.Default
		}
		if len(s.Enum) > 0 {
			return s.Enum[0]
		}
		return stringFormatExample(s.Format)
	case "integer":
		if s.Default != nil {
			return s.Default
		}
		return 0
	case "number":
		if s.Default != nil {
			return s.Default
		}
		return 0.0
	case "boolean":
		if s.Default != nil {
			return s.Default
		}
		return false
	case "null":
		return nil
	}
	return nil
}

func stringFormatExample(format string) string {
	switch format {
	case "date-time":
		return "2025-01-01T00:00:00Z"
	case "date":
		return "2025-01-01"
	case "uuid":
		return "00000000-0000-0000-0000-000000000000"
	case "uri", "url":
		return "https://example.com"
	case "email":
		return "user@example.com"
	case "byte":
		return "Zm9v"
	}
	return "string"
}
