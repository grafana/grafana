# Manifest custom routes

`manifestroutes` resolves the custom routes an app manifest declares in each
version's `openapi.paths`, and reports the ones that cannot be served. The
plugin router uses it to mount routes. It is written to be copied into
grafana-app-sdk unchanged, so that codegen can reject a bad manifest when it
is generated instead of the router skipping routes when it is loaded.

It imports only the standard library, `github.com/grafana/grafana-app-sdk/app`
and `k8s.io/kube-openapi/pkg/spec3`.

## API

- `Parse(version, Options) ([]Route, []Problem)` resolves one version's paths.
  Each `Route` says where it mounts: the version, the namespace, or the object
  of a kind. It also has its `net/http` `ServeMux` pattern and the path to
  publish in a spec. A path that cannot be served is returned as a `Problem`
  and left out.
- `Validate(manifest, Options) error` joins the problems of every version, for
  codegen.
- `Options` holds what depends on the host. The plugin router reserves the
  `app` settings resource and does not serve `TRACE` or `OPTIONS`.

## Rules

Paths are relative to the version root. A path under `namespaces/{namespace}/`
is namespaced. A path of the form `{plural}/{name}/<subresource>` is a
subresource of one object of that kind, at the kind's own scope.

A path is reported when it:

- shadows the version root, a kind's own paths, the `status` subresource, a
  reserved resource, or the namespace mount point;
- puts a kind route at the wrong scope;
- has a parameter that is not a whole segment (`v{version}`), constrains its
  value (`{id:[0-9]+}`), or is not a clean path (`a//b`, `a/../b`);
- matches the same requests as an earlier path, in path order;
- has no operation left once unserved methods are removed. An unserved method
  on a path that still has others is reported on its own.

Parameter names do not need to be Go identifiers: `{flag-key}` is matched as an
ordinary wildcard.

## Catch-all segments

The last segment can match the rest of the path, slashes included. Three
spellings are accepted:

- `{path:*}`, the go-restful form;
- `{path...}`, the `ServeMux` form;
- `{path}` with `x-grafana-catch-all: path` on its operations, which is how
  app-sdk writes a catch-all in OpenAPI.

OpenAPI has no catch-all syntax, so the published path is always `{path}`.

## Copying into app-sdk

Copy `routes.go` and `routes_test.go` into a new package, for example
`app/manifestroutes`. The only import to change is the package's own name.
Codegen can then call `Validate` on the manifest after the version OpenAPI is
built, and fail with the joined error. A plugin manifest should be validated
with the router's options, since that is where it will be served:

```go
manifestroutes.Options{
	ReservedResources: []string{"app"},
	UnservedMethods:   []string{http.MethodTrace, http.MethodOptions},
}
```

Once app-sdk ships the package, the router can import it from there and this
copy can be removed.
