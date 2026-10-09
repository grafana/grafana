# Manifest custom routes

`manifestroutes` resolves the custom routes an app manifest declares in each
version's `openapi.paths`, and reports the ones that cannot be served. The
plugin router uses it to mount routes. It is written to be copied into
grafana-app-sdk unchanged, so that codegen can reject a bad manifest when it
is generated instead of the router skipping routes when it is loaded.

It imports only the standard library, `github.com/grafana/grafana-app-sdk/app`,
`github.com/grafana/authlib/types` and `k8s.io/kube-openapi/pkg/spec3`, all of
which app-sdk already depends on.

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
- differs from an earlier path only in parameter names (`/items/{id}` and
  `/items/{name}`), which OpenAPI does not allow even when the methods differ.
  A catch-all counts as an ordinary parameter here, since it is published as
  one;
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

## Declared access checks

An operation can declare the access check a request must pass, with the
extensions app-sdk codegen writes from a route's `authz` section:

| Extension | Meaning |
| --- | --- |
| `x-grafana-declared-authz-resource` | the resource checked; required for a check |
| `x-grafana-declared-authz-subresource` | the subresource checked, if any |
| `x-grafana-declared-authz-verb` | the verb checked; without it, the request's own verb |

`Route.Authz` holds the resulting `authlib.CheckRequest` for each operation, by
HTTP method. Group, namespace and name come from the request, so the server
fills them in, and it fills in the verb from the request when none is
declared. The plugin router runs these checks before calling the plugin. An operation whose declaration cannot be read, such as a verb
or subresource without a resource or an unknown verb, is reported and not
served.

The extensions must be on the operation. A path's own extensions are not
available, because `ManifestVersionOpenAPI.Paths` holds `spec3.PathProps`,
which has no extensions.

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
