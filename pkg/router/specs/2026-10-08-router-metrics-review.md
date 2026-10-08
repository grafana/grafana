# Router: Metrics review follow-ups

Status: proposed
Package: `pkg/router`

Changes from a review of request coverage, async failure modes and cardinality. No label carries a
user, namespace, stack ID or slug, so nothing here is unbounded; the items close coverage gaps and
cut series cost. Keep `specs/2026-09-26-router-metrics.md` in sync with each change.

Scope is the standalone router, which gets its plugins from `plugins_url`. Local plugins, which
only the middleware mode serves, are out of scope.

## Required

- [x] **M1. Add a request counter and drop `status_code` from the duration histogram.**
  - Add `grafana_router_http_requests_total{group,verb,route,status_code}`, counting every request,
    watches included, when it finishes.
  - Drop `status_code` from `grafana_router_http_request_duration_seconds`, or reduce it to a class
    (`2xx`, `3xx`, `4xx`, `5xx`). Consider exposing it as a native histogram only.
  - Why: watches only touch `longrunning_requests`, so a watch rejected with 401 or 400
    (`rejectUpgrade`), or answered with 5xx, appears in no metric. The histogram's
    `group × verb × route × status_code` labels, times 14 classic series per label set, reach about
    100k series per replica at 100 groups. Kubernetes keeps `code` off its duration histogram for
    this reason.

- ~~**M2. Record why plugin backend calls fail.**~~ Not pursued: #134486 covers managed plugins.
  Calls that reach the plugin, unreachable ones included, are in
  `grafana_router_plugin_grpc_request_duration_seconds{status_code}`, and calls rejected by the
  breaker or a failed token exchange are in `backend_failures_total` as `breaker_open` and `auth`.
  - Out of scope: local plugins' v3 calls (`CallRoute`, `AdmissionReview`, `ConvertObjects`) have no
    metric. The router gets the plugin process's raw v3 client (`v3.NewLazyClient`), which bypasses
    Grafana's plugin client middleware.

- [x] **M3. Count backends dropped during a load.** Added the gauge
  `grafana_router_skipped_backends{source}`, rebuilt on each load like `shadowed_groups`, counting
  the skips in `combineByName` and the `plugins_url` and aggregate polls. It has no `reason` label:
  each skip is already logged with its error. Add one, from a fixed set, if alerting needs to tell
  skips apart.
  - Not counted: per-group `Backend.Load` failures in `reconcile`. They happen in the router, not a
    loader, keep the group's last-known-good backend, and already count in
    `reconcile_errors_total`.

## Recommended

- [x] **M4. Instrument managed plugin gRPC connections.** Done in #134486. `pluginClients`
  (`plugin_manifests.go`) created connections without interceptors or a stats handler, so outbound
  calls to managed plugins had no client metrics or spans.
- [ ] **M5. Export breaker transitions for the ST fallback's per-destination breakers.**
  `breakerForDestination` (`st_fallback.go`) creates breakers without an observer. Add a counter
  without a group label, since ST groups can be unregistered, and count evictions from the host
  and breaker caches.
- [ ] **M6. Measure stack lookup latency.** `newGComURLResolver` uses `http.DefaultClient`. Give it
  a client with the tracing transport, and add a histogram of lookup duration.
- [ ] **M7. Attribute discovery failures.** Discovery sub-requests (`readDiscovery`) go through the
  group's breaker but detach the request outcome, so they can trip a breaker with no matching
  `backend_failures_total` entries. Record their failures, and track fetches still running past
  their deadline (`discoveryCache`), which today can't be seen.

## Low priority

- ~~**M8.** Have `PluginLoader` implement `loaderStatus`, so `local-plugin` appears in
  `source_polls_total`.~~ Not pursued: local plugins are out of scope.
- [ ] **M9.** Count watches the router ends itself, on route change or shutdown, by reason.
- [ ] **M10.** Add duration histograms for reconciles and source polls.
- [ ] **M11.** Delete series for groups that are no longer served from the label-based metrics
  (`backend_failures_total`, `breaker_transitions_total`, `discovery_results_total`,
  `longrunning_requests`).
- [ ] **M12.** Outside `pkg/router`: check whether
  `grafana_apiserver_watch_establishment_duration_seconds{group,resource}`
  (`pkg/apiserver/endpoints/filters/watch_instrumentation.go`), which in-process plugin apiservers
  register on the router's registry, can get a new `resource` value from a watch on a resource that
  doesn't exist.
