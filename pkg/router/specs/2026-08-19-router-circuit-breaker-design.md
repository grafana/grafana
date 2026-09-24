# Router passive circuit breaker — design

Status: approved (brainstorming), pending implementation plan
Package: `pkg/router`

## Problem

`GrafanaRouter` (`pkg/router/router.go`) proxies blindly: once a group's handler is installed in
`snapshot`, every request dials the backend with no liveness check. If a backend is down, every
request pays a full transport dial/response timeout before failing (502/504) — no fast-fail, no
backpressure control, and no aggregate signal beyond scattered per-request errors in logs.

Reconcile itself is also not self-healing on load failure: if `Backend.Load()` errors for a group,
`lastRV` is not advanced, so a retry only happens on the next `RoutesLoader.Notify` wake (an external,
infrequent — roughly weekly — GitOps signal), not on any timer of the router's own. This design does
not change that retry gap; it only addresses per-request fail-fast behavior for a backend that is
reachable at reconcile time but becomes unavailable while serving.

## Decision: passive-only, not active health probing

The router does not run a periodic background probe against each backend, unlike kube-aggregator's
`AvailabilityController`, which actively polls `/apis/<group>/<version>` on a timer to drive
`APIService.status.conditions[Available]`.

Why not copy that approach:

- Kube-aggregator's probe exists because `APIService.status.conditions[Available]` is a first-class,
  ops-visible object that also gates root discovery aggregation (an unavailable APIService is excluded
  from `/apis`) — a decision that must hold even for aggregated groups with near-zero real traffic, so
  it cannot rely on traffic to observe failure.
- This router already decoupled discovery from backend liveness on purpose: `publish()` synthesizes
  `/apis`/`/openapi/v3` from `r.served` (config/install state), not backend health — a group whose
  reload failed still advertises via last-known-good. The reason kube-aggregator needs a traffic-free
  signal does not apply here.
- Active probing would require a new health-endpoint convention on `Backend` (none exists today —
  `Load` only returns a proxy handler) and a per-group background goroutine with its own start/stop
  lifecycle tied to group add/remove, which cuts against the "reconcile only touches the changed
  group" invariant documented in `AGENTS.md`.
- This router's scope is CRUD+List traffic expected to be reasonably continuous, not a near-zero-
  traffic discovery heartbeat — passive signal from real requests is expected to trip fast enough.

Revisit active probing only if a specific group's real traffic proves too sparse for passive signal to
trip in a useful time window.

This decision, and the library choice below, are recorded permanently in `pkg/router/AGENTS.md` under
"Passive circuit breaking".

## Library: `sony/gobreaker`

Not hand-rolled. `sony/gobreaker/v2` implements the closed/open/half-open state machine from Nygard's
*Release It!* with generics (`Execute[T any]`). Chosen over alternatives:

- `afex/hystrix-go` — Netflix Hystrix port; Hystrix itself is deprecated upstream, the Go port is
  stale, and it's heavier (concurrency pools, metrics stream) than needed.
- `slok/goresilience` — general resilience toolkit (retry+breaker+timeout+bulkhead middleware chain);
  more surface than one breaker needs.
- `eapache/go-resiliency` — older, less maintained, no advantage over gobreaker.
- Hand-rolled — rejected; failure-counting/cooldown/half-open timing is easy to get subtly wrong
  (flapping, thundering-herd on recovery) and gobreaker already gets it right.

## Granularity: per-group

One breaker per served group — matches the existing failure-domain unit exactly (one backend owns all
versions of a group already; `handlerEntry`/`r.served[group]` is keyed by group).

Rejected alternatives:

- **Global** (one breaker for the whole router) — one dead backend would fail-fast every group;
  violates the existing "unrelated groups never touched by one group's change" invariant (same
  principle already applied to per-`tlsCacheKey` transport pooling).
- **Per-transport (`tlsCacheKey`)** — transports are shared across groups by TLS settings only, not by
  target host; two groups can share a transport while pointing at independently-healthy hosts. Wrong
  failure domain, would cross-contaminate unrelated groups.
- **Per-version/per-verb within a group** — premature; `Backend.Load()` returns one handler for the
  whole group today, no existing seam splits finer than group. No stated need (would only matter if,
  e.g., writes degraded independently of reads on the same backend — no evidence of that here, and
  Operator/Plugin modes are still TBD).

## Lifecycle

`handlerEntry` gains a `breaker *gobreaker.CircuitBreaker[struct{}]` field; `servingEntry` gains the
same, copied by `publish()` — identical pattern to `handler`/`lastRV` today. `reconcile` owns writes
(single goroutine, no lock needed); `gobreaker.CircuitBreaker` is internally mutex-safe for concurrent
`Execute` calls from serving goroutines.

Piggybacks entirely on existing reconcile rules — no new goroutine, no new teardown path:

- **New group**: fresh breaker, defaults, starts closed.
- **Unchanged RV** (existing skip branch): untouched — breaker state carries forward exactly like the
  connection pool does.
- **Changed RV** (rebuild branch): **new breaker instance, reset to closed.** An RV change can mean the
  target URL itself moved (new `RouteBackendSpec.Forward.Url`); carrying over trip state from the old
  target would be stale. Same "reload = fresh trust" logic as the handler rebuild itself.
- **Group removed**: breaker goes away with the rest of the entry; gobreaker holds no resources to
  release (unlike the transport pool).

## Configuration: hardcoded defaults

Use `gobreaker.Settings{}` zero-value — the library's own defaults (trip after 5 consecutive failures,
60s open cooldown before half-open, 1 half-open trial request) — rather than inventing thresholds or
adding a new CRD field. No change to `RouteBackendSpec`, no enterprise loader change. Revisit only if a
real group needs different tuning than the defaults provide.

## Failure signal

Counts as a breaker failure:

- Transport-level errors: dial failure, timeout, connection reset/refused.
- Responses with status `502`, `503`, or `504`.

Does **not** count: plain `500` and other 4xx/5xx. A `500` is typically an application-level bug or
validation error, not evidence the backend is unreachable — tripping the breaker on it would fail-fast
unrelated future requests for no good reason.

## Serving-path integration

Two call sites proxy to `entry.handler` and both route through the same per-group breaker:

1. `HandleFunc`'s main dispatch (`entry.handler.ServeHTTP(w, req)` for `/apis/<group>/...`).
2. `serveOpenAPIGroupVersion`'s cache-miss proxy path. The cache-hit path (served straight from the
   `openapiDocs` sync.Map, no backend call) stays outside the breaker entirely — it never touches the
   backend, so there's nothing to protect.

Mechanism: wrap the real `http.ResponseWriter` in a **thin passthrough recorder** — not the buffering
`captureWriter` already used for the openapi doc cache (that one buffers the whole body, appropriate
for small cached docs but wrong for CRUD+List responses that can be large — buffering would defeat
streaming and add latency). The passthrough recorder intercepts only `WriteHeader` to remember the
status code; `Write`/`Header`/`Flush` forward straight to the real `ResponseWriter`.

```go
result, err := entry.breaker.Execute(func() (struct{}, error) {
    rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
    entry.handler.ServeHTTP(rec, req)
    if rec.status == 502 || rec.status == 503 || rec.status == 504 {
        return struct{}{}, fmt.Errorf("router: backend returned status %d", rec.status)
    }
    return struct{}{}, nil
})
if errors.Is(err, gobreaker.ErrOpenState) || errors.Is(err, gobreaker.ErrTooManyRequests) {
    http.Error(w, "backend unavailable", http.StatusServiceUnavailable)
}
```

When the breaker is closed or half-open, `Execute` always calls the func, so the response is already
streamed to the real `ResponseWriter` by the time `Execute` returns, whether the func reported success
or failure. Nothing extra to write in that case. Only when **open** does `Execute` skip the func
entirely (no dial attempted) — that's the one branch where the router writes the fail-fast 503 itself,
via `http.StatusServiceUnavailable`.

`rejectBackendRedirects` (existing `ModifyResponse` hook) already turns backend redirects into a 502 via
the default `ErrorHandler`; that flows into the recorder's `WriteHeader(502)` the same as any other
transport-level failure, so it's automatically counted as a breaker failure with no extra wiring.

`ErrTooManyRequests` vs `ErrOpenState`: half-open allows only `MaxRequests` (default 1) trial requests
through to test recovery. Extra concurrent requests arriving while that trial is in flight get
`ErrTooManyRequests` instead of a second dial — same meaning as open ("don't pile more load onto a
backend that hasn't proven it's back yet"), so both errors get identical treatment (local 503).

## Observability

No dedicated metric in this first pass. Breaker state changes surface only as the 503s/502s already
visible in existing proxy error paths. `gobreaker.Settings.OnStateChange` is the seam to add a
Prometheus gauge later (e.g. `grafana_router_backend_circuit_state{group=...}`) if this gap is felt in
practice — noted here so it isn't rediscovered as new work.

## Testing plan

- Fresh group starts closed; N successes pass through untouched, `entry.handler.ServeHTTP` invoked
  each time.
- 5 consecutive transport-error/502/503/504 outcomes trip the breaker open; subsequent request gets a
  local 503, spy handler asserts `ServeHTTP` is **never called** (no dial attempted).
- Plain `500` responses do **not** count — breaker stays closed after repeated 500s.
- After `Timeout` elapses (inject a short `Timeout` via test-only settings, not gobreaker's real 60s),
  one trial request goes through; success closes the breaker, failure re-opens it.
- Two concurrent requests during the half-open trial window: one gets dialed, the other gets
  `ErrTooManyRequests` → 503, no second dial (assert under `-race`).
- Reconcile: RV-unchanged rebuild preserves an open breaker's state across a reconcile that touches
  other groups. RV-changed rebuild resets to closed even if the previous instance was open.
- `serveOpenAPIGroupVersion`: cache-hit path never touches the breaker (assert internal counts
  unchanged); cache-miss path routes through it identically to the main dispatch.

## Amendments (post-review)

Two issues surfaced by automated PR review (bugbot) against the initial implementation, both fixed:

- **Wrapper writers must forward `Flush`.** `statusRecorder` (and the pre-existing `captureWriter`)
  wrap `http.ResponseWriter` without exposing `Flush`. `httputil.ReverseProxy` flushes any response
  with no `Content-Length` (`res.ContentLength == -1` — chunked responses, SSE, and much ordinary k8s
  JSON) via `http.ResponseController(dst).Flush()` on every write. Without a route to the real
  `Flusher`, that flush silently no-ops (Go's `ReverseProxy` swallows the error rather than panicking,
  contrary to the review's initial "will panic" framing — but the practical effect is still real:
  buffered/delayed delivery for streamed responses instead of prompt flushing). Fix: `statusRecorder`
  implements `Unwrap() http.ResponseWriter` (the documented `net/http` pattern for wrapping
  `ResponseWriter` without hiding optional interfaces), so `ResponseController` reaches the real
  writer. `captureWriter` has no real writer yet to unwrap to (it owns its own buffer until `ServeHTTP`
  returns), so it gets a no-op `Flush` instead — cheap, and enough to stop `ResponseController` from
  treating it as unsupported.
- **Canceled requests must not count as breaker failures.** A client disconnect surfaces through
  `ReverseProxy` as its default 502 (same status as a real transport failure), so `isBackendFailure`
  was counting client-side cancellations as backend unavailability — a handful of abandoned requests
  could trip the breaker and fail-fast every other caller for the cooldown window, independent of
  actual backend health. Fix: `newGroupBreaker`'s `Settings.IsExcluded` (a gobreaker hook built exactly
  for this — "ignore context cancellations or other errors that should not affect the circuit breaker
  state") checks for `context.Canceled`/`context.DeadlineExceeded`. `breakerOutcome` (shared by both
  call sites) checks the request context ahead of the response status, so a cancellation is excluded
  regardless of what status got written.

## Out of scope

- Active health probing (see Decision above).
- Per-group configurable tuning via CRD (see Configuration above).
- Metrics/observability beyond the `OnStateChange` seam (see Observability above).
- The separate reconcile-retry gap for `Backend.Load()` failures on unchanged RV (see Problem above) —
  a real gap, but distinct from per-request fail-fast and not addressed by this design.
