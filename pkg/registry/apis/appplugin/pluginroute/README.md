# Serving an app plugin's API group from the router

For anyone wiring the Grafana router's **plugin mode**, and for anyone changing how a
plugin group is stood up outside Grafana. The short version: **this is not a proxy.**
Forward mode reverse proxies a group to an API server that already exists; here there is
no server to proxy to, so one is built from the plugin's manifest and its handler is what
the router serves.

```go
backend, err := pluginroute.New(plugin, pluginroute.Options{
    ResourceVersion: routeBackend.ResourceVersion, // what the router reconciles on
    BuildVersion:    cfg.BuildVersion,
    Storage:         pluginroute.UnifiedStorage(unified, secrets),
    ClientV3:        clientV3, // the plugin's protocol v3 client
    AccessControl:   accessControl,
    Search:          unified,
})
```

`backend` is a [`router.Backend`](../../../../router/types.go). The router calls `Load`
when the group is new or its `RV` changed, and serves the returned handler for every
`/apis/<group>/...` and `/openapi/v3/apis/<group>/<version>` request in that group.

## What Load builds

The same pipeline a Grafana server runs for this plugin, over one group:

1. `appplugin.NewAppPluginAPIBuilder` — the group's kinds, settings API, custom routes,
   admission and authorizer, all read off the manifest.
2. `builder.SetupConfig` — the OpenAPI definitions and post-processors, the admission
   chain, and the Grafana handler chain.
3. `GenericAPIServer` with the getter `Options.Storage` builds, then `InstallAPIGroup`,
   then `AugmentWebServicesWithCustomRoutes`. The second step is easy to miss and says
   nothing when it is: the manifest's own routes are not resource storage, so
   `InstallAPIGroup` does not mount them, and a path nobody mounted is a plain 404 with no
   error behind it.
4. `PrepareRun`, which installs the `/openapi/v3` endpoints. **The router proxies
   `/openapi/v3/apis/<group>/<version>` to this handler**, so skipping this step does not
   cost a document nobody reads — it 404s an endpoint the router advertises.

The server is never `Run`: the router owns the listener. Post start hooks are not run
either, because a hook's goroutines would outlive the handler — the router replaces a
group's handler whenever its config changes, with no way to tell a hook to stop.

[`pluginopenapi`](../pluginopenapi) assembles the same server to render a spec offline,
with storage and the plugin client stubbed out. The two are deliberately alike; if the
pipeline changes here, it changes there.

## Identity has to arrive before the handler

Wrap the handler in middleware that resolves the caller and puts it on the request context
with `identity.WithRequester`, the way Grafana's own HTTP middleware does ahead of its API
server. This cannot be done with an entry in `Options.Authenticators`: the group is
authorized inside the Kubernetes handler chain, which runs *before* the filter that maps a
Kubernetes user onto a Grafana requester, so an identity that only arrives with
authentication is not yet there when the group's authorizer looks for it.

Everything fails closed if you skip it. A request nothing authenticated is answered `401`,
and a caller the group cannot check access for — no `AccessControl` configured — is
answered `403`. Neither is an unchecked success, and neither is the `500` that reaching the
handler chain with no requester would produce.

Remember that the router's port sits outside the Kubernetes handler chain entirely: no
authn, authz, audit or priority-and-fairness runs in front of it. The middleware you wrap
this handler in, and whatever already-authenticated hop the port sits behind, are the whole
of the group's security.

## What the router advertises

`Manifest()` is not the manifest as written — the router synthesizes `/apis` and the
`/openapi/v3` index from it, so it describes what is actually served:

- **The group** falls back to the plugin id when the manifest declares none. The router
  keys on it, and would otherwise advertise a group with no name.
- **The settings version** (`v0alpha1`) is added when the manifest does not mention it.
  Every app plugin serves its settings API either way; leaving it out would keep it out of
  `/apis` and the OpenAPI index while the group still answered on it.
- **Unserved versions** are dropped, and the preferred version is first.

## Storage is per group, not per process

`Options.Storage` is a function rather than a ready `RESTOptionsGetter` because each group
gets its own scheme, and a getter carries the codec its stored objects are encoded with. A
codec built from one group's scheme cannot encode another group's kinds — the scheme it
converts through has never heard of them. So one getter cannot be shared across the groups
a process serves, the way it is in a Grafana server where every group shares one scheme.
`UnifiedStorage` is the provider for the ordinary case: one storage client, one getter per
group.

## Dual writing the settings resource

A plugin's settings predate unified storage — they lived in the `plugin_setting` table —
so a deployment part way through that migration still serves them from there. Give
`Options` a `LegacySettingsStore` and a `DualWrite` service and the settings resource is
served through the same dual writer a Grafana server serves it through, at whatever mode
`[unified_storage.<resource>.<group>]` configures (or the `app.*-app` wildcard). With
either missing there is nothing to decide between, and settings come from unified storage
alone.

The manifest kinds are never dual written: they have only ever lived in unified storage,
so there is no legacy table to weigh against.

`builder.NewDualWriteBuilder` is the shared decision — the same one `InstallAPIs` uses, so
a resource is served from the same storage whichever server it is reached through.

## Known gaps

- **Storage is not torn down by the router.** `Destroy` releases what the last `Load`
  installed, but the router has no teardown seam and closing storage under in-flight
  requests would cut them (see the draining note in `pkg/router/AGENTS.md`). Until it has
  one, a rebuilt group leaks its predecessor's storage.
- **No legacy settings storage.** Settings come from unified storage. The legacy
  `plugin_setting` table is reached through a SQL store the router process does not have,
  so a deployment still dual-writing settings should not serve that plugin from here.
- **The handler chain's collectors belong to the last group loaded.** They are created per
  chain under a fixed name, and registered with promauto, which panics rather than returns
  on a registry that refuses one -- so a second group, or a group being rebuilt, would take
  the process down. `replacingRegisterer` re-registers over what is there instead, which
  means an earlier chain observes into a collector the registry no longer holds. Today that
  is only the watch establishment histogram, and the router proxies no watch requests at
  all. Revisit if the chain ever registers a collector that records ordinary requests.
