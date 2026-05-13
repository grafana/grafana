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
