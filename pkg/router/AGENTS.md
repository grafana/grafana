# AGENTS.md — Cloud Apps Router

Guidance for AI agents working on the cloud apps router. This is an internal router for Grafana
Cloud: all microservice (m2m) and user-facing API traffic passes through it. Routes are supplied
by a `RoutesLoader` (the concrete loader lives in the enterprise package) as `[]*RouteConfig`, and
change infrequently (roughly weekly) as plugins/apps are introduced via GitOps, plus new versions
over time.

## Package layout (OSS vs enterprise split)

The generic router lives here in OSS; only the loader (which knows the cloud kinds) is enterprise.

- **this package (`pkg/router`, OSS)** — the generic machinery: `GrafanaRouter` (`server.go`: one
  `Run` driving both the reconcile loop and the HTTP listener, group-keyed serving),
  `forwardBackend` (the per-group `Backend`), and the `RoutesLoader` / `Router` / `Backend`
  contracts (`types.go`). `GrafanaRouter` owns the whole standalone process; it is a pure reverse
  proxy to the backing API servers.
- **`.../appmanifest/pkg/app/router` (enterprise)** — only `Loader` (`routes_loader.go`): the
  `RoutesLoader` implementation that produces `[]*RouteConfig` from the cloud control plane. How it
  sources and watches the underlying custom resources is its own concern (see that package's
  AGENTS.md). There is no cloud apps router in enterprise; the loader is the enterprise/cloud-specific
  piece.

This doc stays generic: it must not encode which custom resources the loader watches or how it
triggers — the router only knows the `RoutesLoader` contract. File references below are in this
package unless noted.

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

## Standalone server (`server.go`)

The router serves on **its own port**, deliberately **outside** the apiserver's kubernetes handler
chain (no authn, authz, audit, or priority-and-fairness). `GrafanaRouter` is one type with one
`Run`: the reconcile loop and the `http.Server` run as two goroutines under a single errgroup (a
non-nil return from either is fatal). Its `mux` mounts `HandleFunc` at `/apis` and
`openAPIV3Handler()` at `/openapi/v3`, and it does a bounded graceful shutdown (drain with a
timeout, then `Close()` fallback for hijacked/streaming conns). `HandleFunc(w, r, next)` keeps the
`next` fallthrough seam (standalone passes `NotFound`); the reconcile loop and the listener were
previously split into `BasicRouter` + `ProxyServer` so the routing logic could also be a delegate —
that seam now lives on `HandleFunc` / the `Router` interface, so the split was collapsed.

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

Implementation: `GrafanaRouter.entries` is a persistent `map[group]*handlerEntry`, keyed by group.
Each entry holds a resolved `http.Handler` plus `lastRV`, the fingerprint last applied. On reconcile,
groups whose `lastRV` is unchanged are left untouched, changed/new groups are rebuilt, and removed
groups are dropped; then a fresh immutable `map[group]Backend` snapshot is published via one atomic
store. **Connection-pool survival comes from the shared transport cache, not the Backend identity**
(`transportFor`, keyed by `tlsCacheKey`): rebuilding a group's Backend reuses the cached transport,
so its pool survives. Because reconcile only rebuilds the *changed* group, unrelated backends are
never touched.

## Routing table (group-keyed snapshot)

The router serves by **group**, the natural key of the loaded config — not by flattened path
prefixes. `GrafanaRouter.snapshot` is an `atomic.Pointer[map[group]http.Handler]`; reconcile
rebuilds and stores it, serving loads it lock-free per request.

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
- No k8s apimachinery/klog deps. The whole point is a stdlib-only router.

## Transports (`router.go`, `transportFor`)

One `*http.Transport` is built and cached per `tlsCacheKey` (CA data / skip-verify), so backends
with the same TLS settings share a transport and its pool. `MinVersion` is TLS 1.2; a valid
`CaData` PEM builds a `RootCAs` pool. `SkipTLSVerify` from the `RouteBackend` spec maps to
`InsecureSkipVerify` — an intentional, spec-gated escape hatch for trusted internal links, with a
targeted `nosemgrep`/`#nosec` justification. Only enable it for backends whose link is actually
trusted.

## Path model

### Backend Mode: Forward (full API server)

K8s REST paths are formulaic — fully determined by group/version. Implemented.

### Backend Mode: Operator (BaaS-powered App)

TBD. Possibly inspect OpenAPI. Lift admission, mutation and validation hooks here as appropriate.

### Backend Mode: Plugin

TBD. Possibly inspect a manifest. Use a gRPC client to translate http calls via plugin v2 gRPC contract.

## Discovery endpoints

| Path                          | Owner            | Handling                                    |
| ----------------------------- | ---------------- | ------------------------------------------- |
| `/apis/{group}/{version}`     | single backend   | proxy to the owning backend                 |
| `/apis/{group}`               | single backend   | proxy to the owning backend (see decision)  |
| `/apis`                       | router           | **synthesized** from the loaded RouteConfig set |

**Decision: one backend owns ALL versions of a given group.** A group is never split across
backends (reconcile keys `entries` by group; a duplicate group is last-wins). Consequences:

- `/apis/{group}` (group discovery, `APIGroup` — lists a group's versions) can be **proxied
  directly to the single owning backend**. No cross-backend merge is needed at group level.
- Only `/apis` (root, `APIGroupList` — the union across every group) requires router-side
  synthesis, from the loaded `RouteConfig` set. Not yet implemented.

If this ownership rule is ever relaxed (multiple backends per group), `/apis/{group}` must become
a synthesized merge as well — update this file and the discovery handler together.

## Notify / reconcile

The signal and the state are split; do not conflate them.

- **`RoutesLoader.Notify` returns a pure coalescing wake signal** (`<-chan struct{}`, buffered 1)
  with **no payload**. The router treats it as a level trigger, not a stream of deltas. How the
  loader produces or coalesces that edge is the loader's concern, not the router's.
- **`reconcile` is level-triggered.** On each wake it calls `RoutesLoader.Load` to re-read the full
  desired set, then converges: upsert changed groups (`lastRV` compare), skip unchanged ones, drop
  groups that disappeared. Safe to run on any wake — dropped signals cost nothing because Load reads
  current truth.
- **Ordering:** receive from the channel *before* calling Load (drain-then-load), so an event during
  a Load leaves a fresh pending wake → a guaranteed follow-up Load. Never lose a change.
- **Initial load is explicit** — `Run` calls `reconcile` once before the select loop, so correctness
  does not depend on the loader replaying existing routes on startup.
- On backend removal, ideally drain in-flight requests before tearing down its transport; never
  close eagerly on swap, or you cut live requests. (Transports are currently shared per
  `tlsCacheKey` and not closed — revisit when per-backend teardown is added.)

## Lifecycle / ownership

The `GrafanaRouter` runs as its **own process**, the `grafana router` command. It is a pure reverse
proxy: it sources RouteBackend/AppManifest from a **remote** apiserver over its own clients and does
not live inside the appmanifest apiserver (an earlier experiment wired it there via the App/apiserver
factory; that coupling was removed).

Wiring follows the standalone-apiserver factory pattern:

- **OSS (`pkg/router`)** — `RouterFactory` interface + `NoOpRouterFactory` (`factory.go`).
  `ProvideRouterFactory` returns the no-op, so the `router` command is hidden in OSS builds.
- **enterprise (`pkg/extensions/router`)** — the real factory (`cli.go`): a urfave `router` command
  whose flags drive runtime config. Its `run` builds one `rest.Config` for the whole apps group,
  a `k8s.ClientRegistry`, the enterprise `Loader`, two informers (RouteBackend + AppManifest,
  v1alpha2) wired to `loader.Watcher()` as change-detectors, and one `GrafanaRouter`, then runs
  informers + router under a single errgroup.
- **binding** — `server.InitializeRouterFactory()` (wire) returns the no-op in OSS
  (`wire_gen.go`) and the enterprise factory in enterprise/pro (`enterprise_wire_gen.go`);
  `cmd/grafana/main.go` appends the command when non-nil. Keep the wire source
  (`wire.go` + `wireexts_{oss,enterprise}.go`, set `wireExtsRouterFactorySet`) in sync with the
  generated files so `make gen-go` reproduces them.

`GrafanaRouter` is one type with one `Run` (reconcile loop + listener, two goroutines, one
errgroup). Listener address/TLS come from `GrafanaRouterConfig` (`config.go`), populated from CLI
flags.

## Security

Per repo policy, scan generated code with semgrep before landing. The group-keyed dispatch has no
injection sinks (the group is used only as a map key; no filesystem, shell, SQL, or template).
The sensitive surface is: proxy code that forwards headers / injects m2m identity/tokens / resolves
target URLs, `transportFor`'s TLS handling (esp. the spec-gated `InsecureSkipVerify` path), and the
standalone proxy port that runs outside the k8s handler chain. Scan and review those specifically.
