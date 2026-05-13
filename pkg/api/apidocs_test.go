package api

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// buildFixtureSpec returns a minimal but representative spec. It exercises
// operationId, summary, tags, parameters (path + query), request body,
// responses, an operation missing an operationId, and a deprecated flag.
func buildFixtureSpec(t *testing.T) *openapi3.T {
	t.Helper()

	const raw = `{
		"openapi": "3.0.0",
		"info": { "title": "Grafana Test API", "version": "0.0.1", "description": "test" },
		"paths": {
			"/dashboards/uid/{uid}": {
				"get": {
					"operationId": "getDashboardByUID",
					"summary": "Get dashboard by UID",
					"tags": ["dashboards"],
					"parameters": [
						{
							"name": "uid",
							"in": "path",
							"required": true,
							"schema": { "type": "string" },
							"description": "The dashboard UID"
						}
					],
					"responses": {
						"200": { "description": "OK" },
						"404": { "description": "Not found" }
					}
				},
				"delete": {
					"summary": "Delete a dashboard",
					"tags": ["dashboards"],
					"deprecated": true,
					"responses": { "200": { "description": "OK" } }
				}
			},
			"/search": {
				"get": {
					"operationId": "searchDashboards",
					"summary": "Search dashboards",
					"tags": ["search"],
					"parameters": [
						{ "name": "query", "in": "query", "schema": { "type": "string" }, "description": "Free-text query" },
						{ "name": "limit", "in": "query", "schema": { "type": "integer" } }
					],
					"responses": { "200": { "description": "OK" } }
				}
			},
			"/dashboards/db": {
				"post": {
					"operationId": "createDashboard",
					"summary": "Create or update dashboard",
					"tags": ["dashboards"],
					"requestBody": {
						"required": true,
						"description": "Dashboard model",
						"content": {
							"application/json": { "schema": { "type": "object" } }
						}
					},
					"responses": { "200": { "description": "OK" } }
				}
			}
		}
	}`

	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData([]byte(raw))
	require.NoError(t, err)
	return doc
}

func TestBuildAPIDocsState(t *testing.T) {
	doc := buildFixtureSpec(t)
	s := buildAPIDocsState(doc)

	assert.Len(t, s.ordered, 4, "expect 4 operations across 3 paths")

	for _, e := range s.ordered {
		assert.NotEmpty(t, e.OperationID, "every operation should end up with an id")
		assert.NotEmpty(t, e.Method)
		assert.NotEmpty(t, e.Path)
	}

	assert.Contains(t, s.ops, "getDashboardByUID")
	assert.Contains(t, s.ops, "searchDashboards")
	assert.Contains(t, s.ops, "createDashboard")

	// The DELETE on /dashboards/uid/{uid} has no operationId; ensure one was synthesized.
	found := false
	for id, e := range s.ops {
		if e.Method == "DELETE" && e.Path == "/dashboards/uid/{uid}" {
			found = true
			assert.NotEqual(t, "", id)
			assert.NotEqual(t, "getDashboardByUID", id)
		}
	}
	assert.True(t, found, "synthesized DELETE entry should exist")
}

func TestRenderOperationMarkdown(t *testing.T) {
	doc := buildFixtureSpec(t)
	s := buildAPIDocsState(doc)

	md := renderOperationMarkdown(s.ops["getDashboardByUID"])

	assert.True(t, strings.HasPrefix(md, "# GET /dashboards/uid/{uid}"), "header line wrong: %q", md[:40])
	assert.Contains(t, md, "Get dashboard by UID")
	assert.Contains(t, md, "Operation ID: `getDashboardByUID`")
	assert.Contains(t, md, "Tags: dashboards")
	assert.Contains(t, md, "## Parameters")
	assert.Contains(t, md, "`uid` (path, string, required): The dashboard UID")
	assert.Contains(t, md, "## Responses")
	assert.Contains(t, md, "`200`: OK")
	assert.Contains(t, md, "`404`: Not found")

	// Deprecated DELETE should call that out and not show a request body.
	var deleteEntry *operationEntry
	for _, e := range s.ordered {
		if e.Method == "DELETE" {
			deleteEntry = e
			break
		}
	}
	require.NotNil(t, deleteEntry)
	mdDel := renderOperationMarkdown(deleteEntry)
	assert.Contains(t, mdDel, "Deprecated: yes")
	assert.NotContains(t, mdDel, "## Request Body")

	// POST should show the request body block.
	mdCreate := renderOperationMarkdown(s.ops["createDashboard"])
	assert.Contains(t, mdCreate, "## Request Body")
	assert.Contains(t, mdCreate, "Required.")
	assert.Contains(t, mdCreate, "Content-Type: `application/json`")
}

func TestRenderLLMsTxt(t *testing.T) {
	doc := buildFixtureSpec(t)
	s := buildAPIDocsState(doc)
	md := renderLLMsTxt(s)

	assert.Contains(t, md, "# Grafana Test API")
	assert.Contains(t, md, "## Discovery")
	assert.Contains(t, md, "(/api-docs/index.json)")
	assert.Contains(t, md, "(/llms-full.txt)")

	// Operations bucketed under their tag with markdown links.
	assert.Contains(t, md, "## dashboards")
	assert.Contains(t, md, "## search")
	assert.Contains(t, md, "(/api-docs/operations/searchDashboards)")
	assert.Contains(t, md, "(/api-docs/operations/getDashboardByUID)")
}

func TestRenderLLMsFullTxt(t *testing.T) {
	doc := buildFixtureSpec(t)
	s := buildAPIDocsState(doc)
	md := renderLLMsFullTxt(s)

	assert.Contains(t, md, "Grafana Test API")
	assert.Contains(t, md, "# GET /dashboards/uid/{uid}")
	assert.Contains(t, md, "# GET /search")
	assert.Contains(t, md, "# POST /dashboards/db")
	assert.True(t, strings.Count(md, "\n---\n") >= 4, "expect a separator after each of the 4 operations")
}

func TestApiDocsManifestShape(t *testing.T) {
	doc := buildFixtureSpec(t)
	s := buildAPIDocsState(doc)

	m := apiDocsManifest{
		Title:   s.spec.Info.Title,
		Version: s.spec.Info.Version,
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

	out, err := json.Marshal(m)
	require.NoError(t, err)

	var round map[string]any
	require.NoError(t, json.Unmarshal(out, &round))
	assert.Equal(t, "Grafana Test API", round["title"])
	ops, ok := round["operations"].([]any)
	require.True(t, ok)
	assert.Len(t, ops, 4)
}

func TestExampleJSON(t *testing.T) {
	const raw = `{
		"openapi": "3.0.0",
		"info": { "title": "T", "version": "1" },
		"paths": {},
		"components": {
			"schemas": {
				"User": {
					"type": "object",
					"properties": {
						"id":      { "type": "integer" },
						"email":   { "type": "string", "format": "email" },
						"created": { "type": "string", "format": "date-time" },
						"role":    { "type": "string", "enum": ["admin", "viewer"] },
						"active":  { "type": "boolean", "default": true }
					}
				},
				"UserList": {
					"type": "array",
					"items": { "$ref": "#/components/schemas/User" }
				},
				"Node": {
					"type": "object",
					"properties": {
						"value": { "type": "string" },
						"child": { "$ref": "#/components/schemas/Node" }
					}
				},
				"WithExample": {
					"type": "object",
					"example": { "literal": "wins" }
				}
			}
		}
	}`

	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData([]byte(raw))
	require.NoError(t, err)

	userRef := doc.Components.Schemas["User"]
	out := exampleJSON(userRef)
	var got map[string]any
	require.NoError(t, json.Unmarshal([]byte(out), &got))
	assert.Equal(t, "user@example.com", got["email"])
	assert.Equal(t, "2025-01-01T00:00:00Z", got["created"])
	assert.Equal(t, "admin", got["role"], "first enum value should win")
	assert.Equal(t, true, got["active"], "default should win")
	assert.Equal(t, float64(0), got["id"])

	listRef := doc.Components.Schemas["UserList"]
	listOut := exampleJSON(listRef)
	var gotList []map[string]any
	require.NoError(t, json.Unmarshal([]byte(listOut), &gotList))
	assert.Len(t, gotList, 1)
	assert.Equal(t, "user@example.com", gotList[0]["email"], "items should expand the referenced schema")

	// Recursive schema should terminate and not loop forever.
	nodeRef := doc.Components.Schemas["Node"]
	nodeOut := exampleJSON(nodeRef)
	assert.NotEmpty(t, nodeOut, "recursive schema should still produce output")
	assert.Less(t, len(nodeOut), 4096, "recursion should be depth-limited")

	// Explicit example field on the schema wins.
	withExample := doc.Components.Schemas["WithExample"]
	got2 := exampleJSON(withExample)
	assert.Contains(t, got2, `"literal": "wins"`)
}

func TestRenderOperationMarkdownIncludesExamples(t *testing.T) {
	doc := buildFixtureSpec(t)
	s := buildAPIDocsState(doc)

	md := renderOperationMarkdown(s.ops["createDashboard"])
	assert.Contains(t, md, "## Request Body")
	assert.Contains(t, md, "Example:")
	assert.Contains(t, md, "```json")
}

func TestSynthesizeOperationID(t *testing.T) {
	cases := []struct {
		method, path, want string
	}{
		{"GET", "/api/dashboards/uid/{uid}", "get_api_dashboards_uid_uid"},
		{"POST", "/foo/bar", "post_foo_bar"},
		{"DELETE", "/", "delete"},
	}
	for _, tc := range cases {
		got := synthesizeOperationID(tc.method, tc.path)
		assert.Equal(t, tc.want, got, "method=%s path=%s", tc.method, tc.path)
	}
}
