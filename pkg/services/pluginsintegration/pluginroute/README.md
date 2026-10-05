# Plugin Route handler

`NewHandler(plugin, Options)` builds one plugin's API server as an `http.Handler`.
It lives in `pkg/services/pluginsintegration` because it connects plugin definitions
to Grafana's API server, storage, and access control. These dependencies belong in
the main Grafana module, outside the standalone `pkg/plugins` module and `pkg/router`.

This is the first step toward replacing `pkg/registry/apis/appplugin`. The handler
temporarily reuses that package's resources, authorization, admission, and legacy custom
routes; `appplugin.RegisterAPIService` remains available during the transition.

The handler serves group and resource discovery, manifest kinds, settings and their
subresources, custom v3 routes, and OpenAPI v3. `APIGroup(plugin, opts)` describes the
same served versions, including the existing settings version and excluding
manifest versions with `served: false`. Plugins without a manifest keep their
plugin ID as the API group and serve settings and their subresources at `v0alpha1`.
When the router middleware is enabled, it serves both kinds of plugins;
`RegisterAPIService` leaves API installation to the router. The router always loads
plugin APIs and manifests, independently of `appplugins.registerAPIServer` and
`appplugins.loadAppManifest`; those flags control the legacy registration path.

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

Custom routes in `versions[].openapi.paths` are intercepted inside the API server's
authenticated handler chain, before resource dispatch. Namespace and plugin access
checks still apply. Operations with `x-grafana-declared-authz-resource` also use
`Options.RouteAuthorizer`, with the declared verb and subresource (the verb defaults
to the lowercase HTTP method). A missing route authorizer fails closed for these
operations. For cluster-scoped routes, the permission check uses the caller's
tenant namespace while the route metadata remains cluster-scoped. The router
supplies the Grafana access client.

For a kind's `/{resource}/{name}/...` route, the handler reads the parent through
its registered storage, decrypts its secure values, and forwards it with the route
metadata through `ClientV3.CallRoute`. Failed authorization, reads, or decryption
stop the request before calling the plugin. The new paths and their components
are included in OpenAPI v3 discovery.

`testdata/appsdktest-manifest.json` is a snapshot from `example-appsdktest-app`.
To exercise a locally regenerated manifest, set `PLUGIN_ROUTE_TEST_MANIFEST` to
its absolute path and run:

```sh
go test ./pkg/services/pluginsintegration/pluginroute -run TestExample -count=1
```

These tests use real handler and storage wiring with
stubbed plugin RPC, storage responses, and decryption; they do not launch the plugin.
