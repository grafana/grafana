# Plugin Route handler

`NewHandler(plugin, Options)` builds one plugin's API server as an `http.Handler`.
It lives beside `appplugin` because it assembles that package's resources,
authorization, admission, and custom routes. It has no dependency on `pkg/router`.

The handler serves group and resource discovery, manifest kinds, settings and their
subresources, custom v3 routes, and OpenAPI v3. `APIGroup(plugin)` describes the
same served versions, including the existing settings version and excluding
manifest versions with `served: false`.

Each handler has its own scheme and storage options. `UnifiedStorage` adapts a
shared resource client to that scheme. Supplying a legacy settings store and a
dual-write service preserves the embedded server's settings migration policy.

The caller owns authentication and must populate `identity.Requester` in the
request context. The handler then checks namespace access, plugin access, and
manifest kind policies. Resource and folder permissions remain enforced by
unified storage; manifest role provisioning remains with the existing registration
path while `appplugin.RegisterAPIService` is retained.

No listener or background server hooks are started. After stopping and draining
requests, callers can release storage with `Handler.Destroy()`. The router's
existing backend contract has no teardown hook, so handler retirement there
still follows the router's current lifecycle.
