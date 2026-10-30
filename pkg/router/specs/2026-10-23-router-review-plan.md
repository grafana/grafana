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
  cluster-scoped requests (#135272). Breaking per destination for traffic from ST (#135169) was
  reverted (#135232).

Updated on 2026-10-26 from `main` at 72c31f1a155. Since the rebuild, four router PRs landed outside
the plan and changed what some items mean:

- **#135946: the router serves `/apis` and `/openapi/v3` directly.** In middleware mode it now
  hosts the embedded API server's groups in process (`embedded.go`), and nothing falls through to
  `next`. Root discovery in middleware mode is built from the snapshot, so F2 now applies only to
  the ST path. Request parsing moved to `pkg/apimachinery/utils.NewRequestInfo`, and the `/watch/`
  and `/proxy/` path forms now get a 400.
- **#135815: HTTP operators through a plugin v3 client shim** (`pluginsintegration/baasbridge`,
  deprecated). Its README lists known gaps, among them no gRPC request metrics for these calls.
- **#135990: `[router.dev.<name>]` dev targets** serve an app from a local manifest file through
  the local plugin loader, over gRPC or baasbridge. A new `dev` source.
- **#135949: status and manifests pages** in the swagger UI, and compiled-in app manifests for
  groups whose backend advertises none.

Updated on 2026-10-27 from `main` at af1cc0cd8a5. #136088 landed the restructure (A2, A5–A8), and
A1 was dropped. Open: A4, T1–T3, the metrics follow-ups, and the performance leftovers.

Updated on 2026-10-30 from `main` at 657adeb4afd. Five router PRs landed outside the plan: group
visibility (#136246, see `2026-10-28-router-group-visibility-design.md`), the tabbed status page
with an admin-only status endpoint (#136398), core app requests recorded under their API group
(#136445), the `bridge_url` source and manifests targets as a list (#136562), and
`appplugins.registerAPIServer` read through OpenFeature (#136142). A review found build, vet,
`-race` tests and lint clean, and the plan's R, P, O, C and D items all landed. A4 steps 2 and 3
need the cloud rollout. T2 and T3 are done, and T1 is partly covered.

The new sections in this plan:

- **D**: dangling features and dead code to remove.
- **F**: performance.

Metrics follow-ups (M5–M7, M9–M12) are in `2026-10-08-router-metrics-review.md`; all were done on
2026-10-30.

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
| P15, P16: stale OpenAPI hashes on the ST path, standalone router as middleware | #135730 |
| P22: a namespace check before dispatch | #135740 |
| P18, P19, D1: plugin gRPC keepalive (5m, and pings only during calls), the settings flag read once, the cloud branch of `ProvideRoutesLoader` | #135742 |
| F1 (partly), F3–F6, F12 (partly): aggregated `/apis` without a discovery manager, one proxy buffer pool, more idle ST connections, a cached tracer, no Debug access-log work when Debug is off, benchmarks for a proxied request, aggregated `/apis` and middleware root discovery | #135743 |
| D2–D4, D6–D9, D11 (partly): the dead-code sweep | #135744 |
| R1, R2: retired plugin handlers are destroyed once they drain, and managed plugin connections close with their last handler | #135809 |
| R4, O4: a failing backend backs off per group, reconcile warnings are logged once, and the status page lists load failures | #135818 |
| C7, C8: docs and specs caught up with #135946 and #135949, `mdCode` bounded, `cooldown.go` | #136005 |
| A2, A5, A8: one `polledSource`, an ordered source list with a `mergeStep` for the dashboard split, teardown on stop, one `wrappedBackend` | #136088 |
| A6: generic loader counters, the unregistered-group handler named generically, breaker scope recorded once in `publish` and seen through the dashboard split | #136088 |
| A7: `router.go` split into `reconcile.go`, `auth.go` and `openapi_cache.go`; `st_fallback.go` into `st_stacks.go` and `st_poll.go`; the index into `discovery_index.go` | #136088 |
| O5–O9: 4xx at Debug, no panic on a second registration, ready only after each source's first poll, `plugins_poll_interval` and `core_poll_interval`, no `plugin_id=""` | #135820 |
| P14, P17, P20, P21: the `/watch/` path rejected, router deadlines counted against the breaker, the ST discovery cache bounded, partial discovery kept | #135823 |
| F7, F8, F9 (partly), F11 (partly), F12 (partly): one request-state value, a `status_code` table, one ST transport, a cheaper flush, `strings.Cut`, streamed ETag hashing, an ST forward benchmark | #135946, #135827 |

### Not pursued

| Item | Why |
| --- | --- |
| R5: no plugin handlers when nothing routes them | Loading them inside Grafana exercises their setup, and they will be routed soon (user decision, 2026-10-23). |
| D5: drop the `/apis/discovery/v1alpha2/AGENTS` page and index | Kept (user decision, 2026-10-23). |
| D10: config knobs to constants | Every knob is kept (user decision, 2026-10-23). |
| A1: a subpackage per source | Each source uses 16 to 35 unexported engine identifiers, and the cloud loader imports every source, so the engine would need its own lower package and an exported internal API, with most tests crossing the line. A6 and A7 keep the sources apart by file and by rule instead. Revisit if the package gets a second consumer (user decision, 2026-10-27). |

### Left from partly done items

- **F1:** the aggregated document is still encoded twice per request (once for the ETag) and hashed
  with SHA-512. At 100 groups that costs 165 µs and 291 allocs, against about 0.5 µs for every other
  cached discovery document. Since #135946, a request with no source answer (middleware mode, and ST
  callers that get the defaults) can be memoized on the snapshot pointer, a `discoveryCache`
  generation and the negotiated version alone. A caller-scoped ST answer still needs the source
  bytes in the key, as does F2.
- **F9:** the ST transport is built once (#135827), but `forward` still builds a `ReverseProxy` per
  request (`st_fallback.go`).
- **F11:** sorting the manifest backends once per `publish` (`sortedManifestBackends` is still
  called from `discovery.go` twice and `discovery_manifests.go` once).
- **F12:** benchmarks for a per-event watch flush and a plugin call.
- **D3:** the `discoveryHost == nil` branches in the single-tenant fallback, which most fallback tests rely on.
- **D4:** the `watching` and `endWatches` nil checks, which tests build entries without.
- **D9:** the legacy `appmanifest_apiserver_url` guard, until deployments are confirmed migrated.
- **D11:** sorting manifest backends once per publish, the marshal-error fallbacks in `buildAPIGroupList` and `buildOpenAPIV3Index`, the transport builders and trailing-slash handling.

## About the `router-review*` branches

- **`router-review`**: fully landed (#133537).
- **`router-review-2`**: fully landed, except "Keep what an incomplete discovery fetch read"
  (cb8b367edd4). That is now P21.
- **`router-review-3`**: forked 2026-09-28. `main` is now more than 1100 commits ahead of it, 48
  of them in `pkg/router`.
  - R1, R2, R4, P14, O5 and O6 have landed on `main` on their own, so those commits are moot.
  - A4.2 and A4.3 (ac69ebc3ce1) are redone on `router/a4-config` instead, not ported (see A4).
  - A2 and A5 (56915e172f8) are obsolete, since they were built around the removed RouteBackend
    source. Keep only the design.

---

## Suggested order

1. **Done:** every R, P, O and C item, every A item except A4, the dead-code sweep, and most of F.
2. **Config:** A4, while nothing depends on the old key names.
3. **Tests:** T1–T3, and F12's watch-flush and plugin-call benchmarks.
4. **Metrics:** done (M5–M7 and M9–M12 in `2026-10-08-router-metrics-review.md`), except metrics
   for the `baasbridge` calls (#135815).
5. **Performance leftovers, if profiles call for them:** F1's memo, F2, F9's proxy, F10, F11's sort.

---

## R: Resource lifecycle

- [x] **R1. Retired plugin handlers are never destroyed.**
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

- [x] **R2. gRPC connections to removed plugin hosts stay open.** Connections are keyed by host and
  plugin ID (`pluginManifestsTarget.connections`), and close only when `run` returns. Have each handler
  hold a reference to its connection, and release it in `Destroy`. Depends on R1.

- [x] **R4. A backend that keeps failing is rebuilt about once a minute.**
  - **Problem:** a partial reconcile failure is retried at `reconcileRetryMax`. Each retry calls the
    failing `Load` again and logs at Error.
  - **Fix:** keep a failure count per group, keyed by backend key, and back off per group. A new key
    resets the count.
  - Do O4 in the same change.

- [x] **R5. Inside Grafana without the middleware flag, every plugin backend is still built.** Not
  pursued (see "Not pursued").
  - **Problem:** the `Service` now always runs, so that `/apis/discovery` stays current. `reconcile`
    therefore calls `Backend.Load` for every local manifest-bearing plugin and settings backend, and
    `HandleFunc` never serves one of them. The cost is an API server per plugin at startup (leaked,
    see R1), plus R4's error log every minute for a broken manifest.
  - **Fix:** when the router doesn't route, publish manifests from `Load()` without calling
    `Backend.Load`, for example with a "manifests only" reconcile mode.

---

## P: Correctness

- [x] **P14. The deprecated `/watch/` path still classifies as a watch.** Done in #135823 (a 404),
  then a 400 from `NewRequestInfo` in #135946.
  - `requestVerb` (`watch.go`) maps `/apis/<g>/<v>/watch/...` to verb `watch`.
  - That path form is out of scope, so it should get no watch treatment. Reject it, for example with
    a 404, at both `rejectUpgrade` sites.
  - It also names no namespace for P22's check, so only its backend authorizes it. A rejection was
    tried in #135740 and dropped, to keep that PR to the namespace check.

- [x] **P15. A stale OpenAPI `hash` becomes a 502 on the ST path.** Done in #135730.
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

- [x] **P16. The standalone router drops every cloud source when `grafanaUseRouterMiddleware` is on.**
  Done in #135730, which also dropped `!s.middleware` from `RegisterTargetRoutes`.
  - **Problem:** `middlewareEnabled` (`loader_factory.go`) returns true in the standalone target when
    the flag is on.
    - `ProvideRoutesLoader` then skips the cloud loader.
    - `RegisterTargetRoutes` drops the ST fallback (`!s.middleware`).
    - If the flag reaches the router's deployment, the router serves only local plugins and still
      reports ready. `service_test.go` asserts this today.
  - **Fix:** `middlewareEnabled` returns false whenever `standaloneRouter(cfg)` is true. See D1 for
    the rest of that branch.

- [x] **P22. Check the namespace before dispatch.** Done in #135740.
  - This is hardening: backends already enforce namespaces, and this cheap check runs before them.
  - After `authenticate`, a request whose path names a namespace
    (`/apis/<g>/<v>/namespaces/<ns>[/...]`) gets a 403 `Status` unless its requester may use that
    namespace (`authorizeNamespace`). Allowed: the requester's own namespace, any for `*`, and any
    for Grafana admins.
  - Anonymous users may use only their own namespace, which is stricter than the embedded API
    server's namespace authorizer.

- [x] **P17. Deadlines the router sets itself never count against a breaker.** Done in #135823
  (`errRouterDeadline`). A per-version discovery that misses its deadline counts once.
  - **Problem:** `breakerOutcome` treats any `req.Context().Err()` as `errCallerGone`. That includes
    the router's own fetch deadlines:
    - the ST shared discovery fetch, 30 s;
    - root discovery through the fallback, 5 s.
  - A stack that hangs on discovery therefore never trips its breaker.
  - **Fix:** set router-imposed deadlines with `context.WithTimeoutCause` and a distinct cause.
    Exclude only the caller's own cancellation.

- [x] **P18. The default plugin gRPC keepalive fights the plugin servers.**
  - **Problem:** the default `keepalive_time` is 20 s, with `PermitWithoutStream`.
    - grafana-plugin-sdk-go and grafana-app-sdk servers keep gRPC's default enforcement policy: no
      pings more often than every 5 min, and none without an active stream.
    - So idle connections get GOAWAY `too_many_pings`, and the client keeps doubling its interval and
      reconnecting.
    - A stream in flight on a closed connection fails; streams are not retried.
  - **Fix:** default `keepalive_time` to `0` (off) or at least `5m`. Alternatively, set a matching
    enforcement policy in both SDKs.

- [x] **P19. `FlagApppluginsRegisterAPIServer` is read in two different ways.**
  - `newPluginSettingsBackend`'s caller (`plugin.go`) evaluates it through OpenFeature on every
    `Load`.
  - `middlewareEnabled` uses the static `IsEnabledGlobally`.
  - If the two disagree, settings backends are built but never served, or the router takes over
    plugin groups without serving their settings.
  - **Fix:** read the flag once, and pass the result into `PluginLoader`.

- [x] **P20. A small `st_discovery_cache_bytes` evicts everything.** Done in #135823: such a document
  is not stored. With a budget below
  `maxSingleTenantCachedDiscoveryBytes`, one large document makes `RemoveOldest` evict every stack's
  entries, the new one included. Refuse entries larger than the budget, or require the budget to be at
  least that limit.

- [x] **P21. An incomplete discovery fetch throws away what it read.** Done in #135823.
  - `groupDiscovery` (`discovery_cache.go`) drops a partial fetch and returns versions only.
  - Port cb8b367edd4 from `router-review-2`. It still applies, and matters for older backends that
    use per-version discovery.

---

## A: Architecture

A1 is not pursued (see "Not pursued").

- [x] **A2. Replace `cloudLoader`'s hardcoded merge with an ordered list of sources.**
  - **Problem:**
    - `cloudLoader.Load` writes the priority order out by hand, and now ends with a post-merge step
      that wraps `dashboard.grafana.app`.
    - `running` and `sourceStatuses` repeat the source list.
    - The three poll loops are still the same shape: `aggregateTarget.run`,
      `pluginManifestsTarget.run` and `singleTenantFallback.run`.
  - **Fix:**
    - Extract one `polledSource`, and keep an ordered `[]source`.
    - Model the dashboard split as an explicit post-merge step, not inline code.

- [ ] **A4. Finish reshaping the config before anyone depends on it.** Step 1 is on
  `router/a4-config`. The cloud config is `ksonnet/environments/grafana-router/main.jsonnet` in
  `deployment_tools`. It sets `group_regex` on `cloud_app_platform_apiserver` and `baas_apiserver`,
  and only `cloud_app_platform_apiserver` signs its discovery polls; every other target sets
  `discovery_auth = none`.
  - **A4.1.** Rename `group_regex` and `plugins_group_regex` to `group_patterns` and
    `plugins_group_patterns`. The old names are still read, with a warning, and setting both is an
    error. They must be: an image that ignored them would match every group the target serves.
  - **A4.2 (changed).** The token header only matters for the router's own discovery polls, so it
    is a new `discovery_auth = bearer` value (`Authorization`), next to `cap_token`
    (`X-Access-Token`) and `none`, instead of a separate `auth` key. Until the deployment sets it,
    `cloud_app_platform_apiserver` without `discovery_auth` still gets `bearer` by name.
  - **A4.3 (changed).** The slug from grafana.com must be a DNS label before it goes into the stack
    host. No `st_stack_url` key: every cluster uses the same template, so it is a constant
    (`singleTenantStackURLFormat`) until one needs another.
  - **A4.4 (changed).** Rename `ProvideCloudRoutesLoaderFactory` to `NewCloudRoutesLoader`. It
    isn't a Wire provider, and it stays exported because tests in `pkg/server` and
    `pkg/tests/apis/appplugin` build it with their own dependencies.
  - **Rollout.** Each config change follows the image. An older image ignores `group_patterns` and
    fails at startup on `discovery_auth = bearer`.
    1. The router change above, which keeps today's config working.
    2. Once that image is in every wave, `main.jsonnet`: `group_regex` to `group_patterns`, and
       `discovery_auth: 'bearer'` on `cloud_app_platform_apiserver`.
    3. Then drop the name check, and either drop the old key names or fail on them at startup, as
       `appmanifest_apiserver_url` does.

- [x] **A5. A source teardown contract.** With A2, the loader tears down each source on shutdown.
  That replaces `defer t.closeConnections()` in `pluginManifestsTarget.run`.

- [x] **A6. Keep ST knowledge out of the engine.**
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

- [x] **A7. Split the largest files.** Line counts as of 2026-10-26.
  - `router.go` (980 lines): OpenAPI serving into `openapi_cache.go`, `authenticate` into `auth.go`,
    and `Run`/`reconcile`/`publish` into `reconcile.go`.
  - `st_fallback.go` (733 lines): stack resolution into `st_stacks.go`, and poll plus `fallbackBackend`
    into `st_poll.go`.
  - `discovery_manifests.go` (789 lines): index rendering into `discovery_index.go` (D5 keeps it).

- [x] **A8. One backend wrapper.**
  - `pluginDeploymentBackend` (`plugin_manifests.go`) and `singleTenantResourcesBackend`
    (`st_resources.go`) each forward the optional interfaces by hand: `Manifest`, `PluginStatus` and
    `DiscoveryProvider`.
  - Give `PluginBackend` `source` and full-key fields, so the first wrapper goes away.
  - Make the second wrapper the one generic forwarder.

---

## O: Operability

- [x] **O4. Log reconcile skip warnings once.** The warnings for reserved, invalid and duplicate
  groups (`router.go`) repeat on every reconcile, and R4's retries make that frequent. Log each one
  once per backend key. Do this with R4.

O5–O9 were done in #135820.

- [x] **O5. 4xx access-log lines are logged at Warn.** Log 401, 403 and 404 at Debug (`logging.go`).

- [x] **O6. Building two services panics.** This now covers four `MustRegister`/`promauto` sites:
  `newRouterMetrics`, `newService`, the plugin gRPC histogram and the retry counter. Reuse a collector
  on `AlreadyRegisteredError`, as `pkg/services/apiserver/builder/watch_metrics.go` does.

- [x] **O7. The router reports ready before its first poll.** A failed first poll ends the wait too.
  - `pollStatus` already counts successes and failures. Have `Load` return a pending error until every
    polled source has `successes+failures > 0`.
  - Today only the ST fallback does this (`errSingleTenantDiscoveryPending`).

- [x] **O8. `plugins_url` and `core_url` have no `poll_interval` setting.** Now
  `plugins_poll_interval` and `core_poll_interval`. They reuse the aggregate
  backoff constants. This is follow-up 3 in `2026-09-11-router-aggregate-discovery-design.md`, and it
  can be done with A2.

- [x] **O9. Core entries without an ID report `plugin_id=""`.**
  - This affects the plugin gRPC metrics and the status page `plugin` field.
  - Have `PluginStatus` return false for an empty ID, and label core connections by group instead.

---

## D: Dangling features and dead code

`deadcode` finds only two dead functions (test-only, D4). Most of the weight is code that only tests
or impossible configurations reach. No config in this repo sets any `[cloud_router]`,
`[router.aggregate.*]` or `[router.backend_grpc]` key. Check the deployment config before D9 and D10.

- [x] **D1. Collapse the cloud branch of `ProvideRoutesLoader` and middleware-in-standalone.**
  - **Problem:**
    - `pkg/server/routes_loader.go` already calls `ProvideCloudRoutesLoader`, and falls back to the
      Wire injector only when it returns nil. The injector's `ProvideRoutesLoader` then parses the same
      config again, and can only get nil.
    - Inside Grafana, that branch would make every Grafana process poll the cloud sources.
    - `Service.HandleFunc`'s `unregisteredGroupHandler` branch never runs: `HandleFunc` is only called
      in-Grafana, where the handler is nil.
    - `ProvideGrafanaRouter` repeats `standaloneRouter(cfg)` inline.
  - **Fix:**
    - `ProvideRoutesLoader` serves local plugins only. P16 (#135730) already made the standalone
      router never middleware, and dropped `!s.middleware` from `RegisterTargetRoutes`.
    - Drop the dead `HandleFunc` branch.
    - Move `pkg/tests/apis/appplugin/router_test.go` to the factory.
  - **Saves:** about 25 lines, and one mode.

- [x] **D2. Move the dummy loader to tests.**
  - `dummy.go` is reachable only when `deps.PluginSources == nil`, and Wire always provides it.
  - If it ever ran, it would advertise fake `dummy-backend-*` groups.
  - Move it into a `_test.go` file. Production should return an empty loader or an error.

- [x] **D3. `singleTenantFallback` as a `RoutesLoader` is test-only.** Partly done; see "Left from
  partly done items".
  - Delete `SingleTenantFallback()`, `Load`, `Notify` and the `discoveryHost == nil` branches
    (`st_fallback.go`). Tests can build it through `newCloudLoader`.
  - Unexport `LoaderWithSingleTenantFallback`, which has one production implementation and no
    external users.
  - **Saves:** about 40 lines.

- [x] **D4. Remove test-only paths from production code.** Partly done; see "Left from partly done
  items".
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

- [x] **D5. The `/apis/discovery/v1alpha2/AGENTS` HTML page (product call).** Not pursued (see
  "Not pursued").
  - **Problem:** nothing in the repo uses it except tests. It is the router's only use of
    `russross/blackfriday/v2`, and the largest place where plugin-controlled text is rendered.
  - **Options:**
    - Drop the HTML page: `renderIndexHTML`, `relativeLinksRenderer` and the head/foot. That saves
      about 50 lines of code and 35 of tests.
    - Also drop the markdown `AGENTS.md` index. That saves about 270 lines of code and 150 of tests.

- [x] **D6. Dead dependency nil-ing in `pluginManifestsTarget.poll`.**
  - Setting `PluginClient`, `ContextProvider`, `PluginSettings` and `DualWrite` to nil has no
    effect: only `loadSettings` reads them, and manifest backends never call it.
  - Copy the deps once in `newPluginManifestsTarget`, and drop the stale comment. This pairs with A8.

- [x] **D7. `PluginLoaderDependencies.AccessClient` is never read.**
  - It shadows the embedded `PluginDependencies.AccessClient`, which is the one used.
  - Optionally, replace the `ProvidePluginLoaderDependenciesWithClients` adapter (about 40 lines)
    with `wire.FieldsOf`, then run `make gen-go`.

- [x] **D8. `compileGroupPatterns` returns an error that can't happen.** `QuoteMeta` parts joined by
  `.*` always compile. Drop the error and its two call-site checks.

- [x] **D9. Leftovers from removed sources.** Done except the legacy-key guard; see "Left from
  partly done items".
  - The `appmanifest_apiserver_url`/`apiserver_url` guard (`cloud_router.go`, #134652): delete it once
    deployments are confirmed migrated.
  - The key-compatibility branch in `discoveredGroupKey`: keys live only in memory, so always hash.
  - Stale comments that mention forward backends or RouteBackend CRs: `discovery_cache.go`,
    `aggregate_router_test.go`, `metrics_test.go`.

- [x] **D10. Config knobs to constants (check the deployment config first).** Not pursued (see
  "Not pursued").
  - `[router.backend_grpc]`: keep `tls_*` and `retry_max`. Make `connect_*`, `keepalive_*`,
    `max_*_msg_size`, `retry_backoff` and `retry_jitter` constants unless something sets them. That
    saves about 80 lines of parsing.
  - `st_cache_size`, `st_breaker_cache_size`, `st_lookup_burst` and `st_discovery_cache_bytes`: keep
    `st_lookup_rate`.
  - Keep `discovery_auth = none`; it was added on purpose (#134461).

- [x] **D11. Small duplications, about 50 lines.** Partly done; see "Left from partly done items".
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

Measured on an M5 Pro with `router_bench_test.go`. The 2026-10-23 column is the original baseline;
the 2026-10-26 column was run on `main` at e29755d49bc, `-benchtime 1s`, one run.

| Path | 2026-10-23 | 2026-10-26 |
| --- | --- | --- |
| Middleware resource request | 1224 ns, 35 allocs | 953 ns, 19 allocs |
| Middleware embedded-group request | n/a (handed to `next`) | 443 ns, 6 allocs |
| Standalone resource request | 864 ns, 29 allocs | 710 ns, 16 allocs |
| Legacy `/apis`, cached | 455 ns, 16 allocs | 217 ns, 7 allocs |
| Middleware root `/apis` | 93 µs, 151 allocs | 510 ns, 12 allocs |
| Aggregated `/apis`, 100 groups | 371 µs, 1938 allocs | 166 µs, 291 allocs |
| Proxied request, 1 KiB | 7.9 µs | 5.1 µs, 71 allocs |
| ST forward | n/a | 4.7 µs, 68 allocs |
| Unchanged reconcile, 100 groups | 491 µs, 24.7k allocs | 476 µs, 24.5k allocs |

GC was about 28% of CPU on the middleware path, so cutting allocations was the main lever. The
open items with real gains left are aggregated `/apis` (F1) and reconcile (F11's sort).

- [x] **F1. Aggregated `/apis` is rebuilt on every request, and logs a line per group-version.**
  Done except the memo; see "Left from partly done items".
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
  - **Update (#135946):** middleware mode no longer merges; it builds root discovery from the
    snapshot, at 510 ns. This is now about the ST fallback only.
  - **Problem:** in ST mode, each request clones the request, captures the source's
    body, unmarshals it, merges, marshals and hashes the result. Measured: 89 µs and 151 allocs for
    `/apis`, and 57 µs and 806 allocs for `/openapi/v3`.
  - **Fix:** memoize the merged document, keyed by the source body's ETag or hash plus the snapshot
    pointer.
  - Update the AGENTS.md wording "built on every request" to say "merged per source answer".
  - The local branch `router/perf-discovery-memo` (24186ee3e90) has an LRU memo for both paths, from
    before #135946. Redo it for the ST path only.

- [x] **F3. No `BufferPool` on any `ReverseProxy`.** Each proxied request allocates a 32 KB buffer.
  One shared `sync.Pool`-backed `httputil.BufferPool` takes a 1 KB proxied request from 41 KB to
  9 KB, and from 7.9 µs to 5.8 µs.

- [x] **F4. The ST transport allows 2 idle connections per host.**
  - Stacks speak plaintext HTTP/1.1, so there is no HTTP/2 multiplexing.
  - At 72 concurrent clients, measured 0.49 new dials per request, and a sustained run exhausted
    ephemeral ports.
  - Set `MaxIdleConnsPerHost` to about 32 and `MaxIdleConns` to about 1000.

- [x] **F5. `otel.Tracer()` per request takes a global mutex.** In the 100-group parallel benchmark,
  that mutex is 93% of mutex contention (`tracing.go`). Use a package-level tracer. Measured:
  383 → 350 ns/op.

- [x] **F6. The access log builds its arguments when Debug is off.** That costs 6 allocs per request
  (`logging.go`). Return early for statuses below 400 when Debug isn't enabled. Measured: 80 → 4 ns,
  0 allocs.
  - Follow-up: the early return checked for an `Enabled` method, which the SDK's `SLogLogger`
    (the logger Grafana installs) doesn't have, so it never fired in production. `debugEnabled`
    now asks its `slog.Logger`, and the trace context is resolved only for lines that are written.
    Measured: middleware resource 31 → 26 allocs, middleware 404 20 → 14 allocs.

- [x] **F7. One request-state context value.**
  - `withRequestOutcome`, the tracing span value, `withProxyFailure` and the client breaker each call
    `WithContext`. `serveThroughBreaker` also allocates a `sync.Once` and two closures.
  - `Request.WithContext` is 36% of the bytes allocated in the middleware path.
  - Carry one struct instead, and move the report state onto `statusRecorder`. Breaker semantics must
    not change. Expected: about 6–8 allocs per request.
  - Done: `backendCall` carries the span, client breaker and proxy error under one key; a nested call
    shares its outer call's breaker and proxy error. The request outcome also carries the request
    info. Measured: resource 26 → 20 allocs (843 → 782 ns), middleware resource 37 → 31 allocs
    (1.24 → 1.15 µs).

- [x] **F8. Cache request-metric observers.** `WithLabelValues` is about 9% of middleware CPU, and
  `strconv.Itoa(status)` allocates. Cache an observer per (group, verb, route), and precompute the
  status strings.
  - Status strings done (`statusCodeLabel`, ported from #135827). Caching observers was measured
    there at about 2% of CPU and not done.

- [ ] **F9. ST `forward` builds a `ReverseProxy` and an `otelhttp.NewTransport` per request.** Build
  the transport once, and cache the proxy per resolved host.
  - Transport done in #135827; it is rebuilt only when the global meter provider changes. The
    proxy is still built per request.

- [ ] **F10. Outside `pkg/router`: the local token exchanger signs a JWT per plugin call.**
  - That costs 31 µs and 405 allocs per local plugin call (`pkg/plugins/backendplugin/v3/local_exchanger.go`).
  - Add a TTL cache keyed by the full subject token, namespace, audiences and permissions.
  - An entry must expire well before `localTokenTTL`, and never after its subject token.
  - This needs the plugins squad's review.

- [ ] **F11. Small, cheap fixes.** Only the sort is left.
  - `statusRecorder.FlushError` allocates a `ResponseController` on every flush, which for a watch is
    every event. Type-assert first. (Done, ported from #135827.)
  - Use `strings.Cut` instead of `strings.Split` on the per-request paths: OpenAPI path parsing
    (done, ported from #135827), `st_fallback.go` and `st_resources.go` (done in #135827).
  - Hash ETags by streaming the body, without copying it twice. (Done in #135827.)
  - Sort the manifest backends once per `publish`, not three times. That is about 30% of an
    unchanged reconcile.

- [x] **F12. Add benchmarks for the real hot paths.** Done except the watch flush and the plugin
  call:
  - a proxy through an aggregate backend;
  - aggregated `/apis`;
  - middleware root discovery with a real `next`;
  - an ST forward (#135827);
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

- [ ] **T1. The `dashboard.grafana.app` split.** Partly covered. Added a cluster-scoped user
  write and a no-identity OPTIONS row to `TestSingleTenantResourcesHandlerFor`, and
  `TestHiddenSingleTenantResourcesReachNeitherBackend` (a hidden group never reaches the split).
  Still without tests: a watch on `librarypanels` through the split (accounting, and the watch
  ending when the dashboard key changes), the breaker scope shown in status and metrics, and that
  a user's write to ST is visible to a later read from MT. An OPTIONS request from a user goes to ST
  today, as any non-GET from a user does.
- [x] **T2. Plugin gRPC.** `TestPluginGRPCReconnectsAfterTheServerRestarts` runs a real
  `grpc.Server` and restarts it. A keepalive test (P18) is not practical: grpc-go raises a client
  `keepalive.Time` below 10s to 10s, so it would take over 10s of real time. Retries are covered
  (`TestPluginGRPCDialOptionsCountRetries`).
- [x] **T3. Embedded groups in middleware mode (#135946).** `TestMiddlewareWatchesEmbeddedGroups`
  covers a watch on an embedded group: it streams, is canceled upstream when the client leaves, and
  ends when the service stops. In-process clients are covered by `TestLoopbackRestConfigProvider`.
  Requests before the router is `Ready` are covered
  (`TestMiddlewareLeavesRequestsToTheServerUntilReady`).

---

## C: Cleanup and docs

- [x] **C7. AGENTS.md and specs drift.** Done on `router-docs-c7-c8`. `mdCode` is now bounded like
  `mdText`. AGENTS.md's layout table also gained `cooldown.go`, `discovery_cache.go` and
  `embedded.go`. The `ProvideCloudRoutesLoaderFactory` rename moved to A4.4, since the function
  still has that name.
  - AGENTS.md (its middleware-mode text was rewritten in #135946):
    - It says `/apis` lists `discovery` and that `/openapi/v3` indexes it. Inside Grafana without the
      flag, `HandleFunc` still serves only the discovery tree, so neither is true there.
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
  - From #135946: the design notes still describe middleware mode as falling through to `next`, and
    don't mention that embedded groups bypass the breaker.
  - From #135949: `RouterStatusPage.tsx` copies `routerStatusDoc` by hand. AGENTS.md should say
    to update both together.
- [x] **C8. Small code notes.** Done on `router-docs-c7-c8`.
  - Add a one-line comment that `rejectUpgrade` doesn't handle HTTP/2 extended CONNECT.
  - Rename `aggregate_backoff.go` to `cooldown.go`, since it paces four loops.
  - ~~Add `var _ Router = (*GrafanaRouter)(nil)`.~~ Already in `router.go`.
