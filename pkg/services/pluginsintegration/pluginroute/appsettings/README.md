# App plugin settings API

`Builder` serves the `v0alpha1` settings resource and its health,
resource, and proxy subresources through the plugin v2 client. It supports legacy
settings storage, unified storage, and the configured dual-write migration policy.
It does not install manifest kinds, custom v3 routes, or admission hooks.

Only `app` is an API server resource. `SubresourceHandler` serves `health`,
`resources` and `proxy` as plain HTTP handlers mounted inside the API server's
handler chain, so they are authenticated and authorized like `app`, and dispatch
on the request info the chain adds. They are not listed in discovery;
`PostProcessOpenAPI` documents them.

Unified storage saves all app settings in the `plugins.grafana.app` group and
`app` resource, with the plugin ID as the object name. The settings API continues
to serve each plugin's group with the name `instance`; storage translates the
group and name for reads, writes, and inline secure value ownership.

[`pluginroute.NewAppSettingsHandler`](../README.md) serves this builder as its own
API server. The router's local plugin loader builds one for every local app plugin
when `appplugins.registerAPIServer` is enabled, with or without a manifest, and serves
it under the plugin ID. In single-tenant Grafana, `appplugins.registerAPIServer`
also turns on the router middleware, since only the router serves settings. The embedded API server
no longer registers it.

The router resolves wildcard settings storage configuration at startup, before the
shared dual-write service starts serving requests.
