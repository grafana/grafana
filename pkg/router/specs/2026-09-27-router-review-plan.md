# Router: Review plan, round 2

Status: in progress on branch `router-review-3` (local). Done: R1–R4, P12, P14, A2, A4, A5, O4–O6, C5. Open: P13, A1.
Package: `pkg/router`
Supersedes the open items of `2026-09-25-router-review-plan.md`, whose IDs are kept.

## Context

This plan comes from a second full read of the package, on 2026-09-27. The branch read was `main` plus
#133636 (hung discovery backends) and #133646 (P6, P9 and P10), with both assumed merged.
`go test -race ./pkg/router/` passes on that combination.

The 2026-09-25 plan is mostly done:

| Items             | State       | PRs                                                  |
| ----------------- | ----------- | ---------------------------------------------------- |
| P1–P11            | done        | #133547, #133578, #133588, #133627, #133636, #133646 |
| W1–W4, W6, W7     | done        | #133630 (W5 dropped: deprecated watch path)          |
| A3                | done        | #133551                                              |
| O1, O3            | done        | #133638, #133558 (O2 not pursued)                    |
| C1–C4             | done        | #133537                                              |
| A1, A2, A4        | **open**    | carried forward below                                |

A security audit ran alongside this review. Its findings are kept in a separate local document that is
not committed, and they are not listed here.

---

## R: Resource lifecycle

- [x] **R1. Retired plugin handlers are never destroyed.**
  - **Problem:** `pluginroute.NewHandler` builds a full API server for each plugin, and
    `Handler.Destroy` releases its storage. `reconcile` (`router.go`) replaces or drops handler
    entries but never calls `Destroy`. It is also hidden behind two wrappers: `tracedPluginHandler`
    embeds `*pluginroute.Handler`, but `authenticatingWrapper` embeds `http.Handler`, which drops the
    method. Every key change for a managed plugin (any change to its `plugins_url` entry) leaks one
    API server.
  - **Fix:**
    - Add an optional `io.Closer`-style teardown that the wrappers pass through.
    - Track in-flight requests per `handlerEntry`.
    - After `publish` and `endWatches`, destroy a retired entry once its in-flight count reaches
      zero. Put a bound on that wait, and log if the bound is hit.
  - **Test:** changing a managed plugin's key destroys the old handler once its request finishes,
    not before.
  - **Done:** `retire.go`. A request that looked up an entry just before it was retired gets a 503
    with `Retry-After: 1` rather than running on a handler about to be destroyed. Only handlers
    with a `Destroy` are tracked.

- [x] **R2. gRPC connections to removed plugin hosts stay open.** `pluginManifestsTarget.connections`
  (`plugin_manifests.go`) is only closed at shutdown. After each poll, close connections whose host
  is not in the new snapshot. Retired handlers may still hold one, so close it only after R1's drain.
  - **Done:** each loaded handler holds a reference to its host's connection, released by its
    `Destroy`. The connection closes with its last reference.

- [x] **R3. The forward transport cache never evicts.** `transportFor` (`cloud_router.go`) keys
  transports by the RouteBackend's raw `caData` and keeps them forever. After each `Load`, drop the
  transports no current backend uses, and call `CloseIdleConnections` on them.

- [x] **R4. A backend that keeps failing is rebuilt about once a minute.** P9 retries a partial
  failure at the capped backoff, and each retry calls that backend's `Load` again. For a plugin,
  that builds an API server and fails, every minute, indefinitely. Keep a failure count per group,
  keyed by backend key, and back off per group, so one bad backend doesn't keep the whole loop on its
  1-minute retry. A new key resets the count.
  - **Done:** per-group backoff from 1s, doubling to 10 minutes. A skipped group still reports its
    error, so readiness and logs are unchanged.

---

## P: Correctness

- [x] **P12. The local plugin loader has no authenticator in standalone mode.** In standalone
  mode, requests to local plugin groups carry no requester, so every request is refused. Either
  give `PluginLoader` backends the same `authenticatingWrapper` as managed plugins, or refuse to
  pick the local plugin loader for the standalone target.
  - **Done:** in the standalone target, local plugins authenticate `X-Access-Token` like managed
    plugins, and startup fails if `[auth.extended_jwt]` token verification isn't configured.

- [ ] **P13. Managed plugins ignore the requester in middleware mode.** `authenticatingWrapper`
  always reads `X-Access-Token`, even when Grafana has already authenticated the request. Cookie
  users get a 401, and the requester in context is replaced. When a requester is present, use it.
  - **Deferred:** it changes who can reach managed plugins, so it waits on the managed plugin
    authorization work tracked separately.

- [x] **P14. The deprecated `/watch/` path still classifies as a watch.** `requestVerb` uses
  `RequestInfoFactory`, which maps `/apis/<g>/<v>/watch/...` to verb `watch`. That form is out of
  scope (W5), so it should not get watch treatment in metrics or `serveWatch`. Reject it with a
  400, or classify it as `get`.
  - **Done:** rejected with a 400 on routed groups and the ST fallback.

---

## A: Architecture (carried forward)

- [ ] **A1. Split the generic engine from the Grafana Cloud–specific route sources.** Unchanged from
  the 2026-09-25 plan. R1–R3 add weight to this: every source owns resources (connections,
  transports, handlers) that need a lifecycle the engine can drive.
- [x] **A2. Replace `cloudLoader` with an ordered list of route sources.** Unchanged. The three poll
  loops (`aggregateTarget.run`, `pluginManifestsTarget.run`, `singleTenantFallback.run`) are now the
  same shape, so a shared `polledSource` is straightforward.
  - **Done:** `polled_source.go`, `route_backend_source.go`, and `cloudLoader.sources` for the
    order. One behavior change: a failed poll of an aggregate target or `plugins_url` now fails the
    load when no source has backends, as the ST fallback already did. The either/or in
    `ProvideRoutesLoader` is kept: combining local plugins with the cloud sources would change what
    the cloud router serves, so it is left as a decision.
- [x] **A4. Reshape the `[cloud_router]` config before anyone depends on it.** Unchanged. Also move
  the hardcoded ST DNS template (`st_fallback.go`) into config, which was part of A1.
  - **Done:** `*.group_patterns` and `plugins_group_patterns` (the `*_regex` names are still read,
    with a warning, since the deployed config uses them), `<target>.auth` with defaults that keep
    today's headers, `st_stack_url`, and `ProvideCloudRoutesLoader`. The fixed pair of aggregate
    targets is kept; making it a list is still a decision.
- [x] **A5. A `Source` teardown contract.** With A2, give each source a `Close` (or make it a dskit
  service) that the loader calls on shutdown. This replaces the `closeConnections` special case in
  `pluginManifestsTarget.run`.
  - **Done:** `routeSource.run` releases the source's resources before it returns.

---

## O: Operability

- [x] **O4. Reconcile warnings repeat on every reconcile.** "group not allowed in this mode" and
  "duplicate group in route set" (`router.go`) are logged each time `reconcile` runs, which is at
  least every poll interval. Log them only when the set changes, as `recordShadowed` already does.
  Consider a gauge for groups the mode skipped.
- [x] **O5. 4xx access-log lines at Warn.** `logRequest` logs every 4xx at Warn. That includes 401,
  403 and 404, which are routine for an API and can be triggered by any caller. Log those at Debug
  (or Info) and keep Warn for other 4xx codes.
- [x] **O6. `ProvideService` panics if called twice.** `newService` uses `reg.MustRegister`. Wire
  and the module server each build one, and a test or target combination that builds both panics.
  Use `Register` and return the error, or accept `AlreadyRegisteredError`.

---

## C: Cleanup

- [x] **C5. Small fixes:**
  - Move `drainWake` and the `reconcileRetry*` constants below `Run` in `router.go`, next to
    their only caller.
  - Rewrap the `owns` doc comment.
  - `rejectUpgrade` only checks `Connection: Upgrade`. HTTP/2 extended CONNECT (`:protocol`) is not
    enabled on the listeners today. Note that in the comment, so enabling it later is a deliberate
    change.

---

## Suggested PR order

1. **Security fixes:** see the local security audit. These come first, and are handled outside this
   plan.
2. **PR R:** R1–R3 together, since they share the drain-then-close step. Then R4.
3. **PR P:** P12–P14.
4. **PR O:** O4–O6 and C5.
5. **Restructure:** A1, A2, A4, A5.
