# Router: Review plan

Status: open. Replaces `2026-10-10-router-review-plan.md`.
Package: `pkg/router`

## Context

`pkg/router` replaces kube-aggregator and apiextensions-apiserver for Grafana. It is not yet widely
rolled out, so its behavior, config keys and package layout are still cheap to change, and features
nobody uses are cheap to remove.

This plan was rebuilt on 2026-10-23 from `main` at 3420e13ba94. That was 26 router commits after
the 10-10 plan, and none of them closed a plan item. They changed its shape instead:

- **`dashboard.grafana.app` is split per request** between its backend and the single-tenant stacks
  (#135613, #135703). That added `requestRouter`/`handlerFor` breaker selection and a post-merge step
  in `cloudLoader.Load`.
- **App plugin settings are served by the router** (#135657).
- **`/apis/discovery` is always served**, inside Grafana too, and its manifests are shared with
  in-process storage (#134759, #135388).
- **Core APIs come from `core_url`** (#134740, #134711), and `ProvideCloudRoutesLoader` is a new
  wrapper around `ProvideCloudRoutesLoaderFactory`.
- **Plugin gRPC connections** got TLS, retries, keepalive and message-size settings (#134703,
  #134706, #134823).
- **The ST fallback** serves discovery from the requester's stack (#134782), forwards
  cluster-scoped requests (#135272), and breaks per destination for traffic from ST (#135169).

The new sections in this plan:

- **D**: dangling features and dead code to remove.
- **F**: performance.

Metrics follow-ups (M5–M7, M9–M12) stay in `2026-10-08-router-metrics-review.md`; all are still
open.

IDs from earlier plans are kept. Tick an item here when it lands, and note the PR number.

## What is already done

| Items | PRs |
| --- | --- |
| P1–P11: proxy timeouts, failure labeling, outbound headers, ST lookup limits, discovery synthesis and cache, preferred version, plugin group rules, plugin authz, reconcile retry, OpenAPI pruning, per-plugin load errors | #133547, #133578, #133588, #133627, #133636, #133646 |
| W1–W4, W6, W7: watch parity (W5 dropped) | #133630 |
| A3: no redundant control-plane load | #133551 |
| O1, O3: route-state metrics, one logger (O2 not pursued) | #133638, #133558 |
| C1–C4, C6: cleanup passes | #133537, #134672 |
| P12, P13: authentication of local and managed plugins | #133656 |
| A4, partly: aggregate targets as a list, per-target TLS and `poll_interval` | #134381, #134461 |
| R3: the forward transport cache never evicted | Moot: the forward source no longer exists |

## About the `router-review*` branches

- **`router-review`**: fully landed (#133537).
- **`router-review-2`**: fully landed, except "Keep what an incomplete discovery fetch read"
  (cb8b367edd4). That is now P21.
- **`router-review-3`**: forked 2026-09-28. `main` is now more than 1100 commits ahead of it, 48
  of them in `pkg/router`.
  - These ports still fit with light work: R4 (120fcb87e0e), P14 (3d2e271b8cb), the `logging.go`
    part of O5 (ce626095d38), O6 (5f601f48252), and A4.2 and A4.3 (ac69ebc3ce1).
  - R1 and R2 (e4468573b27): keep `retire.go`'s `handlerUse` and `destroyWhenDrained`, but rewrite
    the wiring.
  - A2 and A5 (56915e172f8) are obsolete, since they were built around the removed RouteBackend
    source. Keep only the design.

---

## Suggested order

1. **Correctness quick wins:** P15, P16 with D1, P18, P19.
2. **Performance:** F1, then F5, F6, F3, F4. Add the F12 benchmarks first, so each change has a
   baseline.
3. **Dead-code sweep:** D2–D4 and D6–D9, in one or two PRs.
4. **Lifecycle:** R1 and R2 together, with R5. Then R4 with O4.
5. **Readiness and small fixes:** O7, O6, O5, P14, P17, P20, P21.
6. **Product decisions:** D5, D10, A4.
7. **Restructure:** A2 with A5 and A8, then A6, then A1 and A7.

---

## R: Resource lifecycle

- [ ] **R1. Retired plugin handlers are never destroyed.**
  - **Problem:**
    - `pluginroute.NewHandler` builds a full API server per plugin.
    - `reconcile` (`router.go`) retires an entry when its key changes or its group goes away. It ends
      the entry's watches, but never calls `Destroy`.
    - Settings handlers (`NewAppSettingsHandler`, #135657) leak the same way.
  - **Fix:**
    - Add an optional `Destroy` teardown interface. Every wrapper must pass it through:
      `tracedPluginHandler`, `pluginDeploymentBackend` and `singleTenantResourcesHandler`.
    - Count in-flight requests per entry, and destroy a retired entry once that count drains, with a
      bounded wait.
    - The count must cover all three `serveThroughBreaker(entry, …)` call sites: `router.go` resource
      dispatch, the OpenAPI proxy, and `discovery_handler.go`.
  - **Test:** changing a managed plugin's key destroys the old handler after its request finishes,
    not before.

- [ ] **R2. gRPC connections to removed plugin hosts stay open.** Connections are keyed by host and
  plugin ID (`pluginManifestsTarget.connections`), and close only when `run` returns. Have each handler
  hold a reference to its connection, and release it in `Destroy`. Depends on R1.

- [ ] **R4. A backend that keeps failing is rebuilt about once a minute.**
  - **Problem:** a partial reconcile failure is retried at `reconcileRetryMax`. Each retry calls the
    failing `Load` again and logs at Error.
  - **Fix:** keep a failure count per group, keyed by backend key, and back off per group. A new key
    resets the count.
  - Do O4 in the same change.

- [ ] **R5. Inside Grafana without the middleware flag, every plugin backend is still built.**
  - **Problem:** the `Service` now always runs, so that `/apis/discovery` stays current. `reconcile`
    therefore calls `Backend.Load` for every local manifest-bearing plugin and settings backend, and
    `HandleFunc` never serves one of them. The cost is an API server per plugin at startup (leaked,
    see R1), plus R4's error log every minute for a broken manifest.
  - **Fix:** when the router doesn't route, publish manifests from `Load()` without calling
    `Backend.Load`, for example with a "manifests only" reconcile mode.

---

## P: Correctness

- [ ] **P14. The deprecated `/watch/` path still classifies as a watch.**
  - `requestVerb` (`watch.go`) maps `/apis/<g>/<v>/watch/...` to verb `watch`.
  - That path form is out of scope, so it should get no watch treatment. Reject it with a 400 at both
    `rejectUpgrade` sites.

- [ ] **P15. A stale OpenAPI `hash` becomes a 502 on the ST path.**
  - **Problem:** `singleTenantFallback.forward` and the ST discovery fetch pass the caller's `?hash=`
    through to the stack.
    - kube-openapi answers a mismatched hash with a 301 (`handler3`).
    - `rejectBackendRedirects` turns that 301 into a 502.
    - So after a stack upgrade, clients that follow a cached `/openapi/v3` index get 502s, for up to
      `singleTenantDiscoveryCacheTTL`. Documents too large to cache get them on every request.
    - The router's own OpenAPI path already strips the hash (`stripHashQueryParam`).
  - **Fix:**
    - Strip `hash` before forwarding OpenAPI paths to a stack.
    - Leave it out of `stackDiscoveryKey`.
  - **Test:** a stale hash through the fallback returns the current document, not a 502.

- [ ] **P16. The standalone router drops every cloud source when `grafanaUseRouterMiddleware` is on.**
  - **Problem:** `middlewareEnabled` (`loader_factory.go`) returns true in the standalone target when
    the flag is on.
    - `ProvideRoutesLoader` then skips the cloud loader.
    - `RegisterTargetRoutes` drops the ST fallback (`!s.middleware`).
    - If the flag reaches the router's deployment, the router serves only local plugins and still
      reports ready. `service_test.go` asserts this today.
  - **Fix:** `middlewareEnabled` returns false whenever `standaloneRouter(cfg)` is true. See D1 for
    the rest of that branch.

- [ ] **P17. Deadlines the router sets itself never count against a breaker.**
  - **Problem:** `breakerOutcome` treats any `req.Context().Err()` as `errCallerGone`. That includes
    the router's own fetch deadlines:
    - the ST shared discovery fetch, 30 s;
    - root discovery through the fallback, 5 s.
  - A stack that hangs on discovery therefore never trips its breaker.
  - **Fix:** set router-imposed deadlines with `context.WithTimeoutCause` and a distinct cause.
    Exclude only the caller's own cancellation.

- [ ] **P18. The default plugin gRPC keepalive fights the plugin servers.**
  - **Problem:** the default `keepalive_time` is 20 s, with `PermitWithoutStream`.
    - grafana-plugin-sdk-go and grafana-app-sdk servers keep gRPC's default enforcement policy: no
      pings more often than every 5 min, and none without an active stream.
    - So idle connections get GOAWAY `too_many_pings`, and the client keeps doubling its interval and
      reconnecting.
    - A stream in flight on a closed connection fails; streams are not retried.
  - **Fix:** default `keepalive_time` to `0` (off) or at least `5m`. Alternatively, set a matching
    enforcement policy in both SDKs.

- [ ] **P19. `FlagApppluginsRegisterAPIServer` is read in two different ways.**
  - `newPluginSettingsBackend`'s caller (`plugin.go`) evaluates it through OpenFeature on every
    `Load`.
  - `middlewareEnabled` uses the static `IsEnabledGlobally`.
  - If the two disagree, settings backends are built but never served, or the router takes over
    plugin groups without serving their settings.
  - **Fix:** read the flag once, and pass the result into `PluginLoader`.

- [ ] **P20. A small `st_discovery_cache_bytes` evicts everything.** With a budget below
  `maxSingleTenantCachedDiscoveryBytes`, one large document makes `RemoveOldest` evict every stack's
  entries, the new one included. Refuse entries larger than the budget, or require the budget to be at
  least that limit.

- [ ] **P21. An incomplete discovery fetch throws away what it read.**
  - `groupDiscovery` (`discovery_cache.go`) drops a partial fetch and returns versions only.
  - Port cb8b367edd4 from `router-review-2`. It still applies, and matters for older backends that
    use per-version discovery.

---

## A: Architecture

- [ ] **A1. Split the generic engine from the source-specific code.**
  - Move each source to a subpackage, for example
    `pkg/router/sources/{aggregate,pluginmanifests,stfallback}`.
  - `st_resources.go` and the settings backends now add to the source-specific side.

- [ ] **A2. Replace `cloudLoader`'s hardcoded merge with an ordered list of sources.**
  - **Problem:**
    - `cloudLoader.Load` writes the priority order out by hand, and now ends with a post-merge step
      that wraps `dashboard.grafana.app`.
    - `running` and `sourceStatuses` repeat the source list.
    - The three poll loops are still the same shape: `aggregateTarget.run`,
      `pluginManifestsTarget.run` and `singleTenantFallback.run`.
  - **Fix:**
    - Extract one `polledSource`, and keep an ordered `[]source`.
    - Model the dashboard split as an explicit post-merge step, not inline code.

- [ ] **A4. Finish reshaping the config before anyone depends on it.**
  - **A4.1.** Rename `group_regex` and `plugins_group_regex` to `group_patterns` and
    `plugins_group_patterns`, and keep reading the old names with a warning.
  - **A4.2.** Replace the `cloud_app_platform_apiserver` name check in `aggregateTokenWrapper` with a
    per-target `auth = bearer | access_token`.
  - **A4.3.** Move the hardcoded stack URL template (`st_fallback.go`) into an `st_stack_url` key.
    Check that the slug is a DNS label before putting it into the host.
  - **A4.4 (changed).** A new `ProvideCloudRoutesLoader` wraps the factory, so the old "fold into it"
    plan would collide with that name. Instead, unexport `ProvideCloudRoutesLoaderFactory`, for
    example as `newCloudRoutesLoader`.

- [ ] **A5. A source teardown contract.** With A2, the loader tears down each source on shutdown.
  That replaces `defer t.closeConnections()` in `pluginManifestsTarget.run`.

- [ ] **A6. Keep ST knowledge out of the engine.**
  - **Problem:**
    - `loaderStatus.stackLookups` and `stackDiscoveryCache` (`sources.go`) put ST details in
      engine-side code: `discovery_status.go` `StackLookups`, the `routerCollector` series, and the
      "caller's stack" errors in `discovery_handler.go`.
    - `metrics.go` and `discovery_status.go` check `entry.handler` for
      `managesCircuitBreaking`/`breaksOnClientCalls`, and can't see through `requestRouter`.
      Reporting for `dashboard.grafana.app` is correct only because its owner is always an aggregate
      backend.
  - **Fix:**
    - Give `loaderStatus` a generic method for named counters.
    - Record each entry's breaker scope once in `publish`. That replaces the three repeated
      `managesCircuitBreaking || breaker == nil` checks.

- [ ] **A7. Split the largest files.**
  - `router.go` (831 lines): OpenAPI serving into `openapi_cache.go`, `authenticate` into `auth.go`,
    and `Run`/`reconcile`/`publish` into `reconcile.go`.
  - `st_fallback.go` (699 lines): stack resolution into `st_stacks.go`, and poll plus `fallbackBackend`
    into `st_poll.go`.
  - `discovery_manifests.go` (711 lines): index rendering into `discovery_index.go`, unless D5 deletes
    it.

- [ ] **A8. One backend wrapper.**
  - `pluginDeploymentBackend` (`plugin_manifests.go`) and `singleTenantResourcesBackend`
    (`st_resources.go`) each forward the optional interfaces by hand: `Manifest`, `PluginStatus` and
    `DiscoveryProvider`.
  - Give `PluginBackend` `source` and full-key fields, so the first wrapper goes away.
  - Make the second wrapper the one generic forwarder.

---

## O: Operability

- [ ] **O4. Log reconcile skip warnings once.** The warnings for reserved, invalid and duplicate
  groups (`router.go`) repeat on every reconcile, and R4's retries make that frequent. Log each one
  once per backend key. Do this with R4.

- [ ] **O5. 4xx access-log lines are logged at Warn.** Log 401, 403 and 404 at Debug (`logging.go`).

- [ ] **O6. Building two services panics.** This now covers four `MustRegister`/`promauto` sites:
  `newRouterMetrics`, `newService`, the plugin gRPC histogram and the retry counter. Reuse a collector
  on `AlreadyRegisteredError`, as `pkg/services/apiserver/builder/watch_metrics.go` does.

- [ ] **O7. The router reports ready before its first poll.**
  - `pollStatus` already counts successes and failures. Have `Load` return a pending error until every
    polled source has `successes+failures > 0`.
  - Today only the ST fallback does this (`errSingleTenantDiscoveryPending`).

- [ ] **O8. `plugins_url` and `core_url` have no `poll_interval` setting.** They reuse the aggregate
  backoff constants. This is follow-up 3 in `2026-09-11-router-aggregate-discovery-design.md`, and it
  can be done with A2.

- [ ] **O9. Core entries without an ID report `plugin_id=""`.**
  - This affects the plugin gRPC metrics and the status page `plugin` field.
  - Have `PluginStatus` return false for an empty ID, and label core connections by group instead.

---

## D: Dangling features and dead code

`deadcode` finds only two dead functions (test-only, D4). Most of the weight is code that only tests
or impossible configurations reach. No config in this repo sets any `[cloud_router]`,
`[router.aggregate.*]` or `[router.backend_grpc]` key. Check the deployment config before D9 and D10.

- [ ] **D1. Collapse the cloud branch of `ProvideRoutesLoader` and middleware-in-standalone.**
  - **Problem:**
    - `pkg/server/routes_loader.go` already calls `ProvideCloudRoutesLoader`, and falls back to the
      Wire injector only when it returns nil. The injector's `ProvideRoutesLoader` then parses the same
      config again, and can only get nil.
    - Inside Grafana, that branch would make every Grafana process poll the cloud sources.
    - `Service.HandleFunc`'s `unregisteredGroupHandler` branch never runs: `HandleFunc` is only called
      in-Grafana, where the handler is nil.
    - `ProvideGrafanaRouter` repeats `standaloneRouter(cfg)` inline.
  - **Fix:**
    - `ProvideRoutesLoader` serves local plugins only.
    - Fix P16.
    - Drop `!s.middleware` from `RegisterTargetRoutes`, and drop the dead `HandleFunc` branch.
    - Move `pkg/tests/apis/appplugin/router_test.go` to the factory.
  - **Saves:** about 25 lines, and one mode.

- [ ] **D2. Move the dummy loader to tests.**
  - `dummy.go` is reachable only when `deps.PluginSources == nil`, and Wire always provides it.
  - If it ever ran, it would advertise fake `dummy-backend-*` groups.
  - Move it into a `_test.go` file. Production should return an empty loader or an error.

- [ ] **D3. `singleTenantFallback` as a `RoutesLoader` is test-only.**
  - Delete `SingleTenantFallback()`, `Load`, `Notify` and the `discoveryHost == nil` branches
    (`st_fallback.go`). Tests can build it through `newCloudLoader`.
  - Unexport `LoaderWithSingleTenantFallback`, which has one production implementation and no
    external users.
  - **Saves:** about 40 lines.

- [ ] **D4. Remove test-only paths from production code.**
  - The `breakerState()` fallback to `breaker.State()` (`router.go`) breaks the AGENTS.md rule against
    reading `State()`. It runs only for test entries built without `newHandlerEntry`.
  - Remove the nil checks that only test literals need:
    - `router.go`: `watching`, `backend`, `endWatches`;
    - `watch.go`, `discovery_status.go`, `metrics.go`;
    - `plugin.go`: `cfg == nil`, `deps.Cfg != nil`;
    - `loader_factory.go`: `features == nil`;
    - `service.go`: `loader == nil`, `httpRouter == nil`, `!s.standalone`. `RegisterTargetRoutes`
      never returns an error.
  - Move `buildManifestDocs` and `manifestDocs.writeList` into tests.
  - Add a test helper for `servingEntry`.
  - **Saves:** about 35 lines.

- [ ] **D5. The `/apis/discovery/v1alpha2/AGENTS` HTML page (product call).**
  - **Problem:** nothing in the repo uses it except tests. It is the router's only use of
    `russross/blackfriday/v2`, and the largest place where plugin-controlled text is rendered.
  - **Options:**
    - Drop the HTML page: `renderIndexHTML`, `relativeLinksRenderer` and the head/foot. That saves
      about 50 lines of code and 35 of tests.
    - Also drop the markdown `AGENTS.md` index. That saves about 270 lines of code and 150 of tests.

- [ ] **D6. Dead dependency nil-ing in `pluginManifestsTarget.poll`.**
  - Setting `PluginClient`, `ContextProvider`, `PluginSettings` and `DualWrite` to nil has no
    effect: only `loadSettings` reads them, and manifest backends never call it.
  - Copy the deps once in `newPluginManifestsTarget`, and drop the stale comment. This pairs with A8.

- [ ] **D7. `PluginLoaderDependencies.AccessClient` is never read.**
  - It shadows the embedded `PluginDependencies.AccessClient`, which is the one used.
  - Optionally, replace the `ProvidePluginLoaderDependenciesWithClients` adapter (about 40 lines)
    with `wire.FieldsOf`, then run `make gen-go`.

- [ ] **D8. `compileGroupPatterns` returns an error that can't happen.** `QuoteMeta` parts joined by
  `.*` always compile. Drop the error and its two call-site checks.

- [ ] **D9. Leftovers from removed sources.**
  - The `appmanifest_apiserver_url`/`apiserver_url` guard (`cloud_router.go`, #134652): delete it once
    deployments are confirmed migrated.
  - The key-compatibility branch in `discoveredGroupKey`: keys live only in memory, so always hash.
  - Stale comments that mention forward backends or RouteBackend CRs: `discovery_cache.go`,
    `aggregate_router_test.go`, `metrics_test.go`.

- [ ] **D10. Config knobs to constants (check the deployment config first).**
  - `[router.backend_grpc]`: keep `tls_*` and `retry_max`. Make `connect_*`, `keepalive_*`,
    `max_*_msg_size`, `retry_backoff` and `retry_jitter` constants unless something sets them. That
    saves about 80 lines of parsing.
  - `st_cache_size`, `st_breaker_cache_size`, `st_lookup_burst` and `st_discovery_cache_bytes`: keep
    `st_lookup_rate`.
  - Keep `discovery_auth = none`; it was added on purpose (#134461).

- [ ] **D11. Small duplications, about 50 lines.**
  - Five sha256-hex helpers.
  - Three "write a cached doc with ETag and 304" paths: `serveCachedDoc`, the OpenAPI cache hit, and
    `serveStackDiscovery`.
  - Four transport builders.
  - The `poll_interval` parse duplicates `parsePositiveDurationKey`.
  - The trailing slash is trimmed three times.
  - Some defaults the parser already sets are set again.
  - `aggregateBackend.Load` wraps `b.proxy` in a needless `HandlerFunc`.
  - `buildAPIGroupList` and `buildOpenAPIV3Index` have marshal-error fallbacks that can't happen.
  - `apiGroupDiscoveryListToGroups` builds an intermediate slice it doesn't need.

---

## F: Performance

Baseline on an M5 Pro, from `router_bench_test.go`:

| Path | ns/op | allocs/op |
| --- | --- | --- |
| Middleware resource request | 1224 | 35 |
| Standalone resource request | 864 | 29 |
| Legacy `/apis`, cached | 455 | 16 |
| Unchanged reconcile, 100 groups | 491 µs | 24.7k |

GC is about 28% of CPU on the middleware path, so cutting allocations is the main lever. The
benchmarks never exercise a real proxy, aggregated `/apis`, the ST fallback or plugin calls, so
add those first (F12).

- [ ] **F1. Aggregated `/apis` is rebuilt on every request, and logs a line per group-version.**
  - **Problem:**
    - `serveAggregatedDiscovery` (`discovery_handler.go`) builds a new
      `aggregated.NewResourceManager` and calls `SetGroups` per request.
    - `SetGroups` logs `klog.Infof("Adding GroupVersion …")` for every group-version. Inside Grafana,
      klog goes to the `grafana-apiserver` logger, so each `/apis` request writes about 150 Info
      lines.
    - The request then re-marshals the list and computes its ETag.
    - Measured: 371 µs and 1938 allocs at 100 groups (94% of the CPU is klog), and 616 µs at 50
      embedded groups in middleware mode.
    - The source answer is decoded twice, and `discoveryCache.mu` is taken once per group.
  - **Fix:**
    - Build the sorted `APIGroupDiscoveryList` directly. Every priority is 1000, so sort by name.
    - Serve it with `aggregated.ServeHTTPWithETag`.
    - Memoize it, keyed by:
      - the snapshot pointer;
      - a `discoveryCache` generation;
      - a fingerprint of the source answer;
      - the negotiated version;
      - whether the answer is caller-scoped.
    - The source-answer fingerprint keeps ST callers on different stacks apart.
  - **Gain:** about 10x on a miss, 100x or more on a hit, and no more log spam.

- [ ] **F2. Merged legacy `/apis` and `/openapi/v3` are rebuilt on every request.**
  - **Problem:** in middleware and ST modes, each request clones the request, captures the source's
    body, unmarshals it, merges, marshals and hashes the result. Measured: 89 µs and 151 allocs for
    `/apis`, and 57 µs and 806 allocs for `/openapi/v3`.
  - **Fix:** memoize the merged document, keyed by the source body's ETag or hash plus the snapshot
    pointer.
  - Update the AGENTS.md wording "built on every request" to say "merged per source answer".

- [ ] **F3. No `BufferPool` on any `ReverseProxy`.** Each proxied request allocates a 32 KB buffer.
  One shared `sync.Pool`-backed `httputil.BufferPool` takes a 1 KB proxied request from 41 KB to
  9 KB, and from 7.9 µs to 5.8 µs.

- [ ] **F4. The ST transport allows 2 idle connections per host.**
  - Stacks speak plaintext HTTP/1.1, so there is no HTTP/2 multiplexing.
  - At 72 concurrent clients, measured 0.49 new dials per request, and a sustained run exhausted
    ephemeral ports.
  - Set `MaxIdleConnsPerHost` to about 32 and `MaxIdleConns` to about 1000.

- [ ] **F5. `otel.Tracer()` per request takes a global mutex.** In the 100-group parallel benchmark,
  that mutex is 93% of mutex contention (`tracing.go`). Use a package-level tracer. Measured:
  383 → 350 ns/op.

- [ ] **F6. The access log builds its arguments when Debug is off.** That costs 6 allocs per request
  (`logging.go`). Return early for statuses below 400 when Debug isn't enabled. Measured: 80 → 4 ns,
  0 allocs.

- [ ] **F7. One request-state context value.**
  - `withRequestOutcome`, the tracing span value, `withProxyFailure` and the client breaker each call
    `WithContext`. `serveThroughBreaker` also allocates a `sync.Once` and two closures.
  - `Request.WithContext` is 36% of the bytes allocated in the middleware path.
  - Carry one struct instead, and move the report state onto `statusRecorder`. Breaker semantics must
    not change. Expected: about 6–8 allocs per request.

- [ ] **F8. Cache request-metric observers.** `WithLabelValues` is about 9% of middleware CPU, and
  `strconv.Itoa(status)` allocates. Cache an observer per (group, verb, route), and precompute the
  status strings.

- [ ] **F9. ST `forward` builds a `ReverseProxy` and an `otelhttp.NewTransport` per request.** Build
  the transport once, and cache the proxy per resolved host.

- [ ] **F10. Outside `pkg/router`: the local token exchanger signs a JWT per plugin call.**
  - That costs 31 µs and 405 allocs per local plugin call (`pkg/plugins/backendplugin/v3/local_exchanger.go`).
  - Add a TTL cache keyed by the full subject token, namespace, audiences and permissions.
  - An entry must expire well before `localTokenTTL`, and never after its subject token.
  - This needs the plugins squad's review.

- [ ] **F11. Small, cheap fixes.**
  - `statusRecorder.FlushError` allocates a `ResponseController` on every flush, which for a watch is
    every event. Type-assert first.
  - Use `strings.Cut` instead of `strings.Split` on the per-request paths: OpenAPI path parsing,
    `st_fallback.go` and `st_resources.go`.
  - Hash ETags by streaming the body, without copying it twice.
  - Sort the manifest backends once per `publish`, not three times. That is about 30% of an
    unchanged reconcile.

- [ ] **F12. Add benchmarks for the real hot paths:**
  - a proxy through an aggregate backend;
  - aggregated `/apis`;
  - middleware root discovery with a real `next`;
  - an ST forward;
  - a per-event watch flush;
  - a plugin call.

  Prototypes from the 2026-10-23 review can be reused.

Not pursued:

- **`FlushInterval = -1` for non-watch requests.** It costs about 11% at 16 KB and nothing
  measurable at 8 MB. Changing it means amending the "flush after each write" rule.
- **The gobreaker mutex on one hot group.** It costs 880 against 380 ns/op. Fixing it means replacing
  gobreaker, which AGENTS.md requires.

---

## T: Test gaps

- [ ] **T1. The `dashboard.grafana.app` split.** No tests for:
  - a watch on `librarypanels` through the split: watch accounting, and the watch ending when the
    dashboard key changes;
  - OPTIONS;
  - a user's cluster-scoped write;
  - the breaker scope shown in status and metrics.

  Also confirm that a user's write to ST is visible to a later read from MT.
- [ ] **T2. Plugin gRPC.** No end-to-end test against a real `grpc.Server` for retries, keepalive
  (P18) or a dropped connection.

---

## C: Cleanup and docs

- [ ] **C7. AGENTS.md and specs drift.**
  - AGENTS.md:
    - It says `/apis` lists `discovery` and that `/openapi/v3` indexes it. Inside Grafana without the
      flag, `HandleFunc` serves only the discovery tree, so neither is true there.
    - It says `mdText` and `mdCode` are "bounded in length", but `mdCode` isn't bounded. Either bound
      it or fix the doc.
    - The status page contents omit `stackLookups`.
    - Fix the broken line wrap in the circuit breaker rule.
  - `discovery_manifests.go` renders "returns a `{Kind}List`;." with a stray `;`.
  - `2026-09-25-router-design-notes.md`:
    - Add the `dashboard.grafana.app` exception to "one backend owns all versions".
    - Rename `ProvideCloudRoutesLoaderFactory` to match A4.4.
  - `2026-09-26-router-metrics.md`:
    - Add the plugin-ID skip (#135273).
    - `NewPluginBackend` is now `newPluginBackend`.
    - Note that for `dashboard.grafana.app`, `breaker_state` reflects only the MT backend.
  - The superseded 2026-08-17 and 2026-08-19 specs: add a change-box line for `handlerFor`, the ST
    breakers, caller-scoped ST discovery and `/apis/discovery`.
- [ ] **C8. Small code notes.**
  - Add a one-line comment that `rejectUpgrade` doesn't handle HTTP/2 extended CONNECT.
  - Rename `aggregate_backoff.go` to `cooldown.go`, since it paces four loops.
  - Add `var _ Router = (*GrafanaRouter)(nil)`.
