# AGENTS.md — Grafana Router

Guidance for AI agents working on the Grafana Router. This is a generic internal reverse-proxy
router: microservice (m2m) and user-facing API traffic can be routed through it. Routes are supplied
by a `RoutesLoader` as `[]Backend`, and change infrequently (roughly weekly) as plugins/apps are
introduced via GitOps, plus new versions over time.

## Package layout

Everything lives here in OSS.

- `GrafanaRouter` (`router.go`: the reconcile engine — `Run` drives the reconcile loop only;
  `HandleFunc` is the serving handler), `forwardBackend` (the per-group `Backend`, `forward.go`), and
  the `RoutesLoader` / `Router` / `Backend` contracts (`types.go`). It is a pure reverse proxy to the
  backing API servers. **Serving (the `http.Server`, listener TLS, graceful shutdown) is NOT here**
  — see Lifecycle below.
- `dummyRoutesLoader` (`dummy.go`) — the OSS default: two static dummy API groups.
- `cloudLoader`/`ProvideCloudRoutesLoaderFactory` (`cloud_router.go`) — the concrete `RoutesLoader`
  that reads RouteBackend/AppManifest custom resources off a remote control-plane apiserver. Only
  activates when `[cloud_router].appmanifest_apiserver_url` is configured (see Settings below); otherwise
  `ProvideRoutesLoader` (`loader_factory.go`) falls back to the dummy loader. This is the one file in
  the package that knows deployment-specific kinds (`v1alpha2.RouteBackend`/`AppManifest`) — keep that
  knowledge contained here, out of `router.go`/`types.go`.

## `cloud_router`: source resources & correlation

`cloudLoader.Load` (`cloud_router.go`) lists two kinds and joins them in `combineByName`:

- **`RouteBackend`** (v1alpha2) — the primary driver: one backend per group, its target URL, TLS,
  and mode (Forward / Operator / Plugin).
- **`AppManifest`** (v1alpha2) — provides group + manifest spec, needed only for Operator/Plugin
  modes.

Join: index manifests by `AppName`, correlate with backends by `Name`. The route's `Key()` is the
backend's resource version for Forward mode, or `backendRV-manifestRV` for Operator/Plugin (so a
change to either object changes the key). One backend owns all versions of a group; the router
relies on this (it keys by group).

**Core groups without an AppManifest CR.** Some groups (folder, dashboard, secret, and other core
apps built into Grafana) have a `RouteBackend` but no `AppManifest` CR registered in the apiserver —
they aren't managed through the App Platform's manifest-CR flow. `combineByName` falls back to
`l.coreGroupsWithoutManifests`, built once at construction by
`getAPIGroupsForCoreGroupsWithoutManifests()` from `pkg/storage/unified/resource.AppManifests()` —
the same embedded `ManifestData` compiled into this binary that the apiserver itself uses, indexed
by `AppName`. The fallback's fingerprint component is the constant `embeddedManifestKey`
("embedded"), since there's no CR to version — it only changes on redeploy. CR-sourced manifests are
always tried first; a backend is skipped with a warning only when **both** lookups miss.

**Firing on both kinds via `Watcher()`.** `Watcher()` returns a `SimpleWatcher` whose
Add/Update/Delete all push a pure edge to the buffered-1 `dirty` channel (coalesces bursts).
`cloudLoader.starting` builds one informer per source kind and attaches this same watcher to each
via `AddEventHandler`, so both `RouteBackend` and `AppManifest` (both v1alpha2, what `Load` reads)
wake the router. The informers exist only as change-detectors — the payload is irrelevant; they just
fire the edge and `Load` re-reads full state. The signal carries no resource version: resource
versions across kinds are not comparable, and the per-group `Key()` is derived only after
`combineByName` correlates the two objects, so the edge is information-free by design.

**Startup.** Don't depend on the informer's start-up replay (OpinionatedWatcher-style Add replay) as
the trigger for the first build — `Run` does an explicit initial `Load` before waiting on `Notify`;
if replay also fires, it coalesces into one extra, idempotent reconcile. Correct either way.

## Rule: never delete interfaces in `types.go` without human sign-off

The contracts in `types.go` (`Router`, `RoutesLoader`, `Backend`) are kept deliberately, including
any that look currently unused. They mark seams for planned work — e.g. `Router.HandleFunc(w, r,
next)` keeps the delegation seam so the router can later be mounted inside another handler chain,
not only as the standalone `GrafanaRouter`. Do **not** remove or narrow an interface here as part of
a refactor; if one seems dead, ask the human first. (This rule exists because an earlier refactor
dropped `Router` while unifying the serving types — the interface was future-facing, not dead.)

## Scope (current)

- **CRUD + List only. No Watch.** No long-running/streaming requests are proxied here.
- **HTTP/1.1 is sufficient.** No upgrade/websocket/SPDY handling required. `httputil.ReverseProxy`
  is an adequate proxy primitive; the `UpgradeAwareHandler` machinery from kube-aggregator is
  deliberately *not* pulled in.
- **Forward mode implemented; Operator/Plugin modes are TODO** (`buildBackendConfig` returns a
  `buildErr` for non-forward modes for now).
- If Watch or upgrades are ever added, revisit: reverse proxy flushing, upgrade-aware handling,
  and per-request timeouts all change.

## Serving split: engine here, listener in the factory

`GrafanaRouter` (`router.go`) is the reconcile **engine** only: `Run` drives the reconcile loop
(fire-and-forget goroutine + a `routerState` machine behind `Ready`/`Alive`), and `HandleFunc(w, r,
next)` is the single serving handler. **There is no `http.Server` in this package.**

The dskit `router` target runs through `Service` (`service.go`). It mounts `gr.HandleFunc` on the
module server's instrumentation listener, alongside `/metrics`, `/livez`, and `/readyz`; readiness
is reflected through the shared health notifier. There is no separate listener/TLS configuration
anywhere else — see Lifecycle / ownership below.

`Service.HandleFunc` instruments every request through `routerMetrics` (`metrics.go`: an in-flight
gauge plus a duration histogram labeled by group/status, registered on the caller's own
`prometheus.Registerer` — the module server's shared one in production, a fresh `prometheus.NewRegistry()`
in tests) and logs the outcome (`logging.go`). `ProvideService` takes a `reg` param for this; there
is no private registry the way the old standalone `grafana router` process had one.

`HandleFunc` is the one serving entry point: it covers `/apis` (by group) **and** `/openapi/v3`
(there is no exported OpenAPI handler — `serveOpenAPIV3` is private, reached only through
`HandleFunc`), and falls through to `next` for anything unowned (the standalone command passes
`NotFound`). The `next` seam is kept deliberately so the routing logic can also be mounted as a
delegate in another handler chain — that is the future-facing purpose of the `Router` interface.

Because it sheds the k8s chain, **the caller owns this port's security** — provide TLS and/or keep
the port reachable only behind an already-authenticated hop (mesh/aggregator).

## Core architectural decision: decouple backend lifecycle from the routing table

Two things change independently and must not share a lifecycle:

1. **Backends** — a target service plus its `http.Transport`/reverse proxy and connection pool.
   These are expensive and hold live keepalive connections.
2. **The routing table** — the map of path → backend.

**Keep pools persistent; rebuild the routing table freely.** A single route change must NOT
recreate unrelated backends. Recreating a backend throws away its connection pool, forcing a
reconnect + TLS re-handshake; doing that for *every* backend on *any* GitOps change causes a
latency blip across all traffic when only one route changed.

Implementation: `GrafanaRouter.served` is a persistent `map[group]*handlerEntry`, keyed by group.
Each entry holds the live `Backend` (kept so discovery synthesis reflects what's actually served,
not the raw `Load()` result — see Discovery endpoints below), its resolved `http.Handler`, and
`lastKey`, the fingerprint last applied. On reconcile, groups whose `lastKey` is unchanged are left
untouched, changed/new groups are rebuilt, and removed groups are dropped; then a fresh immutable
`map[group]Backend` snapshot is published via one atomic store. **Connection-pool survival comes
from the shared transport cache, not the Backend identity** (`transportFor`, keyed by
`tlsCacheKey`): rebuilding a group's Backend reuses the cached transport, so its pool survives.
Because reconcile only rebuilds the *changed* group, unrelated backends are never touched.

## Routing table (group-keyed snapshot)

The router serves by **group**, the natural key of the loaded config — not by flattened path
prefixes. `GrafanaRouter.snapshot` is an `atomic.Pointer[map[group]servingEntry]` (handler plus the
group's current key, needed by the `/openapi/v3/apis/<group>/<version>` cache — see Discovery
endpoints below); reconcile rebuilds and stores it, serving loads it lock-free per request.

**Why not a general path mux (e.g. a `PathRecorderMux` port).** A kube-aggregator-style mux flattens
every route into an anonymous `map[prefix]handler` plus a longest-prefix linear scan. That erases
the group at dispatch time and buries the not-found decision, so "path in a group I don't own"
(should fall through to `next`) and "unknown subpath inside a group I do own" (the backend's problem)
collapse into one catch-all. This router has exactly one path grammar — `/apis/<group>/<version>/...`
— so the group is segment #2, an O(1) map key. `HandleFunc(w, req, next)` parses the group, looks it up in the
snapshot, and gives **primacy to the group**: own the group → dispatch to its `Backend`; unknown
group → `next`; the `/apis` root → router-synthesized `APIGroupList`. Keep the config's shape at
dispatch; do not reintroduce a flattening mux. The one idea worth borrowing from `PathRecorderMux`
is the immutable-snapshot-swapped-atomically concurrency model, which the group-keyed snapshot keeps.

- Duplicate group in a single `Load` **overwrites and warns, does not panic** — routes are dynamic
  (GitOps) config, not static code, so a bad duplicate must not crash the router.
- `pkg/router` does depend on `k8s.io/apimachinery` (`metav1.APIGroupList` etc.) and
  `k8s.io/kube-openapi/pkg/handler3` (`OpenAPIV3Discovery`) for the synthesized discovery documents
  — see Discovery endpoints below. These are real k8s wire types reused for exact client-go/kubectl
  compatibility, not the aggregator/apiserver machinery (`PathRecorderMux`, `UpgradeAwareHandler`,
  admission, etc.) — that machinery is still deliberately not pulled in (see Scope above).

## Transports (`cloud_router.go`, `transportFor`)

One `*http.Transport` is built and cached per `tlsCacheKey` (CA data / skip-verify), so backends
with the same TLS settings share a transport and its pool. `MinVersion` is TLS 1.2; a valid
`CaData` PEM builds a `RootCAs` pool. `SkipTLSVerify` from the `RouteBackend` spec maps to
`InsecureSkipVerify` — an intentional, spec-gated escape hatch for trusted internal links, with a
targeted `nosemgrep`/`#nosec` justification. Only enable it for backends whose link is actually
trusted.

## Path model

### Backend Mode: Forward (full API server)

K8s REST paths are formulaic — fully determined by group/version. Implemented.

`NewForwardBackend` (`forward.go`) validates the parsed URL has both `Scheme` and `Host` before
installing the reverse proxy — `url.Parse` alone accepts empty and relative values (`""`,
`/just/a/path`) without error, so without this check a misconfigured group would get published and
fail every request at proxy time instead (502, tripping the per-group breaker) rather than being
rejected when the route is built. Found by PR review.

### Backend Mode: Operator (BaaS-powered App)

TBD. Possibly inspect OpenAPI. Lift admission, mutation and validation hooks here as appropriate.

### Backend Mode: Plugin

TBD. Possibly inspect a manifest. Use a gRPC client to translate http calls via plugin v2 gRPC contract.

## Discovery endpoints

| Path                                          | Owner          | Handling                                     |
| ---------------------------------------------- | -------------- | --------------------------------------------- |
| `/apis/{group}/{version}`                      | single backend | proxy to the owning backend                   |
| `/apis/{group}`                                | single backend | proxy to the owning backend (see decision)    |
| `/apis`                                        | router         | **synthesized** `metav1.APIGroupList`         |
| `/openapi/v3`                                  | router         | **synthesized** `handler3.OpenAPIV3Discovery` |
| `/openapi/v3/apis/{group}/{version}`           | single backend | proxy, cached and key-busted (see below)      |

**Decision: one backend owns ALL versions of a given group.** A group is never split across
backends (reconcile keys `served` by group; a duplicate group is last-wins, and discovery is
synthesized from `served`, so it never advertises both). Consequences:

- `/apis/{group}` (group discovery, `APIGroup` — lists a group's versions) can be **proxied
  directly to the single owning backend**. No cross-backend merge is needed at group level.
- `/apis` (root, `APIGroupList` — the union across every group) and `/openapi/v3` (root, a small
  path→hash discovery index, **never** a merged OpenAPI schema) both require router-side synthesis
  from each backend's `Group()`, done once per `reconcile()` cycle and stored via `atomic.Pointer`
  alongside `snapshot` (`buildAPIGroupList`/`buildOpenAPIV3Index` in `discovery.go`).
- `/openapi/v3/apis/{group}/{version}` (the actual heavy per-group document) is a pure proxy to the
  owning backend, same as `/apis/{group}/{version}` — fronted by a key-validated `sync.Map` cache
  (`openapiDocs` in `router.go`) so repeat requests between manifest changes skip the backend
  round-trip. Cache-miss proxy requests strip `If-None-Match`/`If-Modified-Since` before forwarding,
  so an unrelated backend ETag scheme can't produce a bodyless 304 the router would otherwise have
  no way to distinguish from "unchanged" (see `stripConditionalHeaders` in `openapi_cache.go`). A
  matching `If-None-Match` on this path must set the `ETag` header before writing 304, same as the
  synthesized root docs (`serveCachedDoc`) already do — RFC 7232 requires it, and a 304 with no `ETag`
  breaks clients that revalidate from the 304's own headers rather than caching the prior response's.
  Found by PR review.

If the one-backend-per-group ownership rule is ever relaxed (multiple backends per group),
`/apis/{group}` must become a synthesized merge as well — update this file and the discovery
handler together.

### `serverAddressByClientCIDRs`: intentionally omitted

`metav1.APIGroupList`/`APIGroup` carry a `ServerAddressByClientCIDRs` field (k8s: lets a client pick
a cheaper/closer address to reach the server, based on the client's own IP — e.g. an in-cluster
client dials the internal Service/ClusterIP directly instead of round-tripping out through the
public LB). The router's synthesized `/apis` does **not** populate it:

- Almost no modern client actually reads this field to choose a host (`client-go`'s discovery client
  doesn't); it's legacy from very old bootstrap flows. Adding it would be schema parity, not a fix
  for a real gap, absent a confirmed consumer.
- On individual backends: their own `/apis/{group}` doc never carries this field either, even in
  vanilla k8s — `discovery.NewAPIGroupHandler` builds a static `metav1.APIGroup` at route-install time
  with the field unset; only the root aggregator (`rootAPIsHandler`) patches it per-request. So a
  backend built on `k8s.io/apiserver` needs no extra work here regardless of this decision.
- Deployment-specific reasoning for why this wouldn't help in a given topology (reachable addresses,
  edge LB behavior, etc.) belongs with the deployment. The `cloud_router` loader's router has no
  public IP; external callers only ever reach it via an edge LB/gateway doing an unmodified
  pass-through proxy on `/openapi` and discovery, so there's no second, cheaper address to offer.

Revisit only if a concrete client is confirmed to read the field.

## Notify / reconcile

The signal and the state are split; do not conflate them.

- **`RoutesLoader.Notify` returns a pure coalescing wake signal** (`<-chan struct{}`, buffered 1)
  with **no payload**. The router treats it as a level trigger, not a stream of deltas. How the
  loader produces or coalesces that edge is the loader's concern, not the router's.
- **`reconcile` is level-triggered.** On each wake it calls `RoutesLoader.Load` to re-read the full
  desired set, then converges: upsert changed groups (`lastKey` compare), skip unchanged ones, drop
  groups that disappeared. Safe to run on any wake — dropped signals cost nothing because Load reads
  current truth.
- **Ordering:** receive from the channel *before* calling Load (drain-then-load), so an event during
  a Load leaves a fresh pending wake → a guaranteed follow-up Load. Never lose a change.
- **Initial load is explicit** — `Run` calls `reconcile` once before the select loop, so correctness
  does not depend on the loader replaying existing routes on startup.
- On backend removal, ideally drain in-flight requests before tearing down its transport; never
  close eagerly on swap, or you cut live requests. (Transports are currently shared per
  `tlsCacheKey` and not closed — revisit when per-backend teardown is added.)
- **A closed `Notify` channel must not busy-loop the select.** `case <-dirty:` alone is always
  immediately ready on a closed channel (yielding the zero value forever), so it would call
  `reconcile` — and therefore `Load` — nonstop, burning CPU until `ctx` is cancelled. `Run`'s loop
  checks the receive's `ok` and nils the local `dirty` var on close, parking that `select` case
  permanently (a nil channel is never selected) so only `ctx.Done()` remains live. Found by PR review;
  regression-tested (`TestRunDoesNotBusyLoopOnClosedNotifyChannel`) by asserting `Load` stays bounded
  after closing the channel, not just that the process doesn't hang.
- **`Ready` must not fail on a partial reconcile error — but must fail if nothing has ever been
  served.** A non-nil reconcile error (one group's `Backend.Load` failed) does not stop the router
  serving every other group on last-known-good — that is the whole point of the "keep serving, don't
  advance `lastKey`" design above. Gating `/readyz` (the enterprise command wires `Ready` there) on any
  error would drain the whole router from its LB rotation over one misconfigured group, while it's
  still able to proxy everything else. The first fix for this went too far, though — making `Ready`
  ignore `err` entirely whenever `phase == serving` — and regressed the case where the *very first*
  reconcile fails completely (`loader.Load` itself errors, or every backend fails): the snapshot is
  empty, but readyz would go green anyway, and since this router owns `/apis`/`/openapi/v3` outright,
  clients would get an empty discovery document instead of waiting for a real load. Fixed with
  `routerState.served` (true if `r.served` was non-empty when the state was recorded, computed in
  `storeServing` — the only place safe to read `r.served`, since it's otherwise reconcile-goroutine-
  owned): `Ready` fails only when `err != nil` **and** `!served` — i.e. genuinely nothing has ever
  loaded. A serving-with-error state (with something served) still logs via `storeServing`'s
  `slog.Error`, so the failure isn't silently lost — it's just not conflated with "can't serve
  traffic." Both scenarios found by PR review, in two passes.

## Passive circuit breaking

**Decision: passive-only, not active health probing.** The router does not run a periodic
background probe against each backend (the way kube-aggregator's `AvailabilityController` actively
polls `/apis/<group>/<version>` on a timer to drive `APIService.status.conditions[Available]`).
Instead, a circuit breaker observes real proxied request outcomes (timeout / connection error / 5xx)
and trips per group.

Why not copy kube-aggregator's active approach: that controller's probe exists because
`APIService.status.conditions[Available]` is a first-class, ops-visible object that also gates root
discovery aggregation — an unavailable APIService is excluded from `/apis`, a decision that must hold
even for aggregated groups with near-zero real traffic, so it can't rely on traffic to observe
failure. This router already decoupled discovery from backend liveness on purpose (see Discovery
endpoints and Core architectural decision above): `publish()` synthesizes `/apis`/`/openapi/v3` from
`r.served` (config/install state), not backend health — a group whose reload failed still advertises
via last-known-good. So the reason kube-aggregator needs an independent, traffic-free signal does not
apply here. Active probing would also require a new health-endpoint convention on `Backend` (none
exists today — `Load` only returns a proxy handler) and a per-group background goroutine with its own
start/stop lifecycle tied to group add/remove, which cuts against the "reconcile only touches the
changed group" invariant. Revisit only if a specific group's real traffic proves too sparse for
passive signal to trip in a useful time window.

Library: not hand-rolled. Use `sony/gobreaker` (closed/open/half-open state machine per Nygard's
*Release It!*), one instance per served group, wrapping the proxied request outcome. Do not
reimplement failure-counting/cooldown/half-open logic from scratch — that's easy to get subtly wrong
(flapping, thundering-herd on recovery) and gobreaker already gets it right.

Implemented in `breaker.go` (per-group breaker + `serveThroughBreaker`), wired into both
`HandleFunc`'s main dispatch and `serveOpenAPIGroupVersion`'s cache-miss path (the cache-hit path
never touches the breaker — it never calls the backend). Two pitfalls found by review, worth knowing
before touching this code again — see `specs/2026-08-19-router-circuit-breaker-design.md` for the full
writeup:

- Any wrapper placed between `ReverseProxy` and the real `http.ResponseWriter` (`statusRecorder` here,
  and the pre-existing `captureWriter`) must forward `Flush` — either via `Unwrap() http.ResponseWriter`
  (if it wraps a real writer) or a no-op `Flush()` (if it doesn't, like `captureWriter`'s in-memory
  buffer). `ReverseProxy` flushes any response with no `Content-Length` on every write; a wrapper
  missing both silently degrades that instead of erroring loudly, so it's easy to miss in review.
- A canceled request context (client disconnect) must be excluded from breaker accounting via
  `gobreaker.Settings.IsExcluded`, checked ahead of status — `ReverseProxy` maps a cancellation to the
  same 502 as a real transport failure, so without the exclusion a few abandoned client requests trip
  the breaker for every other caller on that group.

## Settings (`[cloud_router]`, `cloud_router.go`)

Not documented in OSS `conf/defaults.ini` -- read directly via
`cfg.SectionWithEnvOverrides("cloud_router")`, no `pkg/setting` struct field, since this is an
optional, deployment-specific loader rather than a core Grafana concept. An ini section is never
truly absent (`SectionWithEnvOverrides` always returns a valid, empty section), so `appmanifest_apiserver_url`'s
presence is what actually gates activation, not the section's existence. Keys:

| Key                   | Required             | Meaning                                                                 |
| --------------------- | --------------------- | ------------------------------------------------------------------------ |
| `appmanifest_apiserver_url`       | gates activation      | Base URL of the remote apiserver serving `apps.grafana.app`. Empty -> `ProvideCloudRoutesLoaderFactory` returns `(nil, nil)` and the dummy loader is used instead. |
| `cap_token`           | yes, once `appmanifest_apiserver_url` is set | Grafana Cloud Access Policy token exchanged for a signed access token. |
| `token_exchange_url`  | yes, once `appmanifest_apiserver_url` is set | URL of the token exchange service used to sign `cap_token` per request. |
| `apiserver_ca_file`   | no                    | CA bundle file used to verify the apiserver TLS cert.                    |
| `apiserver_insecure`  | no                    | Skip TLS verification of the apiserver. Dev only.                       |

`appmanifest_apiserver_url` set without `cap_token` or `token_exchange_url` is a hard error, not a silent
fallback to the dummy loader -- a partially configured `cloud_router` section means the operator
meant to enable it, so failing loudly beats silently serving dummy routes.

## Lifecycle / ownership

`GrafanaRouter` runs as the dskit `router` target (`Service` in `service.go`), or as a background
service in the full Grafana server when the router middleware feature is enabled — the embedded API
server invokes it after Grafana authentication and identity setup, with the regular Kubernetes API
server handler as its fallback. There is no standalone `grafana router` process anymore (the old
`RouterFactory`/CLI-command seam was removed once the dskit target could own the loader's lifecycle
directly); the module server's HTTP listener, `/metrics`, `/livez`, `/readyz` are what front it now.

The dskit target gets its `RoutesLoader` from a Wire sub-injector (`server.InitializeRoutesLoader`).
Both editions build it from the same full dependency graph as app-plugin API registration --
`ProvideRoutesLoader`/`ProvideRoutesLoaderWithClients` (`loader_factory.go`) try
`ProvideCloudRoutesLoaderFactory` first and fall back to the dummy loader; there's nothing
edition-specific left to wire (`wireExtsRoutesLoaderSet` in the enterprise `wireexts_enterprise.go`
just points at the same OSS provider now).

- `ProvideCloudRoutesLoaderFactory(cfg)` builds one `rest.Config` for the whole apps group (CAP token
  exchanged for a signed access token per request) and a `k8s.ClientRegistry` from grafana.ini (see
  Settings above), then constructs `cloudLoader`. `cloudLoader` itself implements
  `LifecycleRoutesLoader` (`RoutesLoader` + `services.Service`): its `starting`/`running` build and
  drive the RouteBackend + AppManifest informers (v1alpha2) wired to `Watcher()` as change-detectors.
- **dskit target binding** — `pkg/server`'s `initRouterModule` builds the loader, then the router
  `Service` around it; if the loader also implements `LifecycleRoutesLoader`, it's run alongside the
  router `Service` under one composite `services.Service` (`newCompositeService`), so both start and
  stop together as the one `router` module instead of the loader needing its own process to drive its
  informers.
- **binding** — kept via Wire: `wire.go`'s `InitializeRoutesLoader` plus each edition's
  `wireExts{OSS,Enterprise}.go` `wireExtsRoutesLoaderSet`. Keep those in sync with the generated
  `wire_gen.go`/`enterprise_wire_gen.go` so `make gen-go` reproduces them.

`GrafanaRouter.Run` drives only the reconcile loop (its own goroutine; status via `Ready`/`Alive`).
The listener is the module server's, not this package's or the loader's.

## Security

Per repo policy, scan generated code with semgrep before landing. The group-keyed dispatch has no
injection sinks (the group is used only as a map key; no filesystem, shell, SQL, or template).
The sensitive surface is: proxy code that forwards headers / injects m2m identity/tokens / resolves
target URLs, `transportFor`'s TLS handling (esp. the spec-gated `InsecureSkipVerify` path), and
`cloud_router.go`'s client construction / CAP-token exchange / credential handling.
