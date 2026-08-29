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

- **[`Loader`](loader.go)** — the `RoutesLoader`. Rescans the plugin sources on every
  `Load` and returns one
  [`pluginroute.Backend`](../../registry/apis/appplugin/pluginroute) per app plugin that
  carries a manifest. A plugin it cannot build is logged and dropped, never returned as an
  error: `Load` reports one desired state, so failing it would take down every other group
  along with the bad one.
- **[`Service`](service.go)** — the dskit service. Builds the loader, runs the router's
  reconcile loop, and mounts `HandleFunc` under `/apis` and `/openapi/v3`.
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

## What does not work yet

- **No plugin backend is running.** This process finds plugins on disk; it does not start
  them, so there is no gRPC client to one. The group is still served — reads and writes of
  its kinds work — but anything that needs the plugin itself (admission, conversion, the
  manifest's custom routes) fails closed with `503 the plugin backend is not running in
  this process`. See `unavailableClient` in [loader.go](loader.go) for why that is a
  client that refuses rather than a nil one.
- **No secure values.** Decrypting them needs a service this process does not have, so a
  kind with inline secure values cannot be read.
- **No folders.** A kind with folder support can be written into a folder by name, but
  nothing in this process serves the folder API, so the name is never resolved to a real
  folder and root-folder writes are still refused.
- **Nothing signals a reload.** `Notify` never fires: the plugins are files read by a
  process that does not install or update them. A plugin added after startup is picked up
  only on restart — `Load` rescans, so the wiring is already there if something ever does
  signal.
