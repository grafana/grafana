package builder

import (
	"maps"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	openapi "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func TestOpenAPI_GetPathOperations(t *testing.T) {
	testCases := []struct {
		name    string
		input   *spec3.Path
		expect  []string // the methods we should see
		exclude []string // the methods we should never see
	}{
		{
			name: "some operations",
			input: &spec3.Path{
				PathProps: spec3.PathProps{
					Get:    &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "get"}},
					Post:   &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "post"}},
					Delete: &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "delete"}},
				},
			},
			expect:  []string{"GET", "POST", "DELETE"},
			exclude: []string{"PUT", "PATCH", "OPTIONS", "HEAD", "TRACE"},
		},
		{
			name: "all operations",
			input: &spec3.Path{
				PathProps: spec3.PathProps{
					Get:     &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "get"}},
					Post:    &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "post"}},
					Delete:  &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "delete"}},
					Put:     &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "put"}},
					Patch:   &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "patch"}},
					Options: &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "options"}},
					Head:    &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "head"}},
					Trace:   &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "trace"}},
				},
			},
			expect:  []string{"GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS", "HEAD", "TRACE"},
			exclude: []string{},
		},
	}
	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			expect := make(map[string]bool)
			for _, k := range tt.expect {
				expect[k] = true
			}

			for k, op := range GetPathOperations(&tt.input.PathProps) {
				require.NotNil(t, op)
				require.Equal(t, strings.ToLower(k), op.Summary)

				if !expect[k] {
					if slices.Contains(tt.expect, k) {
						require.Fail(t, "method returned multiple times", k)
					} else {
						require.Fail(t, "unexpected method", k)
					}
				}
				delete(expect, k)
				require.NotContains(t, tt.exclude, k, "exclude")
			}

			if len(expect) > 0 {
				require.Fail(t, "missing expected method", expect)
			}
		})
	}
}

// A caller-supplied route is served over HTTP, so it has to be discoverable in
// the spec too, not only the routes that come from builders.
func TestAddBuilderRoutes_PublishesCallerSuppliedRoutes(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	var reached string

	spec := &spec3.OpenAPI{Paths: &spec3.Paths{Paths: map[string]*spec3.Path{}}}
	got, err := addBuilderRoutes(gv, spec, nil, enabledConfig(gv), []GroupVersionRoutes{
		{
			GroupVersion: gv,
			Routes:       &APIRoutes{Namespace: []APIRouteHandler{postRoute("widgets/search", &reached, "Search")}},
		},
	})
	require.NoError(t, err)

	path := got.Paths.Paths["/apis/example.grafana.app/v1/namespaces/{namespace}/widgets/search"]
	require.NotNil(t, path, "the served path is missing from the spec")
	require.NotNil(t, path.Post)
	require.Equal(t, "listSearch", path.Post.OperationId)
}

// Routes for another group version must not leak into this one's spec.
func TestAddBuilderRoutes_IgnoresOtherGroupVersions(t *testing.T) {
	target := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	other := schema.GroupVersion{Group: "other.grafana.app", Version: "v1"}
	var reached string

	spec := &spec3.OpenAPI{Paths: &spec3.Paths{Paths: map[string]*spec3.Path{}}}
	got, err := addBuilderRoutes(target, spec, nil, enabledConfig(target), []GroupVersionRoutes{
		{
			GroupVersion: other,
			Routes:       &APIRoutes{Namespace: []APIRouteHandler{postRoute("widgets/search", &reached, "Search")}},
		},
	})
	require.NoError(t, err)
	require.Empty(t, got.Paths.Paths)
}

// A group version served only through caller-supplied routes has no builder and
// no discovery path. Its spec still gets the routes' full description and the
// components they reference, not the bare path the WebService alone produces.
func TestOpenAPIPostProcessor_DescribesRoutesOfAGroupWithoutBuilders(t *testing.T) {
	gv := schema.GroupVersion{Group: "routes-only.grafana.app", Version: "v1"}
	var reached string
	route := postRoute("widgets/search", &reached, "Search")
	route.Spec.Post.Description = "Search widgets."
	route.Schemas = map[string]spec.Schema{"com.example.SearchQuery": {SchemaProps: spec.SchemaProps{Type: []string{"object"}}}}

	path := "/apis/routes-only.grafana.app/v1/namespaces/{namespace}/widgets/search"
	bare := &spec3.OpenAPI{Paths: &spec3.Paths{Paths: map[string]*spec3.Path{
		path: {PathProps: spec3.PathProps{Post: &spec3.Operation{OperationProps: spec3.OperationProps{OperationId: "listSearch"}}}},
	}}, Components: &spec3.Components{}}

	process := getOpenAPIPostProcessor("test", nil, nil, enabledConfig(gv), []GroupVersionRoutes{{
		GroupVersion: gv,
		Routes:       &APIRoutes{Namespace: []APIRouteHandler{route}},
	}})
	got, err := process(bare)
	require.NoError(t, err)

	require.NotNil(t, got.Paths.Paths[path])
	require.Equal(t, "Search widgets.", got.Paths.Paths[path].Post.Description)
	require.Contains(t, got.Components.Schemas, "com.example.SearchQuery")
}

// A route publishes only what its roots reach, under the names its $refs use, and
// a name OpenAPIModelName already converted is not converted again.
func TestRouteSchemas(t *testing.T) {
	const (
		widget  = "github.com/example/pkg/apis/widget/v1.Widget"
		part    = "github.com/example/pkg/apis/widget/v1.Part"
		meta    = "io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta" // already converted by OpenAPIModelName
		missing = "github.com/example/pkg/apis/widget/v1.Missing"
		other   = "github.com/example/pkg/apis/widget/v1.Other"
	)
	definitions := func(ref openapi.ReferenceCallback) map[string]openapi.OpenAPIDefinition {
		object := func(props map[string]string) spec.Schema {
			s := spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"object"}, Properties: map[string]spec.Schema{}}}
			for prop, name := range props {
				s.Properties[prop] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref(name)}}
			}
			return s
		}
		return map[string]openapi.OpenAPIDefinition{
			widget: {Schema: object(map[string]string{"metadata": meta, "part": part}), Dependencies: []string{meta, part}},
			part:   {Schema: object(map[string]string{"owner": widget}), Dependencies: []string{widget, missing}},
			meta:   {Schema: object(nil)},
			other:  {Schema: object(nil)},
		}
	}

	got := RouteSchemas(definitions, widget)

	require.ElementsMatch(t, []string{
		"com.github.example.pkg.apis.widget.v1.Widget",
		"com.github.example.pkg.apis.widget.v1.Part",
		meta,
	}, slices.Collect(maps.Keys(got)))

	refs := map[string]string{}
	for _, name := range []string{"com.github.example.pkg.apis.widget.v1.Widget", "com.github.example.pkg.apis.widget.v1.Part"} {
		for prop, s := range got[name].Properties {
			refs[prop] = s.Ref.String()
		}
	}
	require.Equal(t, map[string]string{
		"metadata": "#/components/schemas/" + meta,
		"part":     "#/components/schemas/com.github.example.pkg.apis.widget.v1.Part",
		"owner":    "#/components/schemas/com.github.example.pkg.apis.widget.v1.Widget",
	}, refs)
}
