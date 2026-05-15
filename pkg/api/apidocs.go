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
	// appURL is the externally reachable root of this Grafana instance
	// (e.g. "https://example.grafana.com"). Used to emit absolute URLs in
	// llms.txt / llms-full.txt so agents can resolve links without guessing
	// the hostname. May be empty in tests; relative paths are used as fallback.
	appURL string
}

// curatedOpGroup pairs an operation ID with the workflow group it belongs to
// in the curated llms.txt index.
type curatedOpGroup struct {
	id    string
	group string
}

// curatedOps is the ordered, curated set of operations shown in llms.txt.
// Groups are task-centric rather than OpenAPI-tag-centric.
// If an operation's Deprecated flag is set in the spec it is emitted under
// the ## Optional section instead of the main index.
var curatedOps = []curatedOpGroup{
	// Health & Discovery
	{"getHealth", "Health & Discovery"},
	// Data Sources
	{"getDataSources", "Data Sources"},
	{"addDataSource", "Data Sources"},
	{"getDataSourceByUID", "Data Sources"},
	{"updateDataSourceByUID", "Data Sources"},
	{"deleteDataSourceByUID", "Data Sources"},
	{"checkDatasourceHealthWithUID", "Data Sources"},
	// Query Execution
	{"queryMetricsWithExpressions", "Query Execution"},
	// Search
	{"search", "Search"},
	// Annotations
	{"getAnnotations", "Annotations"},
	{"postAnnotation", "Annotations"},
	{"updateAnnotation", "Annotations"},
	{"deleteAnnotationByID", "Annotations"},
	// Organization
	{"getCurrentOrg", "Organization"},
	{"getOrgUsersForCurrentOrg", "Organization"},
	{"addOrgUserToCurrentOrg", "Organization"},
	// Users
	{"getSignedInUser", "Users"},
	{"searchUsersWithPaging", "Users"},
	// Teams
	{"searchTeams", "Teams"},
	{"createTeam", "Teams"},
	{"getTeamMembers", "Teams"},
	{"addTeamMember", "Teams"},
	// Service Accounts
	{"searchOrgServiceAccountsWithPaging", "Service Accounts"},
	{"createServiceAccount", "Service Accounts"},
	// --- Deprecated: emitted under ## Optional ---
	{"getDashboardByUID", "Dashboard CRUD (legacy — use /apis/dashboard.grafana.app/)"},
	{"postDashboard", "Dashboard CRUD (legacy — use /apis/dashboard.grafana.app/)"},
	{"deleteDashboardByUID", "Dashboard CRUD (legacy — use /apis/dashboard.grafana.app/)"},
	{"getFolders", "Folder CRUD (legacy — use /apis/folder.grafana.app/)"},
	{"createFolder", "Folder CRUD (legacy — use /apis/folder.grafana.app/)"},
	{"getFolderByUID", "Folder CRUD (legacy — use /apis/folder.grafana.app/)"},
	{"searchPlaylists", "Playlists (legacy — use /apis/playlist.grafana.app/)"},
	{"createPlaylist", "Playlists (legacy — use /apis/playlist.grafana.app/)"},
	{"RouteGetAlertRules", "Alerting Provisioning (legacy)"},
	{"RoutePostAlertRule", "Alerting Provisioning (legacy)"},
	{"RouteGetAlertRuleGroup", "Alerting Provisioning (legacy)"},
	{"RoutePutAlertRuleGroup", "Alerting Provisioning (legacy)"},
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
	state.appURL = strings.TrimRight(hs.Cfg.AppURL, "/")

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

	// Required by the llms.txt spec: a blockquote immediately after the H1
	// that gives agents the base URL, authentication guidance, and a link to
	// human-readable docs.
	opBase := s.appURL // may be "" in tests — relative URLs are used as fallback
	baseAPI := opBase + "/api/"
	fmt.Fprintf(&b, "> The Grafana HTTP API is served at `%s`.\n", baseAPI)
	b.WriteString("> Authenticate with `Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>` or basic auth (`-u admin:password`).\n")
	b.WriteString("> Full reference: <https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/>\n\n")

	b.WriteString("## Discovery\n\n")
	fmt.Fprintf(&b, "- [Operations manifest (JSON)](%s/api-docs/index.json) - JSON index of all operations\n", opBase)
	fmt.Fprintf(&b, "- [Complete operations index](%s/llms-full.txt) - Index of all %d operations\n", opBase, len(s.ordered))
	fmt.Fprintf(&b, "- [Swagger UI](%s/swagger) - Human-friendly Swagger UI for the API\n\n", opBase)

	// Curated operations grouped by workflow task. Each entry is looked up in
	// the live spec so missing/renamed IDs are silently skipped.
	mainGroups := map[string][]string{} // group label -> list of markdown lines
	mainGroupOrder := []string{}
	optGroups := map[string][]string{}
	optGroupOrder := []string{}

	for _, c := range curatedOps {
		e, ok := s.ops[c.id]
		if !ok {
			continue
		}
		summary := e.Summary
		if summary == "" {
			summary = oneLine(e.Description)
		}
		url := opBase + "/api-docs/operations/" + e.OperationID
		line := fmt.Sprintf("- [%s %s](%s): %s\n", e.Method, e.Path, url, summary)

		if e.Operation.Deprecated {
			if _, exists := optGroups[c.group]; !exists {
				optGroupOrder = append(optGroupOrder, c.group)
			}
			optGroups[c.group] = append(optGroups[c.group], line)
		} else {
			if _, exists := mainGroups[c.group]; !exists {
				mainGroupOrder = append(mainGroupOrder, c.group)
			}
			mainGroups[c.group] = append(mainGroups[c.group], line)
		}
	}

	for _, g := range mainGroupOrder {
		fmt.Fprintf(&b, "## %s\n\n", g)
		for _, line := range mainGroups[g] {
			b.WriteString(line)
		}
		b.WriteString("\n")
	}

	// The ## Optional section has special semantics in the llms.txt spec:
	// agents may skip it to save context window budget.
	if len(optGroupOrder) > 0 {
		b.WriteString("## Optional\n\n")
		b.WriteString("> These endpoints are deprecated and will be removed in a future release.\n")
		b.WriteString("> Prefer the new-generation `/apis/` surface where available.\n\n")
		for _, g := range optGroupOrder {
			fmt.Fprintf(&b, "### %s\n\n", g)
			for _, line := range optGroups[g] {
				b.WriteString(line)
			}
			b.WriteString("\n")
		}
	}

	return b.String()
}

// renderLLMsFullTxt produces a deduplicated index of every operation in the
// spec — auth context up front, then all operations grouped by tag with
// per-operation links. Deprecated operations are annotated inline. Agents that
// need the full parameter/response detail for a specific operation can follow
// the link to /api-docs/operations/{operationId}.
func renderLLMsFullTxt(s *apiDocsState) string {
	var b strings.Builder
	title := "Grafana HTTP API"
	if s.spec.Info != nil && s.spec.Info.Title != "" {
		title = s.spec.Info.Title
	}
	fmt.Fprintf(&b, "# %s — Complete Operations Index\n\n", title)

	opBase := s.appURL
	baseAPI := opBase + "/api/"
	fmt.Fprintf(&b, "> The Grafana HTTP API is served at `%s`.\n", baseAPI)
	b.WriteString("> Authenticate with `Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>` or basic auth (`-u admin:password`).\n")
	b.WriteString("> Full reference: <https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api.md/>\n\n")

	// Group under the first tag only to avoid duplicating entries that carry
	// multiple tags (e.g. enterprise operations tagged under both a feature tag
	// and "enterprise").
	seen := map[string]bool{}
	byTag := map[string][]*operationEntry{}
	tagOrder := []string{}

	for _, e := range s.ordered {
		if seen[e.OperationID] {
			continue
		}
		seen[e.OperationID] = true

		tags := e.Tags
		if len(tags) == 0 {
			tags = []string{"(untagged)"}
		}
		t := tags[0]
		if _, exists := byTag[t]; !exists {
			tagOrder = append(tagOrder, t)
		}
		byTag[t] = append(byTag[t], e)
	}
	sort.Strings(tagOrder)

	for _, t := range tagOrder {
		fmt.Fprintf(&b, "## %s\n\n", t)
		for _, e := range byTag[t] {
			summary := e.Summary
			if summary == "" {
				summary = oneLine(e.Description)
			}
			dep := ""
			if e.Operation.Deprecated {
				dep = " *(deprecated)*"
			}
			url := opBase + "/api-docs/operations/" + e.OperationID
			fmt.Fprintf(&b, "- [%s %s](%s): %s%s\n", e.Method, e.Path, url, summary, dep)
		}
		b.WriteString("\n")
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
	return markdownResponse(http.StatusOK, renderOperationMarkdown(entry, s))
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

// operationNotes contains agent-facing behavioral warnings for operations
// whose semantics are non-obvious or dangerous. Keyed by operation ID.
// Notes are emitted as a ## Caution block before ## Parameters.
var operationNotes = map[string]string{
	"setTeamRoles": "**Replace-all**: Overwrites the complete role list for the team. " +
		"Any role omitted from the request body is removed. " +
		"Read the current list with `listTeamRoles` first if you want additive changes.",
	"setUserRoles": "**Replace-all**: Overwrites the complete role list for the user. " +
		"Any role omitted from the request body is removed. " +
		"Read the current list with `listUserRoles` first if you want additive changes.",
	"setRoleAssignments": "**Replace-all**: Overwrites all role assignments for the specified role. " +
		"Read `getRoleAssignments` first to avoid unintentional removals.",
	"setResourcePermissions": "**Replace-all**: Replaces all permissions on the resource. " +
		"Read `getResourcePermissions` first if you want additive changes.",
	"setResourcePermissionsForTeam":        "**Replace-all**: Replaces all permissions for this resource/team combination.",
	"setResourcePermissionsForUser":        "**Replace-all**: Replaces all permissions for this resource/user combination.",
	"setResourcePermissionsForBuiltInRole": "**Replace-all**: Replaces all permissions for this resource/built-in role combination.",
	"setTeamMemberships": "**Replace-all**: Replaces the entire team membership list. " +
		"Any member omitted from the request is removed from the team.",
	"massDeleteAnnotations": "**Irreversible**: Permanently deletes all annotations matching the filter. " +
		"There is no undo — verify your filter with `getAnnotations` before calling this.",
	"RoutePutAlertRuleGroup": "**Replace-all**: Replaces the entire alert rule group, including all its rules. " +
		"Any rule omitted from the request is deleted. " +
		"Read the current group with `RouteGetAlertRuleGroup` first.",
	"RoutePutPolicyTree": "**Replace-all**: Replaces the entire notification policy tree. " +
		"Any route omitted from the request is deleted. " +
		"Read the current tree with `RouteGetPolicyTree` first.",
	"updateDashboardPermissionsByUID": "**Replace-all**: Replaces all dashboard permission ACL entries. " +
		"Any entry omitted from the request is removed.",
	"updateFolderPermissions": "**Replace-all**: Replaces all folder permission ACL entries. " +
		"Any entry omitted from the request is removed.",
	"postDashboard": "**Upsert**: Creates a new dashboard or updates an existing one. " +
		"Set `overwrite: true` in the body to replace an existing dashboard; " +
		"omitting it returns a version-conflict error if the dashboard already exists.",
	"adminDeleteUser": "**Irreversible**: Permanently deletes the user and revokes all their tokens and sessions.",
}

// relatedOps returns a capped list of operations that are structurally related
// to e: same-path peers (different HTTP method), the parent collection path,
// and direct children (one path segment deeper). Capped at 6 to keep pages
// focused.
func relatedOps(e *operationEntry, s *apiDocsState) []*operationEntry {
	var related []*operationEntry
	seen := map[string]bool{e.OperationID: true}

	add := func(other *operationEntry) bool {
		if seen[other.OperationID] {
			return false
		}
		seen[other.OperationID] = true
		related = append(related, other)
		return len(related) < 6
	}

	// 1. Same path, different method (e.g. GET and DELETE on the same resource).
	for _, other := range s.ordered {
		if other.Path == e.Path {
			if !add(other) {
				return related
			}
		}
	}

	// 2. Parent path: strip the last segment (parameter or named) to find the
	//    collection endpoint (e.g. /teams/{teamId} → /teams).
	if parent := parentPath(e.Path); parent != "" {
		for _, other := range s.ordered {
			if other.Path == parent {
				if !add(other) {
					return related
				}
			}
		}
	}

	// 3. Direct children: paths that extend this path by exactly one segment.
	for _, other := range s.ordered {
		if other.Path == e.Path {
			continue
		}
		if !strings.HasPrefix(other.Path, e.Path+"/") {
			continue
		}
		// Only immediate children (no further slash after the appended segment).
		rest := other.Path[len(e.Path)+1:]
		if !strings.Contains(rest, "/") {
			if !add(other) {
				return related
			}
		}
	}

	return related
}

// parentPath strips the last path segment, returning "" when the path has no
// meaningful parent (i.e. it is already a top-level path).
func parentPath(p string) string {
	idx := strings.LastIndex(p, "/")
	if idx <= 0 {
		return ""
	}
	return p[:idx]
}

// renderOperationMarkdown produces the per-operation markdown page.
// s is required for base URL, caution notes, and related-operation links.
func renderOperationMarkdown(e *operationEntry, s *apiDocsState) string {
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

	renderOperationContext(&b, e, s)

	// Caution block for operations with replace-all or irreversible semantics.
	if note, ok := operationNotes[e.OperationID]; ok {
		b.WriteString("## Caution\n\n")
		fmt.Fprintf(&b, "> %s\n\n", note)
	}

	renderParametersSection(&b, e)
	renderRequestBodySection(&b, e)
	renderResponsesSection(&b, e)
	renderSecuritySection(&b, e)
	renderRelatedOpsSection(&b, e, s)

	return b.String()
}

func renderOperationContext(b *strings.Builder, e *operationEntry, s *apiDocsState) {
	opBase := ""
	if s != nil {
		opBase = s.appURL
	}
	fmt.Fprintf(b, "> Full URL: `%s %s/api%s`\n", e.Method, opBase, e.Path)
	b.WriteString("> Authenticate with `Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>` or basic auth (`-u admin:password`).\n\n")
}

func renderParametersSection(b *strings.Builder, e *operationEntry) {
	if len(e.Operation.Parameters) == 0 {
		return
	}
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
		fmt.Fprintf(b, "- `%s` (%s, %s%s): %s\n",
			p.Name, p.In, paramTypeOf(p), req, oneLine(p.Description))
	}
	b.WriteString("\n")
}

func renderRequestBodySection(b *strings.Builder, e *operationEntry) {
	if e.Operation.RequestBody == nil || e.Operation.RequestBody.Value == nil {
		return
	}
	rb := e.Operation.RequestBody.Value
	b.WriteString("## Request Body\n\n")
	if rb.Required {
		b.WriteString("Required.\n\n")
	}
	if rb.Description != "" {
		fmt.Fprintf(b, "%s\n\n", oneLine(rb.Description))
	}
	mediaTypes := sortedMediaTypes(rb.Content)
	for _, mt := range mediaTypes {
		media := rb.Content[mt]
		fmt.Fprintf(b, "- Content-Type: `%s`", mt)
		if media != nil && media.Schema != nil {
			if ref := refName(media.Schema.Ref); ref != "" {
				fmt.Fprintf(b, " — schema: `%s`", ref)
			} else if media.Schema.Value != nil {
				fmt.Fprintf(b, " — type: `%s`", schemaType(media.Schema.Value))
			}
		}
		b.WriteString("\n")
		if media != nil {
			if ex := exampleJSON(media.Schema); ex != "" {
				fmt.Fprintf(b, "\n  Example:\n\n  ```json\n%s\n  ```\n", indentBlock(ex, "  "))
			}
		}
	}
	b.WriteString("\n")
}

func renderResponsesSection(b *strings.Builder, e *operationEntry) {
	if e.Operation.Responses == nil {
		return
	}
	resps := e.Operation.Responses.Map()
	if len(resps) == 0 {
		return
	}
	b.WriteString("## Responses\n\n")
	codes := make([]string, 0, len(resps))
	for c := range resps {
		codes = append(codes, c)
	}
	sort.Strings(codes)
	renderedExamples := map[string]bool{}

	for _, code := range codes {
		rref := resps[code]
		if rref == nil || rref.Value == nil {
			continue
		}
		renderResponseCode(b, code, rref.Value, renderedExamples)
	}
	b.WriteString("\n")
}

func renderResponseCode(b *strings.Builder, code string, r *openapi3.Response, renderedExamples map[string]bool) {
	desc := ""
	if r.Description != nil {
		desc = oneLine(*r.Description)
	}
	fmt.Fprintf(b, "- `%s`: %s", code, desc)
	mediaTypes := sortedMediaTypes(r.Content)
	for _, mt := range mediaTypes {
		media := r.Content[mt]
		if media == nil || media.Schema == nil {
			continue
		}
		if ref := refName(media.Schema.Ref); ref != "" {
			fmt.Fprintf(b, " (`%s` → `%s`)", mt, ref)
		} else if media.Schema.Value != nil {
			fmt.Fprintf(b, " (`%s` → `%s`)", mt, schemaType(media.Schema.Value))
		}
	}
	b.WriteString("\n")
	for _, mt := range mediaTypes {
		renderResponseExample(b, mt, r.Content[mt], renderedExamples)
	}
}

func renderResponseExample(b *strings.Builder, mediaType string, media *openapi3.MediaType, renderedExamples map[string]bool) {
	if media == nil || media.Schema == nil {
		return
	}
	schemaKey := refName(media.Schema.Ref)
	if schemaKey == "" && media.Schema.Value != nil {
		schemaKey = schemaType(media.Schema.Value)
	}
	if schemaKey != "" && renderedExamples[schemaKey] {
		return
	}
	if ex := exampleJSON(media.Schema); ex != "" {
		fmt.Fprintf(b, "\n  Example (`%s`):\n\n  ```json\n%s\n  ```\n", mediaType, indentBlock(ex, "  "))
		if schemaKey != "" {
			renderedExamples[schemaKey] = true
		}
	}
}

func renderSecuritySection(b *strings.Builder, e *operationEntry) {
	if e.Operation.Security == nil || len(*e.Operation.Security) == 0 {
		return
	}
	b.WriteString("## Security\n\n")
	for _, sec := range *e.Operation.Security {
		for name := range sec {
			fmt.Fprintf(b, "- %s\n", name)
		}
	}
	b.WriteString("\n")
}

func renderRelatedOpsSection(b *strings.Builder, e *operationEntry, s *apiDocsState) {
	if s == nil {
		return
	}
	rel := relatedOps(e, s)
	if len(rel) == 0 {
		return
	}
	b.WriteString("## Related Operations\n\n")
	for _, r := range rel {
		summary := r.Summary
		if summary == "" {
			summary = oneLine(r.Description)
		}
		url := s.appURL + "/api-docs/operations/" + r.OperationID
		fmt.Fprintf(b, "- [%s %s](%s): %s\n", r.Method, r.Path, url, summary)
	}
	b.WriteString("\n")
}

func sortedMediaTypes(content openapi3.Content) []string {
	mediaTypes := make([]string, 0, len(content))
	for mt := range content {
		mediaTypes = append(mediaTypes, mt)
	}
	sort.Strings(mediaTypes)
	return mediaTypes
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

	refVal, done, cleanup := beginSchemaRefVisit(sref.Ref, visited)
	if done {
		return refVal
	}
	if cleanup != nil {
		defer cleanup()
	}

	if v := exampleValueForComposites(s, visited, depth); v != nil {
		return v
	}
	return exampleValueForPrimaryType(s, visited, depth)
}

func beginSchemaRefVisit(ref string, visited map[string]bool) (any, bool, func()) {
	refKey := refName(ref)
	if refKey == "" {
		return nil, false, nil
	}
	if visited[refKey] {
		return map[string]any{"$ref": refKey}, true, nil
	}
	visited[refKey] = true
	return nil, false, func() { delete(visited, refKey) }
}

func exampleValueForComposites(s *openapi3.Schema, visited map[string]bool, depth int) any {
	if len(s.AllOf) > 0 {
		if merged := mergeAllOfExample(s, visited, depth); len(merged) > 0 {
			return merged
		}
	}
	if len(s.OneOf) > 0 {
		return exampleValueForSchema(s.OneOf[0], visited, depth+1)
	}
	if len(s.AnyOf) > 0 {
		return exampleValueForSchema(s.AnyOf[0], visited, depth+1)
	}
	return nil
}

func mergeAllOfExample(s *openapi3.Schema, visited map[string]bool, depth int) map[string]any {
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
	return merged
}

func exampleValueForPrimaryType(s *openapi3.Schema, visited map[string]bool, depth int) any {
	switch schemaPrimaryType(s) {
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
		return firstNonNil(s.Default, 0)
	case "number":
		return firstNonNil(s.Default, 0.0)
	case "boolean":
		return firstNonNil(s.Default, false)
	case "null":
		return nil
	default:
		return nil
	}
}

func schemaPrimaryType(s *openapi3.Schema) string {
	if s.Type != nil {
		if ts := s.Type.Slice(); len(ts) > 0 {
			return ts[0]
		}
	}
	if len(s.Properties) > 0 {
		return "object"
	}
	return ""
}

func firstNonNil(v any, fallback any) any {
	if v != nil {
		return v
	}
	return fallback
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
