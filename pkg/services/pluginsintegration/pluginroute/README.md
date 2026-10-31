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
`/apis/{plugin-id}/v0alpha1` by `NewAppSettingsHandler`, which wraps the
[`appsettings`](appsettings/README.md) builder: the single `app` resource, always
named `instance`, with its `health`, `resources` and `proxy` subresources. The
router prepares one backend per manifest, and one settings backend per app plugin.
Settings never appear under the manifest's `ext.grafana.app` group.

The router loads manifests independently of `appplugins.loadAppManifest`.
`appplugins.registerAPIServer` controls whether it serves settings, and in
single-tenant Grafana also turns on the router middleware. Both APIs require the
router.

Each handler has its own scheme and storage options. `UnifiedStorage` adapts a
shared resource client to that scheme and accepts a REST config provider for
parent-folder lookups. The router supplies the embedded server's provider so folder
existence and repository-manager consistency checks run for routed plugin kinds.
Settings use the dual-write service the caller passes in `Options.DualWrite`,
with the legacy store in `Options.Settings.LegacyStore`.

The caller owns authentication and must populate `identity.Requester` in the
request context. The handler then checks namespace access, plugin access, and
manifest kind policies. Resource and folder permissions remain enforced by
unified storage. The router declares manifest roles and resolves wildcard settings
storage configuration at startup. Other callers must provision roles and configure
their dual-write service for the plugin's settings resource before constructing a
handler.

A manifest that declares no kinds has nothing to store, so no API server is built
for it. The handler serves its routes, its group and version discovery, and its
OpenAPI documents directly. It runs the API server's own authentication,
authorization, timeout and cache-control filters, with the same authorizer, so
callers see the same decisions and errors. A routes-only handler needs no
storage provider. Version discovery lists no resources, and the OpenAPI document
describes only the plugin's routes. A manifest that mixes versions with and
without kinds still gets an API server, which has nothing to install for a
version without kinds; the handler serves that version's discovery and OpenAPI
documents the same way, and lists it in the group's discovery.

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
there only has the deprecated `routes` and per-kind `routes`. Those are moved
to the same paths when the manifest is loaded, by
`definition.MigrateDeprecatedRoutes`, so this package never reads them, and
`ValidateManifest` refuses a manifest that still has them. The components in the `openapi` section are
published in the spec and replace any component already published under the
same name.

Paths under `namespaces/{namespace}/` are namespaced. A path of the form
`{plural}/{name}/<subresource>` is a subresource of one object of that kind, and
the plugin receives the stored object with the request. Which paths can be
served, including catch-all segments, is decided by
the app-sdk `routes` package (`github.com/grafana/grafana-app-sdk/routes`), which
also checks a manifest when it is generated. A path it rejects is
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
marks them `userReadable`. End users can only `get` or `list` a user-readable
cluster-scoped kind; watching one is left to service identities.

An access policy is held to the permissions in its own token for every kind,
namespaced or cluster-scoped, because storage is called with a token this
server substitutes or exchanges. The verb checked is the one storage checks:
`list` and `watch` need `get`, `patch` needs `update` and `deletecollection`
needs `delete`. Search, trash and list-keys are reads, so they need `get`, and
any other verb is refused. A subresource such as `status` needs the permission
on its parent kind. Custom routes are left to their declared checks.

A manifest route can also declare an access check on each operation, with the
`x-grafana-declared-authz-*` extensions (see
the app-sdk `routes` package). The route
handler runs it through the configured `AccessClient` before calling the plugin,
and after reading the parent object, so a refused request never has the parent's
secure values decrypted. The check's group is the manifest's, its namespace the
request's, and its verb the declared one or else the one the operation's method
implies, never anything from the URL or query string. A check on the parent's
own resource also names the parent and its folder. A HEAD request that declares
no check of its own gets the GET operation's, and a HEAD request to a route that
declares GET but not HEAD is sent to the plugin as the GET it declared, with the
response body dropped. A route that declares a check is refused when no access
client is configured.

## Local plugin authentication

Without an external token signer, Grafana signs v3 requests with an in-memory
key and passes its public key to the plugin as `GRAFANA_JWKS`. App plugins that
ship an `app-sdk-manifest.json` also receive `API_ACCESS_ROUTER_URL`,
`API_ACCESS_TOKEN_EXCHANGE_URL`, and a process-specific `API_ACCESS_CAP_TOKEN`. The app SDK's `BuildKubeConfig` uses
these to call Grafana through the same token-exchange transport used in Cloud.
Pass the handler's context to the SDK client to act on behalf of the caller;
background requests act as the plugin. No `insecure_skip_authentication` setting
is needed.

The local policy grants the plugin's own `*.ext.grafana.app` group and the
manifest's `extraPermissions.accessKinds`. A plugin acting as itself reaches an
app plugin's API group when its token's permissions name that group, since
unscoped app access would cover every app plugin. Requests on behalf of a caller
also delegate app access (`plugins.app:access`), and are limited by the caller's
own permissions and organization. Cloud deployment policy overrides are not
imported into this local policy.

Local signing requires the `appplugins.loadAppManifest` feature toggle, since
the local policy comes from the plugin's app manifest. Setting `[plugins]
enable_local_plugin_auth = false`, either `[plugins]
v3_cap_token` or `v3_token_exchange_url`, `[auth.extended_jwt] jwks_url`, or the
`GRAFANA_JWKS` or `GRAFANA_JWKS_URL` environment variable disables local signing.
Inherited `API_ACCESS_*` URL, CAP token or bearer token overrides prevent
automatic local API credentials from being injected; forwarded basic-auth
credentials don't, because the app SDK prefers token exchange. Use an app SDK version that supports the JWKS
and token-exchange environment variables, and keep the `grafana` audience in
`[auth.extended_jwt] audiences` (the default).

The key and credentials belong to one Grafana process. Restarting Grafana
invalidates them; stopping, replacing, or failing to start a plugin revokes that
plugin process's exchange credential. This local signer does not provide shared
credentials across Grafana replicas. With a plain HTTP listener on all
interfaces or loopback, plugins reach their own Grafana process on loopback,
so each replica's plugins work behind a load balancer, and the token exchange
(`/api/internal/plugin-token-exchange`) refuses callers that are not on
loopback. The port comes from `[server] http_port`. The loopback check is
defense in depth: a reverse proxy on the same host makes its callers look local,
so the process-specific CAP token is what authenticates a plugin. Plugin API
access also needs `grafana` in `[auth.extended_jwt] audiences`, the default.

Override automatic detection with `[plugins] local_api_url` (or
`GF_PLUGINS_LOCAL_API_URL`):

```ini
[plugins]
local_api_url = https://grafana-instance.internal:8443/grafana
```

The override supplies the complete base URL, including its port and any subpath,
for both API requests and token exchange. It must reach the Grafana process that
started the plugin; a load-balanced public URL cannot provide that guarantee.
An explicit non-loopback endpoint still requires the process's CAP token, but
accepts non-loopback peers so a specific-interface listener or local proxy can
be used. HTTPS uses normal certificate verification.

With local signing enabled, Grafana cannot infer the endpoint for HTTPS,
sockets, specific non-loopback addresses, a dynamic port, or `[server]
enforce_domain` with another domain. It then logs a warning and gives app
plugins no API credentials; Grafana's own requests to plugins are still
authenticated. Set the override to enable plugin API access. An invalid
override, or one whose host conflicts with `enforce_domain`, is a configuration
error at startup. Grafana never falls back to the public `root_url`. External
token-exchange configurations do not use this setting.

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

## Kinds authorized by name

Stars and Preferences are authorized by the owner in an object's name
(`user-<id>`, `team-<uid>`, `namespace`) instead of by folder. Everything the
router knows about them is in `hardcoded_kinds.go`, which stands in for what the
app manifest will declare:

- `ownerFromName` allows a request by its name: the owners a kind accepts, fixed
  names such as `merged`, and whether org admins may do anything. An access
  policy is held to its token's permissions instead.
- A user's list returns only the objects they own, most specific first (their own,
  their teams', the namespace's), and they may not watch. Other identities list
  everything, except that Preferences limits them to the namespace's object.
- A fixed name, `merged`, has no stored object: the kind's `VirtualGetter`
  answers it from the objects the caller owns.
- A custom route for a name with no stored object is still sent to the app
  (`allowMissingParent`), with the name alone.

`grafana.routePreferencesAndCollections` (with `grafana.useRouterMiddleware`)
serves `collections.grafana.app` and `preferences.grafana.app` from the
`apps/collections` and `apps/preferences` apps, run in this process, and stops
the embedded API server registering them. The apps authenticate through the
same local token exchange as a plugin process (see above), so their calls to
Grafana act as the caller. Grafana must sign plugin tokens itself for this.
