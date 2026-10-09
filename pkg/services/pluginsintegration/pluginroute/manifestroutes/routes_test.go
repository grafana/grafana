package manifestroutes

import (
	"net/http"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
)

func get() spec3.PathProps { return spec3.PathProps{Get: &spec3.Operation{}} }

func testVersion(paths map[string]spec3.PathProps) app.ManifestVersion {
	return app.ManifestVersion{
		Name: "v1",
		Kinds: []app.ManifestVersionKind{
			{Kind: "Thing", Plural: "Things", Scope: "Namespaced"},
			{Kind: "Node", Plural: "Nodes", Scope: "Cluster"},
		},
		OpenAPI: app.ManifestVersionOpenAPI{Paths: paths},
	}
}

func byDeclared(routes []Route) map[string]Route {
	out := map[string]Route{}
	for _, r := range routes {
		out[r.Declared] = r
	}
	return out
}

func declaredPaths(routes []Route) []string {
	out := make([]string, 0, len(routes))
	for _, r := range routes {
		out = append(out, r.Declared)
	}
	return out
}

func reasons(problems []Problem) map[string]string {
	out := map[string]string{}
	for _, p := range problems {
		key := p.Path
		if p.Method != "" {
			key = p.Method + " " + key
		}
		out[key] = p.Reason
	}
	return out
}

func TestParseResolvesWhereRoutesMount(t *testing.T) {
	routes, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/foobar":                                 get(),
		"/namespaces/{namespace}/foobar":          get(),
		"/namespaces/{namespace}/things/{name}/a": get(),
		"/nodes/{name}/rebuild":                   get(),
	}), Options{})
	require.Empty(t, problems)

	got := byDeclared(routes)
	require.Equal(t, Route{
		Declared: "/foobar", Path: "foobar", Pattern: "foobar", SpecPath: "foobar", Operations: get(),
	}, got["/foobar"])

	namespaced := got["/namespaces/{namespace}/foobar"]
	require.True(t, namespaced.Namespaced)
	require.Equal(t, "foobar", namespaced.Path)
	require.Equal(t, "namespaces/{namespace}/foobar", namespaced.VersionPath())
	require.Nil(t, namespaced.Kind)

	sub := got["/namespaces/{namespace}/things/{name}/a"]
	require.Equal(t, "Thing", sub.Kind.Kind)
	require.Equal(t, "a", sub.Subresource)
	require.Equal(t, "namespaces/{namespace}/things/{name}/a", sub.Pattern)

	cluster := got["/nodes/{name}/rebuild"]
	require.False(t, cluster.Namespaced)
	require.Equal(t, "Node", cluster.Kind.Kind)
}

func TestParseReportsPathsThatCannotBeServed(t *testing.T) {
	routes, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/ok":                                   get(),
		"/things":                               get(),
		"/namespaces/{namespace}/things/search": get(),
		"/namespaces/{namespace}/things/{name}": get(),
		"/namespaces/{namespace}/things/{name}/status": get(),
		"/things/{name}/sub":                           get(),
		"/namespaces/{namespace}/nodes/{name}/sub":     get(),
		"/app/thing":            get(),
		"/namespaces/{other}/x": get(),
		"/":                     get(),
		"/v{version}":           get(),
		"/a//b":                 get(),
		"/a/../b":               get(),
		"/ids/{id:[0-9]+}":      get(),
		"/files/{path:*}/more":  get(),
		"/empty":                {},
	}), Options{ReservedResources: []string{"app"}})
	require.Equal(t, []string{"/ok"}, declaredPaths(routes))

	require.Equal(t, map[string]string{
		"/things":                                      "shadows the things resource; a kind route must be below things/{name}/",
		"/namespaces/{namespace}/things/search":        "shadows the things resource; a kind route must be below things/{name}/",
		"/namespaces/{namespace}/things/{name}":        "shadows the things resource; a kind route must be below things/{name}/",
		"/namespaces/{namespace}/things/{name}/status": "shadows the status subresource every kind has",
		"/things/{name}/sub":                           "Thing is namespaced, so its routes must be under namespaces/{namespace}",
		"/namespaces/{namespace}/nodes/{name}/sub":     "Node is cluster scoped, so its routes cannot be under namespaces/{namespace}",
		"/app/thing":                                   "shadows the app resource",
		"/namespaces/{other}/x":                        "only a route under namespaces/{namespace}/ may start with namespaces",
		"/":                                            "shadows the version root",
		"/v{version}":                                  "a parameter must be a whole path segment: v{version}",
		"/a//b":                                        "is not a clean path",
		"/a/../b":                                      "is not a clean path",
		"/ids/{id:[0-9]+}":                             "a parameter cannot constrain its value: {id:[0-9]+}",
		"/files/{path:*}/more":                         "only the last segment can match the rest of the path: {path:*}",
		"/empty":                                       "no operation is served",
	}, reasons(problems))
}

// OpenAPI allows parameter names ServeMux does not, so they are renamed for
// matching and published as declared.
func TestParseRenamesParameters(t *testing.T) {
	routes, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/flags/{flag-key}/eval":              get(),
		"/namespaces/{namespace}/a/{x}/b/{x}": get(),
		"/dir/":                               get(),
	}), Options{})
	require.Empty(t, problems)
	got := byDeclared(routes)
	require.Equal(t, "flags/{p1}/eval", got["/flags/{flag-key}/eval"].Pattern)
	require.Equal(t, "flags/{flag-key}/eval", got["/flags/{flag-key}/eval"].SpecPath)
	require.Equal(t, "namespaces/{namespace}/a/{p3}/b/{p5}", got["/namespaces/{namespace}/a/{x}/b/{x}"].Pattern)
	require.Equal(t, "dir/{$}", got["/dir/"].Pattern, "a trailing slash does not match the subtree")
}

// A catch-all can be written in the go-restful form, the ServeMux form, or as
// an ordinary parameter named by x-grafana-catch-all, which is how app-sdk
// writes it in OpenAPI. All three publish the same path.
func TestParseCatchAll(t *testing.T) {
	marked := func(name string) spec3.PathProps {
		op := &spec3.Operation{}
		op.AddExtension(CatchAllExtension, name)
		return spec3.PathProps{Get: op}
	}
	routes, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/restful/{path:*}": get(),
		"/mux/{path...}":    get(),
		"/extension/{path}": marked("path"),
		"/namespaces/{namespace}/things/{name}/files/{path:*}": get(),
		"/misnamed/{path}":     marked("other"),
		"/notlast/{path}/more": marked("path"),
		"/empty/{path}":        marked(""),
	}), Options{})

	got := byDeclared(routes)
	for _, declared := range []string{"/restful/{path:*}", "/mux/{path...}", "/extension/{path}"} {
		route := got[declared]
		require.Equal(t, "path", route.CatchAll, declared)
		require.Regexp(t, `/\{p1\.\.\.\}$`, route.Pattern, declared)
		require.Regexp(t, `/\{path\}$`, route.SpecPath, declared)
	}
	files := got["/namespaces/{namespace}/things/{name}/files/{path:*}"]
	require.Equal(t, "files/{path:*}", files.Subresource)
	require.Equal(t, "namespaces/{namespace}/things/{name}/files/{path}", files.SpecPath)

	require.Equal(t, map[string]string{
		"/misnamed/{path}":     "x-grafana-catch-all names other, which is not the last path segment",
		"/notlast/{path}/more": "only the last segment can match the rest of the path: {path}",
		"/empty/{path}":        "x-grafana-catch-all on GET must name a path parameter",
	}, reasons(problems))
}

// Paths that match the same requests cannot both be served, so the later one
// is reported against the one it conflicts with. Overlapping paths are fine.
func TestParseConflicts(t *testing.T) {
	routes, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/flags/{flag-key}": get(),
		"/flags/{id}":       get(),
		"/items/{id}":       {Get: &spec3.Operation{}, Delete: &spec3.Operation{}},
		"/items/search":     {Post: &spec3.Operation{}},
		"/items/{id}/do":    {Put: &spec3.Operation{}},
	}), Options{})
	require.Len(t, routes, 4)
	require.Equal(t, map[string]string{
		"/flags/{id}": "differs from /flags/{flag-key} only in parameter names, which OpenAPI does not allow",
	}, reasons(problems))
}

// OpenAPI does not allow two templated paths that differ only in parameter
// names, even when ServeMux could tell their methods apart. A catch-all is
// published as an ordinary parameter, so it counts as the same shape too.
func TestParseRejectsEquivalentPaths(t *testing.T) {
	routes, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/items/{id}":         {Post: &spec3.Operation{}},
		"/items/{name}":       get(),
		"/files/{id}":         get(),
		"/files/{path:*}":     {Put: &spec3.Operation{}},
		"/items/{id}/history": get(),
	}), Options{})
	require.ElementsMatch(t, []string{"/files/{id}", "/items/{id}", "/items/{id}/history"}, declaredPaths(routes))
	require.Equal(t, map[string]string{
		"/files/{path:*}": "differs from /files/{id} only in parameter names, which OpenAPI does not allow",
		"/items/{name}":   "differs from /items/{id} only in parameter names, which OpenAPI does not allow",
	}, reasons(problems))
}

// A route rejected partway through registering its methods must not leave the
// ones it registered behind to reject a later, valid route.
func TestParseRollsBackRejectedRoutes(t *testing.T) {
	// In path order: /x/{q}/b registers its GET, then its POST conflicts with
	// /x/a/{p}. Its GET would in turn conflict with /x/~/{r}, which is valid
	// once /x/{q}/b is gone.
	routes, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/x/a/{p}": {Post: &spec3.Operation{}},
		"/x/{q}/b": {Get: &spec3.Operation{}, Post: &spec3.Operation{}},
		"/x/~/{r}": get(),
	}), Options{})
	require.Equal(t, map[string]string{
		"/x/{q}/b": "matches the same POST requests as /x/a/{p}",
	}, reasons(problems))
	require.Equal(t, []string{"/x/a/{p}", "/x/~/{r}"}, declaredPaths(routes))
}

func TestParseUnservedMethods(t *testing.T) {
	op := &spec3.Operation{}
	version := testVersion(map[string]spec3.PathProps{
		"/mixed":     {Get: op, Options: op, Trace: op},
		"/traceonly": {Trace: op},
	})
	routes, problems := Parse(version, Options{UnservedMethods: []string{http.MethodTrace, http.MethodOptions}})
	require.Len(t, routes, 1)
	require.Equal(t, spec3.PathProps{Get: op}, routes[0].Operations)
	require.Equal(t, map[string]string{
		"TRACE /mixed":     "the method is not served",
		"OPTIONS /mixed":   "the method is not served",
		"TRACE /traceonly": "the method is not served",
		"/traceonly":       "no operation is served",
	}, reasons(problems))
	require.NotNil(t, version.OpenAPI.Paths["/mixed"].Trace, "the manifest is not modified")

	routes, problems = Parse(version, Options{})
	require.Len(t, routes, 2, "without options every method is served")
	require.Empty(t, problems)
}

func TestValidate(t *testing.T) {
	require.NoError(t, Validate(nil, Options{}))
	require.NoError(t, Validate(&app.ManifestData{Versions: []app.ManifestVersion{testVersion(map[string]spec3.PathProps{
		"/ok": get(),
	})}}, Options{}))

	manifest := &app.ManifestData{Versions: []app.ManifestVersion{
		testVersion(map[string]spec3.PathProps{"/things": get()}),
		{Name: "v2", OpenAPI: app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{
			"/a/{x}": get(), "/a/{y}": get(),
		}}},
	}}
	err := Validate(manifest, Options{})
	require.EqualError(t, err, "v1 /things: shadows the things resource; a kind route must be below things/{name}/\n"+
		"v2 /a/{y}: differs from /a/{x} only in parameter names, which OpenAPI does not allow")
}

// A path parameter declared on the operation is left alone; only the path is
// rewritten for matching.
func TestParseKeepsDeclaredOperations(t *testing.T) {
	op := &spec3.Operation{OperationProps: spec3.OperationProps{
		Parameters: []*spec3.Parameter{{ParameterProps: spec3.ParameterProps{
			Name: "flag-key", In: "path", Required: true, Schema: spec.StringProperty(),
		}}},
	}}
	routes, _ := Parse(testVersion(map[string]spec3.PathProps{"/flags/{flag-key}": {Get: op}}), Options{})
	require.Same(t, op, routes[0].Operations.Get)
}

// An operation can declare the access check a request must pass. Without a
// declared verb the check uses the request's, so Verb is left empty.
func TestParseAuthz(t *testing.T) {
	op := func(ext map[string]any) *spec3.Operation {
		o := &spec3.Operation{}
		for k, v := range ext {
			o.AddExtension(k, v)
		}
		return o
	}
	routes, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/namespaces/{namespace}/things/{name}/reconcile": {
			Post: op(map[string]any{ExtensionAuthzResource: "things", ExtensionAuthzSubresource: "reconcile"}),
			Get:  op(map[string]any{ExtensionAuthzResource: "things", ExtensionAuthzVerb: "list"}),
			Put:  op(nil),
		},
		"/report": {
			Get:    op(map[string]any{ExtensionAuthzResource: "reports"}),
			Delete: op(map[string]any{ExtensionAuthzVerb: "delete"}),
			Patch:  op(map[string]any{ExtensionAuthzResource: "reports", ExtensionAuthzVerb: "approve"}),
			Post:   op(map[string]any{ExtensionAuthzResource: 42}),
		},
		"/trace": {Options: op(map[string]any{ExtensionAuthzResource: "reports"})}, // any method can use the request's verb
	}), Options{})
	got := byDeclared(routes)

	require.Equal(t, map[string]authlib.CheckRequest{
		http.MethodPost: {Resource: "things", Subresource: "reconcile"},
		http.MethodGet:  {Verb: "list", Resource: "things"},
	}, got["/namespaces/{namespace}/things/{name}/reconcile"].Authz, "an operation without a declaration needs no check")
	require.NotNil(t, got["/namespaces/{namespace}/things/{name}/reconcile"].Operations.Put)

	report := got["/report"]
	require.Equal(t, map[string]authlib.CheckRequest{
		http.MethodGet: {Resource: "reports"},
	}, report.Authz)
	require.Equal(t, map[string]authlib.CheckRequest{
		http.MethodOptions: {Resource: "reports"},
	}, got["/trace"].Authz)
	require.Equal(t, spec3.PathProps{Get: report.Operations.Get}, report.Operations,
		"an operation whose check cannot be read is not served without it")

	require.Equal(t, map[string]string{
		"DELETE /report": "an authz subresource or verb needs x-grafana-declared-authz-resource",
		"PATCH /report":  `x-grafana-declared-authz-verb must be one of get, list, watch, create, update, patch, delete, deletecollection, get_permissions, set_permissions, not "approve"`,
		"POST /report":   "x-grafana-declared-authz-resource must be a non-empty string",
	}, reasons(problems))
}

// Each declared authz extension must be a non-empty string; the subresource
// and verb are checked as the resource is.
func TestParseAuthzExtensionTypes(t *testing.T) {
	op := func(ext map[string]any) spec3.PathProps {
		o := &spec3.Operation{}
		for k, v := range ext {
			o.AddExtension(k, v)
		}
		return spec3.PathProps{Get: o}
	}
	_, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/a": op(map[string]any{ExtensionAuthzResource: "reports", ExtensionAuthzSubresource: 7}),
		"/b": op(map[string]any{ExtensionAuthzResource: "reports", ExtensionAuthzVerb: ""}),
	}), Options{})
	require.Equal(t, map[string]string{
		"GET /a": "x-grafana-declared-authz-subresource must be a non-empty string",
		"/a":     "no operation is served",
		"GET /b": "x-grafana-declared-authz-verb must be a non-empty string",
		"/b":     "no operation is served",
	}, reasons(problems))
}

func TestParseKindRouteNeedsASubresource(t *testing.T) {
	_, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/namespaces/{namespace}/things/{name}/": get(),
	}), Options{})
	require.Equal(t, map[string]string{
		"/namespaces/{namespace}/things/{name}/": "a kind route needs a subresource below things/{name}/",
	}, reasons(problems))
}

// The operations of one path share it, so they must agree on which parameter
// catches the rest of it.
func TestParseCatchAllExtensionsMustAgree(t *testing.T) {
	marked := func(name string) *spec3.Operation {
		o := &spec3.Operation{}
		o.AddExtension(CatchAllExtension, name)
		return o
	}
	_, problems := Parse(testVersion(map[string]spec3.PathProps{
		"/files/{path}": {Get: marked("path"), Put: marked("other")},
	}), Options{})
	require.Equal(t, map[string]string{
		"/files/{path}": "operations disagree on x-grafana-catch-all: path and other",
	}, reasons(problems))
}

func TestProblemError(t *testing.T) {
	require.Equal(t, "/a: why", Problem{Path: "/a", Reason: "why"}.Error())
	require.Equal(t, "GET /a: why", Problem{Path: "/a", Method: "GET", Reason: "why"}.Error())
	require.Equal(t, "v1 GET /a: why", Problem{Version: "v1", Path: "/a", Method: "GET", Reason: "why"}.Error())
}

// Any method can be one the server does not serve, and the declared name is
// matched without regard to case.
func TestParseUnservedMethodsAnyMethod(t *testing.T) {
	op := &spec3.Operation{}
	all := spec3.PathProps{Get: op, Head: op, Post: op, Put: op, Patch: op, Delete: op, Options: op, Trace: op}
	routes, problems := Parse(testVersion(map[string]spec3.PathProps{"/all": all}), Options{
		UnservedMethods: []string{"get", "HEAD", "Post", "put", "patch", "delete", "options", "trace", "CONNECT"},
	})
	require.Empty(t, routes)
	require.Len(t, problems, 9, "each removed method, and the path left with none")
}
