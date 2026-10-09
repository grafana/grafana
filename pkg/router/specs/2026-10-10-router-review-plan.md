# Router: Review plan

Status: open. Replaces `2026-09-25-router-review-plan.md` (round 1) and the round-2 plan, which
existed only on the unmerged `router-review-3` branch.
Package: `pkg/router`

## Context

`pkg/router` replaces kube-aggregator and apiextensions-apiserver for Grafana. It is not yet widely
rolled out, so its behavior, config keys and package layout are still cheap to change.

This plan was rebuilt on 2026-10-10 from `main` at #134652. Since the earlier plans, the package
has changed shape:

- **The RouteBackend and AppManifest source is gone** (#134652). With it went `forwardBackend`,
  `transportFor`, the forward transport cache and the control-plane informers. The cloud loader
  merges four polled sources, lowest priority first: the ST fallback (`st_discovery_url`),
  aggregate targets (`[router.aggregate.<name>]`), core APIs (`core_url`) and managed plugins
  (`plugins_url`).
- **Aggregate targets are a configured list** (#134381). Section order sets priority. The legacy
  `[cloud_router] <name>.url` keys are still read as a rollout shim. Targets can poll discovery
  anonymously with `discovery_auth = none` (#134461).
- **The router authenticates every request** (#133656). It trusts a requester already set by
  Grafana's middleware and otherwise verifies `X-Access-Token`.
- **Plugin breakers cover only the plugin's client calls** (#133943). They no longer wrap the
  whole request.
- **Metrics and tracing were reworked** (#134486, #134524, #134532). See
  `2026-09-26-router-metrics.md` and `2026-10-08-router-metrics-review.md`.

The core engine keeps its shape:

- a group-keyed snapshot, swapped atomically;
- a level-triggered reconcile that reads full state on every wake, retried with backoff (P9);
- a passive circuit breaker per group.

**Watch must behave exactly as it does in Kubernetes**, for a stream of 30 minutes or more. That
means `?watch=1`, watch-list (`sendInitialEvents=true`) with bookmarks, and `timeoutSeconds`
enforced by the backend, not by the router. It is covered by `watch_test.go`. Out of scope (user
decisions, 2026-09-26): watch over WebSocket, which is rejected by `rejectUpgrade`, and the
deprecated `/apis/<g>/<v>/watch/...` path form.

Metrics follow-ups (M5–M7 and M9–M12 are open) are tracked separately in
`2026-10-08-router-metrics-review.md`.

Each item has a stable ID; IDs from the earlier plans are kept. Tick an item here when it lands,
and note the PR number.

## What is already done

| Items | PRs |
| --- | --- |
| P1–P11: proxy timeouts, failure labeling, outbound headers, ST lookup limits, discovery synthesis and cache, preferred version, plugin group rules, plugin authz, reconcile retry, OpenAPI pruning, per-plugin load errors | #133547, #133578, #133588, #133627, #133636, #133646 |
| W1–W4, W6, W7: watch parity (W5 dropped) | #133630 |
| A3: no redundant control-plane load | #133551; the informers themselves were removed in #134652 |
| O1, O3: route-state metrics, one logger (O2 not pursued) | #133638, #133558 |
| C1–C4: first cleanup pass | #133537 |
| P12: local plugins in the standalone router had no authenticator | #133656: the router authenticates every request |
| P13: managed plugins ignored Grafana's requester in middleware mode | #133656: `authenticate` keeps an existing requester |
| A4, partly: aggregate targets as a list, per-target TLS and `poll_interval`, `st_discovery_url` documented | #134381, #134461 |
| R3: the forward transport cache never evicted | Moot: the forward source was removed in #134652 |

## About the `router-review-3` branch

That branch implements R1, R2, R4, P14, A2, A4, A5, O4–O6 and C5. It forked from `main` on
2026-09-28 and is now far behind: #134652 rewrote `cloud_router.go`, and #134381 rewrote the
aggregate config. Treat its commits as reference implementations to port item by item, not as a
branch to merge.

---

## Suggested order

1. **Lifecycle:** R1 and R2 together, since they share the drain-then-close step. Then R4.
2. **Readiness:** O7, before any deployment that configures only aggregate targets.
3. **Small fixes:** P14, O5, O6 and C6. Each is independent and local.
4. **Config:** the rest of A4, including removing the legacy aggregate keys once the deployed
   configs use `[router.aggregate.<name>]`.
5. **Restructure:** A2 with A5, then A1.

---

## R: Resource lifecycle

- [ ] **R1. Retired plugin handlers are never destroyed.**
  - **Problem:** `pluginroute.NewHandler` builds a full API server for each plugin, and
    `Handler.Destroy` (`pkg/services/pluginsintegration/pluginroute/handler.go`) releases its
    storage. `reconcile` (`router.go`) retires an entry when its key changes or its group goes
    away, and ends its watches, but never calls `Destroy`. Any change to a managed plugin's
    `plugins_url` or `core_url` entry therefore leaks one API server.
  - **Fix:**
    - Add an optional teardown interface (an `io.Closer`-style `Destroy`) that the handler wrappers
      pass through.
    - Track in-flight requests per `handlerEntry`.
    - After `publish` and `endWatches`, destroy a retired entry once its in-flight count reaches
      zero. Put a bound on that wait, and log if the bound is hit.
  - **Test:** changing a managed plugin's key destroys the old handler once its request finishes,
    not before.
  - `router-review-3` has an implementation (`retire.go`). A request that looked up an entry just
    before it was retired gets a 503 with `Retry-After: 1`.

- [ ] **R2. gRPC connections to removed plugin hosts stay open.**
  `pluginManifestsTarget.connections` (`plugin_manifests.go`) is closed only when `run` returns.
  Have each loaded handler hold a reference to its host's connection and release it in its
  `Destroy`, so a connection closes with its last reference. This depends on R1.

- [ ] **R4. A backend that keeps failing is rebuilt about once a minute.**
  - **Problem:** a partial reconcile failure is retried at the capped backoff
    (`reconcileRetryMax`, 1 minute). Each retry calls the failing backend's `Load` again. For a
    plugin, that builds an API server and fails, every minute, indefinitely.
  - **Fix:** keep a failure count per group, keyed by backend key, and back off per group. A new
    key resets the count. A skipped group still reports its error, so readiness and logs don't
    change.

---

## P: Correctness

- [ ] **P14. The deprecated `/watch/` path still classifies as a watch.** `requestVerb` (`watch.go`)
  uses `RequestInfoFactory`, which maps `/apis/<g>/<v>/watch/...` to verb `watch`. That form is out
  of scope, so it should not get watch treatment in metrics or `serveWatch`. Reject it with a 400 on
  routed groups and the ST fallback.

---

## A: Architecture

- [ ] **A1. Split the generic engine from the Grafana Cloud–specific route sources.**
  - Keep the engine in `pkg/router`: `router.go`, `types.go`, discovery, breaker, OpenAPI cache,
    service.
  - Move each source to its own subpackage, for example
    `pkg/router/sources/{aggregate,pluginmanifests,stfallback}`.
  - R1, R2 and A5 add weight to this: every source owns resources (connections, handlers) that
    need a lifecycle the engine can drive.

- [ ] **A2. Replace `cloudLoader`'s hardcoded merge with an ordered list of sources.**
  - **Problem:** `cloudLoader.Load` (`cloud_router.go`) applies its four sources in a priority
    order written out by hand, and `sourceStatuses` and `running` repeat that list. The three poll
    loops (`aggregateTarget.run`, `pluginManifestsTarget.run`, `singleTenantFallback.run`) are now
    the same shape: one timer paced by `cooldown`, a snapshot, key-set change detection and a
    coalesced wake.
  - **Fix:** extract one `polledSource` for that loop, define a small source interface, and make
    `cloudLoader` hold an ordered `[]source`, so the override order is explicit and testable.
  - **Open decision:** `ProvideRoutesLoader` (`loader_factory.go`) still picks cloud sources *or*
    local plugins *or* dummy. Combining local plugins with cloud sources would change what the
    cloud router serves, so keep the either/or unless that is wanted.

- [ ] **A4. Finish reshaping the config before anyone depends on it.**
  - `group_regex` and `plugins_group_regex` are globs, not regexes. Rename them to
    `group_patterns` and `plugins_group_patterns`, and keep reading the old names with a warning,
    since the deployed config uses them.
  - `aggregateTokenWrapper` (`cloud_router.go`) picks the discovery auth header by comparing the
    target's name to `cloud_app_platform_apiserver`. With a configured list, that hides deployment
    knowledge in code. Replace it with a per-target key, for example `auth = bearer | access_token`,
    alongside `discovery_auth`. The defaults keep today's headers.
  - Move the hardcoded stack DNS template in `st_fallback.go`
    (`http://%s-grafana-http.hosted-grafana.svc.cluster.local.:80`) into config, for example
    `st_stack_url`.
  - Remove the legacy `[cloud_router] <target>.url` keys (`parseAggregateTargets`, marked "REMOVE
    THIS SECTION") once deployed configs use `[router.aggregate.<name>]`.
  - `ProvideCloudRoutesLoaderFactory` returns a loader, not a factory. Fold it into
    `ProvideCloudRoutesLoader`, or rename it.

- [ ] **A5. A source teardown contract.** With A2, give each source a teardown that the loader
  runs on shutdown. This replaces the `closeConnections` special case in
  `pluginManifestsTarget.run`.

---

## O: Operability

- [ ] **O5. 4xx access-log lines are logged at Warn.** `logRequest` (`logging.go`) logs every 4xx
  at Warn. That includes 401, 403 and 404, which are routine for an API and can be triggered by any
  caller, and the router now returns 401 for every unauthenticated request. Log those at Debug and
  keep Warn for other 4xx codes.

- [ ] **O6. Building two services panics.** `newService` (`service.go`) and `newRouterMetrics`
  (`metrics.go`) use `reg.MustRegister`. A test or target combination that builds both panics. Use
  `Register` and return the error, or accept `AlreadyRegisteredError`.

- [ ] **O7. The router reports ready before its first poll.** `Ready` (`router.go`) fails only
  when a reconcile errored and nothing is served. The first `cloudLoader.Load` usually runs before
  any poll finishes. An aggregate target's or `plugins_url`'s snapshot is then empty, without an
  error, so a router with no ST fallback goes ready while serving empty `/apis` discovery. (The ST
  fallback already returns `errSingleTenantDiscoveryPending`.) Give each polled source a "first
  poll done" state, and have `Load` return a pending error until every source has completed one
  poll, successful or not. This is follow-up 7 in `2026-09-11-router-aggregate-discovery-design.md`.

---

## C: Cleanup

- [ ] **C6. Stale comments after #134652 and #134381:**
  - `reconcile` (`router.go`) says "a later wake retries" in two places. P9's retry backoff is now
    what guarantees the retry.
  - `reconcile` says connection pools survive "through the loader's shared transports". There is
    no shared transport cache now: aggregate targets own one proxy transport each, and plugin hosts
    own one gRPC connection each.
  - `aggregateBackend` (`aggregate_discovery.go`) and `cloudLoader.aggregateTargets`
    (`cloud_router.go`) still describe the aggregate targets as a fixed pair.
  - `cloudLoader.Notify` has a TODO about verifying config before applying it. Either do it or drop
    the TODO.
  - Move `drainWake` and the `reconcileRetry*` constants in `router.go` below `Run`, next to their
    only caller.
