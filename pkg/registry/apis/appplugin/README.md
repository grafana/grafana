# App plugin settings API

`AppPluginAPIBuilder` serves the `v0alpha1` settings resource and its health,
resource, and proxy subresources through the plugin v2 client. It supports legacy
settings storage, unified storage, and the configured dual-write migration policy.
It does not install manifest kinds, custom v3 routes, or admission hooks.

`RegisterAPIService` registers settings for plugins without a manifest when
`appplugins.registerAPIServer` is enabled. Manifest plugins are served exclusively
by the [plugin router handler](../../../services/pluginsintegration/pluginroute/README.md);
enable `grafana.useRouterMiddleware` to serve them in single-tenant Grafana.
When that flag is enabled, the router also owns legacy plugins' settings APIs.

Startup reads manifests to identify routed plugins and provision their roles,
independently of `appplugins.loadAppManifest`. It also resolves wildcard settings
storage configuration before the shared dual-write service starts serving requests.

The router may compose this settings builder into a manifest API when
`appplugins.loadAppManifestAndKeepSettings` is enabled. The manifest handler owns
that compatibility choice and the additional versions it exposes.
