# Router: Metrics reference

Status: reference
Package: `pkg/router`

Every metric the router exports, and how to chart its state on a Grafana dashboard. Request metrics
are recorded as requests finish (`metrics.go`); route state is read from the router when Prometheus
scrapes (`routerCollector`, also in `metrics.go`).

## Label rules

Every label has a bounded set of values, so no request can create new series:

- `group` is always a group the router serves. Any other value becomes `unknown`, so arbitrary
  client paths can't create series.
- `verb` is one of a fixed set (`metricVerbs` in `metrics.go`); anything else becomes `other`. See
  [Requests](#requests).
- `route`, `reason`, `state` and `result` take only the values listed in their tables.
- `status_code` is the response's HTTP status code, so it is limited to the three-digit codes.
- In middleware mode, requests for groups the router doesn't serve belong to the embedded API
  server, and are not counted here. The API server's own `apiserver_request_*` metrics cover them.
- Watches are long-running requests. They are counted in `grafana_router_longrunning_requests`,
  never in the duration histogram or the in-flight gauge.

## Health

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `grafana_router_ready` | gauge | | 1 when the router can serve traffic, 0 when not |
| `grafana_router_last_reconcile_timestamp_seconds` | gauge | | When the latest route reconcile finished |
| `grafana_router_reconciles_total` | counter | | Completed reconciles |
| `grafana_router_reconcile_errors_total` | counter | | Reconciles that completed with errors |

## Routes and sources

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `grafana_router_groups` | gauge | `source` | API groups served, per route source |
| `grafana_router_shadowed_groups` | gauge | `source` | Groups a source offered that a higher-priority source serves instead |
| `grafana_router_source_last_success_timestamp_seconds` | gauge | `source` | When each source last loaded successfully |
| `grafana_router_source_polls_total` | counter | `source`, `result` | Load or poll attempts: `success` or `failure` (for `routebackend`, direct lists, informer events and informer errors) |
| `grafana_router_stack_lookups_total` | counter | `result` | Single-tenant stack lookups: `cache_hit`, `resolved`, `not_found`, `throttled`, `error` |

Sources are `routebackend`, `aggregate:<target>`, `single-tenant`, `plugins_url`, `local-plugin`
and `dummy`.

The polled sources (`aggregate:<target>`, `single-tenant`, `plugins_url`) record every poll, so a
stale last success means the source is failing. `routebackend` is watched by informers instead: it
records a success when it lists directly (before the informers sync) or an informer receives an
event, and a failure on each informer list or watch error. Its last success doesn't move while
nothing changes, so watch its failures rather than its staleness.

## Backends

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `grafana_router_breaker_state` | gauge | `group`, `state` | 1 for the group's current breaker state (`closed`, `half-open`, `open`), 0 for the others |
| `grafana_router_breaker_transitions_total` | counter | `group`, `state` | Breaker state changes, by the state entered |
| `grafana_router_backend_failures_total` | counter | `group`, `reason` | Requests whose backend failed: `breaker_open`, `timeout`, `transport`, `redirect_rejected`, `stack_origin_mismatch` |
| `grafana_router_discovery_results_total` | counter | `group`, `result` | How aggregated discovery was obtained: `provided`, `cached`, `fetched`, `stale`, `unavailable` |

Groups on the single-tenant fallback keep one breaker per stack, so they have no
`grafana_router_breaker_state` series.

## Requests

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `grafana_router_http_request_duration_seconds` | histogram (classic and native) | `group`, `verb`, `route`, `status_code` | Latency of requests other than watches |
| `grafana_router_http_requests_in_flight` | gauge | | Requests other than watches in progress |
| `grafana_router_longrunning_requests` | gauge | `group` | Watches in progress |

`verb` is one of:

- a Kubernetes verb, for resource requests: `get`, `list`, `watch`, `create`, `update`, `patch`,
  `delete`, `deletecollection` or `proxy`;
- the lowercased HTTP method, for paths outside the resource API such as `/apis`, `/apis/<group>`
  and `/openapi/v3`: `get`, `head`, `options`, `post`, `put`, `patch`, `delete`, `connect` or
  `trace`;
- `other`, for any other method. Go's server accepts any token as a method, so an unrecognized one
  must not become a label value.

`watch` never appears in the histogram, since watches are counted only in
`grafana_router_longrunning_requests`.

`route` says how the router dispatched the request:
`backend` (the group's backend), `fallback` (the single-tenant fallback), `discovery` (root
discovery the router builds), `next` (not the router's; passed on) or `invalid` (rejected before
routing).

## Dashboard queries

| Panel | Query |
| --- | --- |
| Ready | `min(grafana_router_ready)` |
| Time since last reconcile | `time() - max(grafana_router_last_reconcile_timestamp_seconds)` |
| Reconcile error ratio | `rate(grafana_router_reconcile_errors_total[5m]) / rate(grafana_router_reconciles_total[5m])` |
| Groups by source | `sum by (source) (grafana_router_groups)` |
| Shadowed groups | `sum by (source) (grafana_router_shadowed_groups)` |
| Stale polled sources | `time() - grafana_router_source_last_success_timestamp_seconds{source!="routebackend"}` |
| Poll and watch failure rate | `sum by (source) (rate(grafana_router_source_polls_total{result="failure"}[5m]))` |
| Open breakers | `grafana_router_breaker_state{state!="closed"} == 1` |
| Breaker flapping | `sum by (group) (increase(grafana_router_breaker_transitions_total{state="open"}[1h]))` |
| Backend failures by reason | `sum by (group, reason) (rate(grafana_router_backend_failures_total[5m]))` |
| Request rate by group | `sum by (group) (rate(grafana_router_http_request_duration_seconds_count{route="backend"}[5m]))` |
| Error ratio by group | `sum by (group) (rate(grafana_router_http_request_duration_seconds_count{route="backend",status_code=~"5.."}[5m])) / sum by (group) (rate(grafana_router_http_request_duration_seconds_count{route="backend"}[5m]))` |
| p99 latency by group | `histogram_quantile(0.99, sum by (group, le) (rate(grafana_router_http_request_duration_seconds_bucket{route="backend"}[5m])))` |
| Watches by group | `sum by (group) (grafana_router_longrunning_requests)` |
| Unrecognized methods | `sum by (group) (rate(grafana_router_http_request_duration_seconds_count{verb="other"}[5m]))` |
| Discovery served stale | `sum by (group) (rate(grafana_router_discovery_results_total{result=~"stale|unavailable"}[5m]))` |
| Stack lookup cache hit ratio | `rate(grafana_router_stack_lookups_total{result="cache_hit"}[5m]) / sum(rate(grafana_router_stack_lookups_total[5m]))` |
| Throttled stack lookups | `rate(grafana_router_stack_lookups_total{result="throttled"}[5m])` |
