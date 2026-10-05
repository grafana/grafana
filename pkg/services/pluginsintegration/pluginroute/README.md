# Plugin Route handler

`NewHandler(plugin, Options)` builds one plugin's API server as an `http.Handler`.
It lives in `pkg/services/pluginsintegration` because it connects plugin definitions
to Grafana's API server, storage, and access control. These dependencies belong in
the main Grafana module, outside the standalone `pkg/plugins` module and `pkg/router`.

Manifest kinds, custom v3 routes, admission, kind authorization, secret caching,
and manifest OpenAPI processing live in this package. `NewAPI` selects the manifest
implementation for plugins with manifests and `appplugin.AppPluginAPIBuilder` for
settings-only plugins. Offline OpenAPI generation uses the same selection.

The handler serves group and resource discovery, manifest kinds, settings and their
subresources, custom v3 routes, and OpenAPI v3. `APIGroup(plugin, opts)` describes the
same served versions, including the existing settings version and excluding
manifest versions with `served: false`. Plugins without a manifest keep their
plugin ID as the API group and serve settings and their subresources at `v0alpha1`.
When the router middleware is enabled, it serves both kinds of plugins;
`RegisterAPIService` leaves API installation to the router. The router always loads
plugin APIs and manifests, independently of `appplugins.registerAPIServer` and
`appplugins.loadAppManifest`; `appplugins.registerAPIServer` controls shared-server settings registration only.
Manifest APIs require the router. Settings are included in manifest APIs only when
`appplugins.loadAppManifestAndKeepSettings` is enabled and a v2 client and context
provider are available.

Each handler has its own scheme and storage options. `UnifiedStorage` adapts a
shared resource client to that scheme and accepts a REST config provider for
parent-folder lookups. The router supplies the embedded server's provider so folder
existence and repository-manager consistency checks run for routed plugin kinds.
Supplying a legacy settings store and a dual-write service preserves the embedded
server's settings migration policy.

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

The manifest group must be a DNS name ending in `.ext.grafana.app`. Only served
versions are exposed, with the preferred version first. The generated OpenAPI
document uses each kind's schema for request bodies, responses, and examples.

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
