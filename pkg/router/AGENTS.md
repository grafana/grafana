# AGENTS.md — Grafana Router

`pkg/router` is Grafana's replacement for kube-aggregator and apiextensions-apiserver: a reverse
proxy that serves `/apis` and `/openapi/v3` by API group. A `RoutesLoader` supplies routes as
`[]Backend`. Routes change rarely, as apps and plugins are rolled out or get new versions.

This file holds the current rules. For the reasoning and history behind them, see `specs/`,
especially `specs/2026-09-25-router-design-notes.md`. Open work is tracked in
`specs/2026-09-25-router-review-plan.md`.

## Rules

- **Never delete or narrow an interface in `types.go` without human sign-off.** `Router`,
  `RoutesLoader` and `Backend` mark seams for planned work, even where they look unused (an earlier
  refactor dropped `Router` by mistake). Adding an interface is fine.
- **Keep deployment-specific knowledge out of the engine** (`router.go`, `types.go`, `discovery*.go`,
  `breaker.go`, `openapi_cache.go`). It belongs in the source files: `cloud_router.go`,
  `aggregate_*.go`, `plugin_manifests*.go` and `st_fallback.go`.
- **One backend owns every version of a group.** Dispatch is keyed by group (segment 2 of
  `/apis/<group>/...`). Don't reintroduce a path mux that flattens routes into prefixes. A duplicate
  group in one `Load` makes the last one win, with a warning, and must never panic.
- **Keep connection pools across a reload.** Reconcile rebuilds only groups whose `Key()` changed,
  and transports are cached by TLS settings (`transportFor`), so a rebuilt group reuses its pool.
  Never recreate unrelated backends on a route change.
- **Build discovery from what is served,** meaning `r.served`, never the raw `Load` result. A group
  whose reload failed keeps serving and advertising its last-known-good backend.
- **Reconcile is level-triggered.** `Notify` is a coalescing wake with no payload, and every wake
  re-reads full state through `Load`. Drain the channel before calling `Load`. `Run` does an explicit
  initial reconcile. A closed `Notify` channel must not busy-loop (set it to nil).
- **`Ready` fails only when nothing is served.** A partial reconcile error is logged, but must not
  drain the router from its load balancer.
- **The circuit breaker is passive only.** `gobreaker`, one breaker per group, driven by the
  outcomes of real proxied requests; no active health probes. Context cancellation is excluded from
  breaker accounting. Any `ResponseWriter` wrapper between `ReverseProxy` and the client must forward
  `Flush` (via `Unwrap`, or a no-op `Flush` for buffering writers).
- **Each poll loop has exactly one pacing source**: its `cooldown`. Don't add a second ticker. A
  failed poll changes nothing; the previous snapshot keeps serving.
- **Proxy hygiene:**
  - Backend redirects become a 502 (`rejectBackendRedirects`).
  - Every configured URL must be absolute; `url.Parse` accepts `""` and relative paths, so check
    explicitly.
  - On an OpenAPI cache miss, strip conditional headers and the `hash` query parameter before
    proxying.
  - Any 304 must carry an `ETag`.
- **Scope is CRUD and List over HTTP/1.1.** No Watch, upgrades or streaming. If that changes,
  revisit flushing, upgrade handling and per-request timeouts.

## Package layout

| Area | Files |
| --- | --- |
| Engine: reconcile loop, dispatch, `Ready`/`Alive` | `router.go`, `types.go` |
| Root discovery (`/apis`, `/openapi/v3`) | `discovery.go`, `discovery_handler.go` |
| Per-group-version OpenAPI cache | `openapi_cache.go` |
| Circuit breaker, status recorder | `breaker.go` |
| dskit service, middleware entry point | `service.go` |
| Metrics, access logs, tracing | `metrics.go`, `logging.go`, `tracing.go`, `plugin_tracing.go` |
| Loader selection | `loader_factory.go` |
| Forward-mode backend (RouteBackend CR) | `forward.go` |
| Cloud loader: RouteBackend/AppManifest CRs, source priority | `cloud_router.go` |
| Aggregate targets (`baas_apiserver`, `cloud_app_platform_apiserver`) | `aggregate_*.go` |
| Managed plugins (`plugins_url`) | `plugin_manifests.go`, `plugin_manifests_ac.go` |
| Local plugin loader and `PluginBackend` | `plugin.go` |
| Single-tenant (ST) fallback | `st_fallback.go` |
| Storage and loopback clients for plugin backends | `storage.go`, `obo_exchanger.go`, `restconfig.go` |
| Dummy loader (the default when nothing is configured) | `dummy.go` |

## Route sources

`ProvideRoutesLoader` picks exactly one loader:

1. **The cloud loader**, when any `[cloud_router]` source is configured (see Settings).
2. **Otherwise the local plugin loader**, when plugin sources are available.
3. **Otherwise the dummy loader**, which serves two static dummy groups.

The cloud loader merges its sources by group. When sources conflict, later entries override
earlier ones:

1. **ST fallback discovery** (`st_discovery_url`). Groups found on a single-tenant instance are
   routed to the right stack by the namespace in the path.
2. **Aggregate targets**, discovered by polling each target's `/apis`. A later target overrides an
   earlier one.
3. **RouteBackend CRs**, correlated by name with an AppManifest CR, or with the manifests embedded
   in the binary for core groups. Only Forward mode is implemented. Backends without a `Forward`
   block (Operator and Plugin modes) are skipped with a warning.
4. **Managed plugins**, from `plugins_url`. These are `PluginBackend`s reached over gRPC, wrapped to
   authenticate `X-Access-Token`.

Each `Backend.Key()` encodes its source: the CR resource versions, `aggregate:<target>:<hash>`,
`managed:<pluginId>:<hash>`, `p:<hash>` or `st:<hash>`.

## Serving and discovery

| Path | Handling |
| --- | --- |
| `/apis/{group}[/...]` | Proxied to the owning backend, through its breaker. |
| `/apis` | Synthesized: `APIGroupList`, or `APIGroupDiscoveryList` when the aggregated format is negotiated. |
| `/openapi/v3` | Synthesized index; per-version URLs are cache-busted with the backend key. |
| `/openapi/v3/apis/{group}/{version}` | Proxied, and cached against the backend key unless the response is private, `no-cache` or `no-store`. |

- **Middleware mode:** `/apis` and `/openapi/v3` merge the router's groups with the embedded
  server's, fetched through `next`. A routed group replaces all of the embedded server's versions of
  that group.
- **Aggregated discovery:** reads each backend's discovery with the caller's credentials, and keeps
  only the group that backend owns. For older backends it falls back to per-version discovery.
  Versions that can't be fetched are still listed, marked `Stale`.
- **Unknown groups:** fall through to `next`, or to the ST fallback when running standalone.
- **Metrics:** unknown groups are labelled `unknown` (`KnownGroup`) so arbitrary client paths can't
  create new series.

## Lifecycle

- **Standalone:** the dskit `router` target. `pkg/server`'s `initRouterModule` builds the loader
  (the Wire injector `InitializeRoutesLoader`) and the `Service`. `RegisterTargetRoutes` mounts it on
  the module server's HTTP router next to `/metrics`, `/livez` and `/readyz`. A loader that also
  implements `services.Service` (such as `cloudLoader`, which runs informers and poll loops) is run
  alongside it with `newCompositeService`, so both start and stop together.
- **Middleware:** with the `grafana.useRouterMiddleware` feature flag, the embedded API server calls
  `Service.HandleFunc` after Grafana authentication, and the regular API server handler serves as
  `next`. The ST fallback is not used in this mode.
- **No `http.Server` in this package.** The caller owns the listener, TLS, and the security of the
  port.
- **Wire:** keep `wire.go` and each edition's `wireExts*.go` in sync with the generated files, so
  that `make gen-go` reproduces them.

## Settings (`[cloud_router]`)

These keys are read straight from `cfg.SectionWithEnvOverrides("cloud_router")`. There is no
`pkg/setting` field for them, and they aren't documented in `conf/defaults.ini`.

| Key | Meaning |
| --- | --- |
| `appmanifest_apiserver_url` | Remote apiserver serving the RouteBackend and AppManifest CRs. Unset disables the CR source. The legacy `apiserver_url` is a hard error. |
| `apiserver_ca_file`, `apiserver_insecure` | TLS settings for `appmanifest_apiserver_url` only. |
| `cap_token`, `token_exchange_url` | Required when the CR source or any aggregate target is set. The CAP token is exchanged per request. |
| `<target>.url` | Base URL for `baas_apiserver` or `cloud_app_platform_apiserver`. Unset skips that target. |
| `<target>.audience` | Required when `<target>.url` is set. |
| `<target>.group_regex` | Comma-separated globs that narrow the discovered groups. Unset matches all. |
| `<target>.ca_file`, `<target>.insecure` | Per-target TLS settings. |
| `plugins_url` | Full URL of the plugin-manifests operator's `/plugins` endpoint. Needs no CAP token. |
| `plugins_group_regex` | Globs that narrow the plugin groups, with the same semantics as `group_regex`. |
| `st_discovery_url` | A single-tenant instance used for discovery. Enables the ST fallback, which resolves stacks through grafana.com (`GrafanaComAPIURL`, `GrafanaComSSOAPIToken`). |

Every URL must be absolute; a trailing slash is tolerated.

## Security

Before landing, scan with semgrep. The sensitive surface:

- the headers that proxies forward to backends;
- the `InsecureSkipVerify` paths in `transportFor` and `buildAggregateTLSConfig`, which are
  deliberately enabled by spec or config;
- the CAP token exchange and credential handling in `cloud_router.go`;
- the OBO exchange (`obo_exchanger.go`);
- the ST fallback's stack lookup and host selection.

Dispatch by group has no injection sinks, since the group is only ever used as a map key.

## Further reading

- `specs/2026-08-17-router-discovery-openapi-design.md`: the discovery and OpenAPI design.
- `specs/2026-08-19-router-circuit-breaker-design.md`: the circuit breaker, and why health checks
  are passive.
- `specs/2026-09-11-router-aggregate-discovery-design.md`: aggregate targets and the cooldown.
- `specs/2026-09-25-router-design-notes.md`: why there's no mux, readiness, notify semantics,
  config history.
