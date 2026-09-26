# Router: Pre-rollout review and improvement plan

Status: in progress (C1–C4 in #133537, P4 in #133547, A3 in #133551, O3 in #133558, P3 and P11 in #133578, P5 in #133588, P1 and P2 in #133627, W items in #133630, O1 in #133638, O2 undecided; P7 partly addressed)
Package: `pkg/router`

## Context

`pkg/router` replaces kube-aggregator and apiextensions-apiserver for Grafana. It grew quickly over
roughly a month and has not been widely rolled out, so its behavior, config keys and package layout
are still cheap to change. This plan comes from a full read of the package on 2026-09-25 (tests
passed with `-race`).

The core engine is sound and should keep its current shape:

- a group-keyed snapshot swapped atomically;
- connection pools that survive a route change, via a shared transport cache;
- a level-triggered reconcile that reads full state on every wake;
- a passive circuit breaker per group.

Most of the items below concern how the router fails, what it forwards, and how the route sources
fit together.

**Watch is in scope and must behave exactly as it does in Kubernetes.** Watches are rare compared
with CRUD and List, but clients such as informers and plugin operators depend on them. Every item
in this plan, and every change to the proxy path, must hold for a request that streams for 30
minutes or more. That covers:

- `?watch=1` / `?watch=true`. The deprecated `/apis/<g>/<v>/watch/...` path form is out of scope;
- watch-list (`sendInitialEvents=true`) with its bookmark events, and `allowWatchBookmarks`;
- `timeoutSeconds`, which the backend enforces and the router must not cut short;
- watch over WebSocket (`Upgrade: websocket`), which Kubernetes also serves.

The W section lists what currently falls short.

Each item has a stable ID. Tick it here when it lands, and note the PR number.

## Suggested PR order

1. **PR A (request hardening):** P1, P2, P3. Small, local to the proxy path, and ships before a wider
   rollout.
2. **PR B (discovery synthesis):** P5a, then P5b.
3. **PR C:** the rest of the P items (P4, P6–P11).
4. **Restructure:** A1–A4 as follow-ups. They are easier once PRs A and B land.
5. **PR W (watch parity):** W1, W4 and W7 first, since the breaker problem affects any watch today.
   Then W2, W3 and W6.
6. **Operability (O1–O2):** can run in parallel with any of the above.
7. **Cleanup (C1–C4):** fold into whichever PR touches the file.

---

## P: Fix before a wider rollout

- [x] **P1. Proxy transports need a response-header timeout.**
  - **Problem:** the proxy transports are clones of `http.DefaultTransport`, which sets no
    `ResponseHeaderTimeout`. When a client disconnects, the resulting context error is excluded from
    breaker accounting (`newGroupBreaker`, `breaker.go`). A backend that accepts connections but
    never responds therefore never counts as a failure, so it never trips the breaker, and goroutines
    pile up.
  - **Fix:** set `ResponseHeaderTimeout` on the forward (`transportFor`), aggregate
    (`newAggregateBaseTransport`) and ST fallback transports.
  - **Watch:** a header timeout is safe for watches, because a Kubernetes apiserver writes the
    response headers as soon as the watch starts; only the body streams. Nothing on the proxy path
    may bound the whole request: no `http.Client.Timeout`, no context deadline, no write timeout on
    the router's listener. A watch ends when the backend closes it (for example at `timeoutSeconds`)
    or the client leaves. Cover this with a watch that outlives the header timeout (W7).

- [x] **P2. Rejected redirects trip the breaker, and routing and forwarding disagree about the path.**
  - **Redirects:** `rejectBackendRedirects` (`router.go`) returns an error, which `ReverseProxy`
    turns into a 502, and the breaker counts that 502 as a backend failure. Many servers redirect
    non-canonical paths (`..`, `//`), so around six such requests from any caller can open the breaker
    for every caller of that group.
  - **Path mismatch:** `groupFromPath` reads the decoded `URL.Path`, but the proxy forwards the
    escaped path. `..` segments and `%2F` can reach a backend in a form that doesn't match the group
    the request was routed by.
  - **Fix:**
    - Reject non-canonical paths with a 400 in `HandleFunc`, before routing. The `watch` query
      parameter must keep working.
    - Give each proxy its own `ErrorHandler` that labels the failure kind: transport error, rejected
      redirect, or stack origin mismatch. `serveThroughBreaker` then classifies by failure kind
      instead of guessing from the status code. A rejected redirect should not count as a backend
      failure.

- [x] **P3. Define an explicit policy for headers sent to backends.**
  - **Problem:** in middleware mode, `pkg/services/apiserver/service.go` hands the raw Grafana
    request to `HandleFunc`. The forward proxy therefore passes every header to remote `RouteBackend`
    URLs, including Grafana's session `Cookie`. Callers who log in with a session also send no
    token-based identity downstream.
  - `NewLoopbackRestConfigProvider` (`restconfig.go`) already gets this right: it sets
    `X-Access-Token` from the requester.
  - **Fix:** use one shared rewrite in every proxy (forward, aggregate, ST) that:
    - strips `Cookie` and hop-by-hop headers;
    - sets the identity from the requester;
    - calls `pr.SetXForwarded()`, so backends keep the client IP for audit logs.

- [x] **P4. Harden the ST fallback against grafana.com lookup floods.**
  - **Problem:**
    - For any unrouted group, a path of the form `/apis/<g>/<v>/namespaces/stacks-N/...` triggers a
      grafana.com lookup of stack N. Nothing checks that the caller belongs to that namespace first.
    - The lookup cache holds only 100 entries (`cacheSize: 100` in `cloud_router.go`). Normal traffic
      across more than 100 stacks, or a deliberate scan, keeps evicting it and sends every miss to
      grafana.com.
    - The per-destination breakers use a cache of the same size, so eviction silently resets breaker
      state.
  - **Fix:** check that the namespace matches the caller's token before the lookup, raise the cache
    size (and make it configurable) or add a lookup rate limit, and size the breaker cache separately.

- [x] **P5. Aggregated discovery fans out to every backend on every request.**
  - **Problem:**
    - `serveAggregatedDiscovery` (`discovery_handler.go`) calls every served group's backend in
      sequence, on every request, and falls back to one call per version.
    - kubectl and client-go request this on nearly every command.
    - A target that serves K groups returns the same `/apis` document K times per request.
    - A single slow backend stalls discovery for everyone.
  - [x] **P5a. Build discovery locally where the router already has the data.** Plugin backends and
    manifest-backed forward backends already hold their manifest, which lists the kinds. Add an
    optional interface on `Backend`, such as `Discovery() (apidiscoveryv2.APIGroupDiscovery, bool)`,
    and build those entries without any network call. This adds a new interface to `types.go` and
    removes none, which is consistent with that file's rule on interfaces.
  - [x] **P5b. Cache discovery for the backends that still need a fetch** (the aggregate and ST
    targets). Fetch with the router's own identity and cache by backend key, as kube-aggregator's
    discovery controller does. This means revisiting the current decision, recorded in AGENTS.md,
    not to cache discovery across callers. k8s discovery is not filtered per caller.
  - **Fallback if per-caller fetches must stay:** at least run them in parallel with timeouts per
    backend, and deduplicate backends that share one upstream target.

- [ ] **P6. The preferred version can be an unserved version.** When no preferred version is set,
  `apiGroupFromManifestSpec` (`cloud_router.go`) picks the last entry in `spec.Versions`, even if
  that version isn't served. Pick the highest served version by kube version ordering
  (`version.CompareKubeAwareVersionStrings`).

- [ ] **P7. Managed plugins can override core groups.**
  - **Problem:** in `cloudLoader.Load`, the managed-plugins source (`plugins_url`) is applied last,
    so it overrides every other source. A plugin manifest can claim a core group such as
    `dashboard.grafana.app`. `plugins_group_regex` defaults to allowing every group.
  - **Fix:** protect reserved groups, or give plugins a mandatory default group pattern. Log (and
    later, count via O1) whenever one source overrides another for the same group.

- [ ] **P8. Confirm remote plugin authorization before rollout.** `pluginManifestAccessControl`
  (`plugin_manifests_ac.go`) grants app access to every requester, and `authenticatingWrapper` only
  checks that the token is valid. Confirm that the storage layer (via the OBO token exchange)
  enforces the token's namespace. If it doesn't, add a check in the router that the namespace in the
  path matches the token.

- [ ] **P9. The router needs its own retry after a failed reconcile.** The code comments say "a later
  wake retries", but nothing guarantees a wake. For example, if the initial `ListAll` fails and the
  informers don't replay existing objects, `Ready` stays failing indefinitely. `Run` should schedule a
  retry with backoff whenever `reconcile` returns an error.

- [ ] **P10. The OpenAPI document cache never drops removed groups.** Entries in `openapiDocs`
  (`router.go`) for groups that are no longer served stay in memory forever. Prune them in `publish`.

- [x] **P11. One bad plugin blocks every local plugin.** `PluginLoader.Load` (`plugin.go`) returns an
  error for the whole load if any single `NewPluginBackend` call fails. Skip and warn instead, as the
  other sources already do.

---

## A: Architecture (cheap to change before rollout)

- [ ] **A1. Split the generic engine from the Grafana Cloud–specific route sources.**
  - Keep the engine in `pkg/router`: `router.go`, `types.go`, discovery, breaker, cache, service.
  - Move each source to its own subpackage (for example `pkg/router/sources/{routebackend,aggregate,
    plugins,stfallback}`): `cloudLoader`, the aggregate targets, `plugins_url`, and the
    grafana.com-based ST fallback.
  - Move the hardcoded DNS template
    `http://%s-grafana-http.hosted-grafana.svc.cluster.local.:80` (`st_fallback.go`) into config.

- [ ] **A2. Replace `cloudLoader` with an ordered list of route sources.**
  - **Problem:** `cloudLoader` merges four sources in a priority order hardcoded in `Load`. Its code
    also contains three near-copies of the same poll loop: `aggregateTarget.run`,
    `pluginManifestsTarget.run`, and the ST fallback's bare ticker.
  - **Fix:**
    - Extract a single `polledSource` that handles backoff (the existing `cooldown`), the snapshot,
      change detection by key set, and the coalesced wake signal.
    - Define a small `Source` interface.
    - Make `cloudLoader` an ordered `[]Source`, so the override order is explicit and testable.
  - This also removes the either/or in `ProvideRoutesLoader` (`loader_factory.go`), which today
    selects cloud *or* local plugins *or* dummy and can't combine them.

- [x] **A3. Stop the redundant load on the control-plane API server.**
  - **Problem:** the ST fallback's ticker wakes the router every 30s whether or not anything changed.
    Each wake runs `cloudLoader.Load`, which calls `ListAll` on both RouteBackends and AppManifests
    against the remote API server, even though informers for both kinds are already running.
  - **Fix:** have `Load` read from the informer caches, and give the ST source the same key-set
    change detection that the aggregate targets use.

- [ ] **A4. Reshape the `[cloud_router]` config before anyone depends on it.**
  - `*.group_regex` and `plugins_group_regex` are globs, not regexes. Rename them, for example to
    `*.group_patterns`.
  - Choosing the auth header by comparing the target name (`aggregateTokenWrapper`) hides
    deployment knowledge. Replace it with a per-target key: `<name>.auth = bearer | access_token`.
  - Reconsider the fixed pair of aggregate targets (`baas_apiserver`,
    `cloud_app_platform_apiserver`) in favor of a configurable list. The aggregate discovery design
    doc argues for keeping exactly two. Now that the router stands in for kube-aggregator, revisit
    that decision explicitly.
  - Document `st_discovery_url` in the AGENTS.md settings table.
  - Rename `ProvideCloudRoutesLoaderFactory`: it returns a loader, not a factory.

---

## W: Watch parity with Kubernetes

Found by checking each part of the proxy path against a watch that streams for 30+ minutes.

- [x] **W1. The circuit breaker holds a watch for its whole lifetime.**
  - **Problem:** `serveThroughBreaker` (`breaker.go`) runs the entire request inside
    `cb.Execute`, and the outcome is recorded only when the handler returns.
    - When the breaker is half-open, gobreaker allows one trial request. A watch that starts as the
      trial holds that slot until the stream ends, often 30 minutes or more. Every other request to
      the group gets a 503 in the meantime, and the breaker can't close.
    - A watch's success or failure is known once its status is written, but it's counted only when
      the stream closes.
    - The ST fallback's per-destination breakers (`breakerForDestination`) go through the same path.
  - **Fix:** switch to gobreaker's two-step breaker (`NewTwoStepCircuitBreaker`, `Allow` returns a
    `done` callback). Call `done` with the outcome as soon as the response status is written (from
    `statusRecorder.WriteHeader`), or when the handler returns without writing one. The rest of the
    stream no longer affects the breaker.
  - **Test:** with the breaker half-open, an open watch must not block other requests, and a watch
    that starts with a 200 closes the breaker immediately.

- [x] **W2. Metrics and the in-flight gauge count a watch as one long request.**
  - **Problem:** `routerMetrics.instrument` (`metrics.go`) observes every request in the duration
    histogram and the in-flight gauge. One watch lasting 30 minutes skews latency percentiles, and
    idle watches look like load. Kubernetes separates long-running requests: they are excluded from
    `apiserver_request_duration_seconds` and from max-in-flight limits, and counted in
    `apiserver_longrunning_requests` instead.
  - **Fix:** classify a request as long-running the way Kubernetes does: verb `watch` (the `watch`
    query parameter) or a protocol upgrade. Exclude long-running requests from the duration histogram and the in-flight
    gauge, count them in a `grafana_router_longrunning_requests{group}` gauge, and add a `verb`
    label to the duration histogram. The access log still records each watch when it ends.

- [x] **W3. Watches outlive route changes, and they can block shutdown.**
  - **Shutdown:** the standalone module server stops its listener with
    `httpServ.Shutdown(context.Background())` (`pkg/server/instrumentation_service.go`).
    `Shutdown` waits for active connections to go idle, which a watch never does, so stopping the
    router can hang until every watch ends. Kubernetes ends watches during shutdown after a grace
    period (`ShutdownWatchTerminationGracePeriod`).
    - Fix: give `Shutdown` a deadline and then close the remaining connections, or have the router
      cancel its in-flight watches when its service stops. Clients reconnect to another replica.
  - **Route changes:** when a group is removed, or rebuilt because its key changed (for example
    the target moved), watches already open keep streaming from the old handler. They continue
    until the backend or client ends them, so a moved group can keep sending events from the old
    target. The apiextensions apiserver closes watches when a CRD's storage changes, and clients
    then re-list and re-watch.
    - Fix: give each `handlerEntry` a context that reconcile cancels when it replaces or drops the
      entry, and derive watch requests from it, so they end and clients reconnect to the new backend.
      Ordinary requests finish normally.

- [x] **W4. Streaming depends on a proxy heuristic.** `httputil.ReverseProxy` flushes after every
  write only when the response has no `Content-Length`, which is true of watch responses today.
  - **Fix:** set `FlushInterval: -1` explicitly on the forward, aggregate and ST proxies, so events
    are never buffered whatever the backend sends. Keep `captureWriter`, which buffers, out of any
    path a watch can take. Today it is used only for discovery and OpenAPI documents.
  - **Test:** through each proxy type, a watch event must reach the client while the stream is
    still open (W7).

- ~~**W5. The ST fallback doesn't recognise the deprecated watch path.**~~ Dropped: the deprecated
  `/apis/<g>/<v>/watch/...` path form is out of scope.

- [x] **W6. Watch over WebSocket isn't supported yet.** Decided: not supported. Upgrade requests to
  routed groups and the ST fallback are rejected with a 400 that says so (`rejectUpgrade`).
  - **Problem:** Kubernetes serves watch over WebSocket (`Upgrade: websocket`), and kube-aggregator
    proxies it with its upgrade-aware handler. AGENTS.md currently says "No upgrades".
    - `httputil.ReverseProxy` can proxy an upgrade, but only if the writer it gets can hijack the
      connection. `statusRecorder.writer()` offers `Hijack` only when the writer it wraps also has
      `CloseNotify`. In middleware mode that is Grafana's `responsewriter.WrapForHTTP1Or2`, which
      hasn't been checked.
    - On an upgrade, the recorder never sees a status write, so metrics and the breaker record 200
      rather than 101.
  - **Fix:** support upgrades for watch in every backend type and in both modes. Record 101 as the
    status, treat an upgraded request as long-running (W2), and change the AGENTS.md scope rule.
    If support is deliberately left out instead, reject upgrades with a clear error and document
    the gap; it must not fail silently.

- [x] **W7. Watch acceptance tests.** One table-driven test across every backend type (forward,
  aggregate, ST, in-process plugin) and both modes (standalone, middleware), checking:
  - `?watch=1` and `?watch=true`;
  - watch-list with `sendInitialEvents=true`, including the initial-events-end bookmark;
  - `timeoutSeconds`: the backend ends the stream, and the router doesn't end it sooner;
  - an event reaches the client before the stream ends (W4);
  - a client disconnect cancels the upstream request;
  - the breaker and metrics treat the watch as in W1 and W2;
  - shutdown and route changes end the watch (W3);
  - WebSocket watch (W6).

  Add one integration test in `pkg/tests/apis/appplugin/` that runs a client-go informer against a
  plugin kind through the router, and checks that it syncs and receives an update.

---

## O: Operability

- [x] **O1. Metrics for route state, not just requests.** kube-aggregator's main operational
  advantage is `APIService` status, which shows who serves each group and whether it is available.
  Minimum set:
  - gauge: groups served, labeled by source;
  - gauge: breaker state per group;
  - counters: reconcile runs and reconcile errors;
  - counter: source conflicts (one source overriding another for the same group). Implemented as a
    gauge of groups currently shadowed, since a lasting conflict would bump a counter on every
    reconcile;
  - timestamp: last successful poll, per source.
  - The metrics audit added readiness, last-reconcile time, per-state breaker series and
    transitions, backend failure reasons, discovery results, poll attempts and stack lookups, plus a
    `route` label on request metrics. See `specs/2026-09-26-router-metrics.md`.

- [ ] **O2. Read-only debug endpoint.** A JSON view of the current snapshot showing, for each group:
  source, key, target host and breaker state.
  - Undecided whether to expose this yet. The same information is available from the OpenAPI
    discovery index (each group's key identifies its backend) and the O1 metrics. An implementation
    is kept in a separate draft PR.

- [x] **O3. One logger.** The package mixes global `slog`, Grafana's `infra/log`
  (`obo_exchanger.go`) and the app-sdk logger (`plugin.go`). Inject a single
  `log.New("router")`-style logger.

---

## C: Cleanup

- [x] **C1. Stale comments:**
  - `forwardBackend`'s doc comment refers to `buildBackend`, `buildErr` and `Ready`, which don't
    exist (`forward.go`).
  - A dangling "if backend does CAP token auth when BaaS comes in, will" (`forward.go`).
  - "Merged OpenAPI v3 document" in `HandleFunc` (`router.go`); nothing is merged.
  - "there won't be a cloud apps router in enterprise" on `GrafanaRouter` (`router.go`).

- [x] **C2. Bring AGENTS.md up to date and shorten it.**
  - It still says the Operator and Plugin backend modes are TODO, and that `pluginManifestBackend`
    only echoes its manifest entry. Plugins now run as real gRPC-backed `PluginBackend`s.
  - It is about 500 lines, much of it PR-review history ("found by PR review, in two passes"). Move
    the history into `specs/` and keep AGENTS.md to the current rules.

- [x] **C3. Trim the narrative code comments.** Many comments run to several paragraphs and describe
  earlier versions of the code (for example `aggregateTarget.run` and `cooldown.Until`). The repo
  guideline is to explain *why*; one or two sentences usually covers it.

- [x] **C4. Small consistency fixes:**
  - Rename test files by the behavior they test, not the process that produced them (for example
    `st_fallback_review_test.go`).
  - Use one receiver name on `GrafanaRouter`; `cr` and `r` are currently mixed.
