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

Storage needs no configuration either: with the default `storage_type = unified` the module
runs the embedded backend, the same one a plain `grafana server` uses, and reads and writes
through it directly. Set `storage_type = unified-grpc` with an `address` and it dials that
storage server instead, leaving the backend it would have built unused.

## Security: read this before pointing anything at it

The router's port sits outside the Kubernetes handler chain — no authentication,
authorization, audit or priority-and-fairness runs in front of it. A group served here
reads its caller from the request context, which in Grafana is put there by middleware that
has already authenticated the request. There is no such middleware in front of this port.

What stands in is `/login`: the credentials from the security section — the same
`admin_user` and `admin_password` a fresh Grafana starts with — checked against a form, and
a session cookie for the callers that pass. A request carrying a live session runs as
Grafana's **service identity**, which is what the groups authorize against. Without one,
`/apis` and `/openapi/v3` still answer (the router synthesizes those) but every group behind
them answers `401`.

`/login` is **not** Grafana's authentication, and the difference is the reason this target
is development-only. There is no user database in this process to look anyone up in, so
there is one credential, it is the same for everyone, and everyone who has it gets the same
full access to every group served. There is no lockout, no rate limit and no second factor.
That is a posture worth having while developing a plugin and worth nowhere else, so
`ProvideService` refuses to start unless `app_mode = development` — a setting could be put
in the wrong place, and a refusal cannot. See `loginGate` in [login.go](login.go).

Real authentication in front of this listener is the work that has to happen before any of
this stops being development-only.

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
