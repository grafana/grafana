# Plugin Route handler

`NewHandler(pluginID, manifest, Options)` builds one plugin's API server as an `http.Handler`.
It lives in `pkg/services/pluginsintegration` because it connects plugin definitions
to Grafana's API server, storage, and access control. These dependencies belong in
the main Grafana module, outside the standalone `pkg/plugins` module and `pkg/router`.

Manifest kinds, custom v3 routes, admission, kind authorization, secret caching,
and manifest OpenAPI processing live in this package. `BuildOpenAPI` renders the
same API's spec offline; see [Rendering the spec offline](#rendering-the-spec-offline).

Manifest handlers serve only the manifest's declared kinds, routes, and served
versions. Settings and their subresources are served exclusively at
`/apis/{plugin-id}/v0alpha1`. The embedded appplugin API server handles settings; the router prepares one
backend per manifest. Settings never appear under the manifest's
`ext.grafana.app` group, even when `appplugins.loadAppManifestAndKeepSettings` is enabled.

The router loads plugin APIs and manifests independently of
`appplugins.registerAPIServer` and `appplugins.loadAppManifest`.
`appplugins.registerAPIServer` controls shared-server settings registration only.
Manifest APIs require the router.

Each handler has its own scheme and storage options. `UnifiedStorage` adapts a
shared resource client to that scheme and accepts a REST config provider for
parent-folder lookups. The router supplies the embedded server's provider so folder
existence and repository-manager consistency checks run for routed plugin kinds.
Settings migration remains the responsibility of the embedded settings server.

The caller owns authentication and must populate `identity.Requester` in the
request context. The handler then checks namespace access, plugin access, and
manifest kind policies. Resource and folder permissions remain enforced by
unified storage. During the transition, `appplugin.RegisterAPIService` still
declares manifest roles and resolves wildcard settings storage configuration at
startup, including for plugins whose API is served by the router. Callers outside
that registration path must provision roles and configure their dual-write service
for the plugin's settings resource before constructing a handler.

No listener or background server hooks are started. After stopping and draining
requests, callers can release storage with `Handler.Destroy()`. The router's
existing backend contract has no teardown hook, so handler retirement there
still follows the router's current lifecycle.

## Manifest resources

Each manifest kind is stored as an unstructured resource in unified storage.
The registration honors:

- namespaced or cluster scope;
- folder scoping for namespaced resources (enabled by default);
- OpenAPI schema validation, pruning, and defaults;
- a `/status` subresource when the schema declares `status`;
- additional printer columns and server-side apply managed fields;
- `/search` and `/trash` routes for eligible kinds; and
- manifest-declared version routes and kind subresource routes, forwarded to
  the plugin's v3 route service.

The manifest group must be a DNS name ending in `.ext.grafana.app`
(`ValidateManifest`). Only served versions are exposed, with the preferred
version first. The generated OpenAPI document uses each kind's schema for
request bodies, responses, and examples.

## Custom routes

A version's custom routes are the paths in its manifest `openapi` section,
relative to the version root. A manifest from before app-sdk published routes
there only has the deprecated `routes` and per-kind `routes`, which are
converted to the same paths first. The components in the `openapi` section are
published in the spec and replace any component already published under the
same name.

Paths under `namespaces/{namespace}/` are namespaced. A path of the form
`{plural}/{name}/<subresource>` is a subresource of one object of that kind, and
the plugin receives the stored object with the request. Which paths can be
served, including catch-all segments, is decided by
[`manifestroutes`](manifestroutes/README.md), which is written to be copied into
app-sdk so a manifest can be checked when it is generated. A path it rejects is
skipped with a warning, and left out of the spec and the authorizer as well.
The router reserves the `app` settings resource and does not serve `TRACE` or
`OPTIONS`.

The routes are served by a `ServeMux` that wraps the API server's own handler,
inside its filter chain, so a request reaching a route has already been
authenticated and authorized. A request for any other path goes to the API
server. A declared path called with an undeclared method is answered `405`
with an `Allow` header. The generic search, trash, hybrid, and list-keys routes
are mounted on the API server like any other builder's routes.

## Authorization

Requests must first pass the app plugin access check. Manifest roles are then
registered as fixed Grafana roles for the kinds they name. When a manifest has
no roles, default reader and writer roles are bound to the Viewer and Editor
basic roles. Folder permissions still determine access to individual
folder-scoped objects.

Cluster-scoped kinds are reserved for service identities unless the manifest
marks them `userReadable`. End users can only `get`, `list`, or `watch` a user-readable
cluster-scoped kind.

## Admission hooks

A kind can declare mutation and validation operations in its `admission`
block. The plugin v3 protocol returns both the mutated object and the admission
decision from one `AdmissionReview` call, so an operation that declares both is
called once during the mutating phase. Validation-only operations are called
during the validating phase.

`CREATE`, `UPDATE`, `DELETE`, and `*` are supported. `CONNECT` and subresource
writes are not sent to admission because the v3 request cannot represent the
subresource. Plugin errors fail the request closed, warnings are returned to
the client, and a mutation cannot change the object's identity or managed
fields.

Schema validation runs after mutation. A mutation that produces an object that
does not match the manifest schema is rejected before it is stored.

## Rendering the spec offline

`BuildOpenAPI` renders the OpenAPI v3 spec for one served version of a manifest
without storage or a running plugin backend. `grafana cli write-openapi` is
built on it; see the [command's README](../../../cmd/grafana-cli/commands/README.md).

It builds the handler with `NewHandler`, using a no-op REST options getter and
offline stand-ins for the plugin, search, and resource store clients, and then
requests `/openapi/v3/apis/<group>/<version>` from it as a service identity.
The spec is therefore produced by the same code that serves it, rather than by
a separate pipeline that has to be kept in step.

The rendered spec always registers search, trash, hybrid, and list-keys
routes, since it describes every route a plugin can get. The usual per-kind
eligibility rules still apply: trash is limited to dashboards, and hybrid
requires `search.hybrid: true` on a namespaced kind.

To compare with a running server:

```sh
curl -s -u admin:admin \
  http://localhost:3000/openapi/v3/apis/<group>/<version> | python3 -m json.tool --indent 2 > server.json
grafana cli write-openapi ./dist/app-sdk-manifest.json --api-version <version> -o cli.json
diff <(python3 -m json.tool --indent 2 cli.json) server.json
```

Expect differences only where the server's configuration disables the generic
routes the rendered spec always includes.
