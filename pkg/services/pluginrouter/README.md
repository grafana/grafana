# Running the router over local app plugins

The `plugin-router` dskit module. For anyone trying the Grafana router out against plugins
on disk, and for anyone changing how those plugins become routes. The short version:

```sh
grafana server target cfg:target=plugin-router
```

discovers every installed app plugin that carries an app-sdk manifest and serves each one's
API group in process, on the ordinary Grafana port:

```
http://localhost:3000/apis/<group>/<version>/...
http://localhost:3000/openapi/v3
```

The group is the one the plugin's manifest declares, or the plugin id when it declares
none. `/` sends you to `/login`, and once you are signed in, on to `/swagger` — Grafana's
API navigator, which reads `/openapi/v3` for its document picker, so every plugin group is
browsable there with no extra wiring.

This is experimental, and **it only runs when `app_mode = development`**. There is nothing
to configure: no ini section, no flags. See Security below for why the target refuses to
start anywhere else rather than offering a setting.

## What the module is made of

The router itself is generic and knows nothing about plugins — it is a reconcile engine
behind a `RoutesLoader`, and owns no listener (`pkg/router/AGENTS.md`). This module is
everything it leaves to its caller:

- **[`PluginDeps`](deps.go)** — the plugin stack, built by
  `server.InitializePluginRouterDeps` from the CLI wire set. It is the same set of components a
  Grafana server builds, because a plugin backend cannot be started without most of them:
  the database the plugin stack keeps its state in, access control for the roles a plugin
  declares, external service accounts, the core plugin registry the backend factory comes
  from. What this target leaves out is the HTTP server in front of all of it.
- **[`Loader`](loader.go)** — the `RoutesLoader`. Rescans the plugin sources on every
  `Load` and returns one
  [`pluginroute.Backend`](../../registry/apis/appplugin/pluginroute) per app plugin that
  carries a manifest. A plugin it cannot build is logged and dropped, never returned as an
  error: `Load` reports one desired state, so failing it would take down every other group
  along with the bad one.
- **[`Service`](service.go)** — the dskit service. Runs the plugin store as a subservice
  (so plugin backends come up before their groups are served, and stop with the module),
  builds the loader, runs the router's reconcile loop, and mounts `HandleFunc` under
  `/apis` and `/openapi/v3`.
- **[`loginGate`](login.go)** — `/login`, `/logout`, and the session that turns a signed-in
  request into one the groups will serve. Every request to a group goes through it.
- **[`swaggerUI`](swagger.go)** — `/swagger` and the assets it loads under `/public/`. The
  page is Grafana's own bundle, so it needs a frontend build (`yarn build`); without one
  `/swagger` answers 503 saying so rather than 500. The endpoints it also looks for — the
  user, the frontend settings, the core Grafana specs — are not this target's, and the page
  already degrades when they are missing.

It owns no listener. This target already runs one HTTP server — the instrumentation
server, on `http_addr` and `http_port` — so everything here mounts onto that server's mux
instead of opening a second port with a second address to configure. `/metrics`, `/livez`
and `/readyz` there are unaffected; the module reports the router's readiness through the
same health notifier the instrumentation server's `/readyz` answers from, so the port only
goes ready once a group has actually loaded.

Nothing mounts at the root as a prefix — `/` is an exact match — because that mux carries
routes this module does not own.

## Configuration

There is none. `target` is a root-level ini key, so `target = plugin-router` in the config
file starts it the same way the command line does, and nothing else about this module is
configurable.

Storage needs no configuration either: the module serves through this process's own
backend, the same embedded one a plain `grafana server` uses, so the default
`storage_type = unified` is all it needs. Any other storage type is refused at startup --
there is no remote mode yet.

The settings resource is dual written exactly as it is on a Grafana server: the module has
the `plugin_setting` table and the dual write service, so `[unified_storage.*]` modes are
honoured here too, and a deployment part way through that migration reads and writes the
same storage it would otherwise. Manifest kinds are unified-only, having never lived
anywhere else.

## Security: read this before pointing anything at it

The router's port sits outside the Kubernetes handler chain — no authentication,
authorization, audit or priority-and-fairness runs in front of it. A group served here
reads its caller from the request context, which in Grafana is put there by middleware that
has already authenticated the request. There is no such middleware in front of this port.

What stands in is `/login`. **Authentication there is the real thing**: the form is handed
to `authn.Service`'s form client — the same one Grafana's own login page posts to — so
callers are real Grafana users with real passwords, and everything that hangs off that
(hashing, login attempt limiting, whatever else is configured) applies here too. A caller
that passes gets a session cookie. Without one, `/apis` and `/openapi/v3` still answer (the
router synthesizes those) but every group behind them answers `401`.

**Authorization is not.** A signed-in caller runs as Grafana's *service identity*, with full
access to every group served, rather than as themselves. The groups' own authorizer asks
access control whether the caller may reach that plugin, which a real user is unlikely to
have been granted, so serving each caller their own permissions is a change with its own
consequences — it is the next step, not this one. The session already carries the real
caller, so it is a small one.

Proving who you are and then being granted everything is a development posture, so
`ProvideService` refuses to start unless `app_mode = development` — a setting could be put
in the wrong place, and a refusal cannot. Two things are still missing before that could be
revisited: this port runs outside the Kubernetes handler chain (no audit, no
priority-and-fairness), and the session cookie is this package's own, not Grafana's session
token, so it has no rotation or server-side revocation. See `loginGate` in
[login.go](login.go).

## Reaching the plugin

A group's admission hooks, conversion and custom routes all dispatch to the plugin's
protocol v3 backend. The client is lazy (`v3.NewLazyClient`), resolved on the request that
needs it rather than when the group is built: the store starts backends on its own
schedule and the router may well build a group first, so resolving early would write a
plugin off for the life of the process.

With no loader wired there is no backend to reach, and `unavailableClient` reports that
rather than being nil — a kind that declares admission is refused a nil client when its
storage is built, which would cost the plugin its entire API group over one hook.

## What does not work yet

- **OSS only.** `server.InitializePluginRouterDeps` is registered from
  `pkg/server/bootstrap/wire`, which is an OSS-only package; an enterprise build has no
  equivalent yet and the module fails at startup saying so, rather than running without a
  way to reach a plugin.
- **Bundled datasources do not start.** The store loads every plugin, including the
  datasources shipped with Grafana, and a backend-only checkout has no binaries built for
  them. Each logs `Could not start plugin backend` and is skipped. None of them is an app
  plugin, so nothing this target serves is affected.
- **No secure values.** Decrypting them needs a service this process does not have, so a
  kind with inline secure values cannot be read.
- **No folders.** A kind with folder support can be written into a folder by name, but
  nothing in this process serves the folder API, so the name is never resolved to a real
  folder and root-folder writes are still refused.
- **Nothing signals a reload.** `Notify` never fires: the plugins are files read by a
  process that does not install or update them. A plugin added after startup is picked up
  only on restart — `Load` rescans, so the wiring is already there if something ever does
  signal.
