# Router: Metrics reference

Status: reference
Package: `pkg/router`

Every metric the router exports, and how to chart its state on a Grafana dashboard. Request metrics
are recorded as requests finish (`metrics.go`); route state is read from the router when Prometheus
scrapes (`routerCollector`, also in `metrics.go`).

## Label rules

- `group` is always a group the router serves. Any other value becomes `unknown`, so arbitrary
  client paths can't create series.
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
| `grafana_router_source_polls_total` | counter | `source`, `result` | Load or poll attempts: `success` or `failure` |
| `grafana_router_stack_lookups_total` | counter | `result` | Single-tenant stack lookups: `cache_hit`, `resolved`, `not_found`, `throttled`, `error` |

Sources are `routebackend`, `aggregate:<target>`, `single-tenant`, `plugins_url`, `local-plugin`
and `dummy`.

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

`verb` is the Kubernetes verb (`get`, `list`, `create`, `update`, `patch`, `delete`, ...), or the
lowercased HTTP method for discovery. `route` says how the router dispatched the request:
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
| Stale sources | `time() - grafana_router_source_last_success_timestamp_seconds` |
| Poll failure rate | `sum by (source) (rate(grafana_router_source_polls_total{result="failure"}[5m]))` |
| Open breakers | `grafana_router_breaker_state{state!="closed"} == 1` |
| Breaker flapping | `sum by (group) (increase(grafana_router_breaker_transitions_total{state="open"}[1h]))` |
| Backend failures by reason | `sum by (group, reason) (rate(grafana_router_backend_failures_total[5m]))` |
| Request rate by group | `sum by (group) (rate(grafana_router_http_request_duration_seconds_count{route="backend"}[5m]))` |
| Error ratio by group | `sum by (group) (rate(grafana_router_http_request_duration_seconds_count{route="backend",status_code=~"5.."}[5m])) / sum by (group) (rate(grafana_router_http_request_duration_seconds_count{route="backend"}[5m]))` |
| p99 latency by group | `histogram_quantile(0.99, sum by (group, le) (rate(grafana_router_http_request_duration_seconds_bucket{route="backend"}[5m])))` |
| Watches by group | `sum by (group) (grafana_router_longrunning_requests)` |
| Discovery served stale | `sum by (group) (rate(grafana_router_discovery_results_total{result=~"stale|unavailable"}[5m]))` |
| Stack lookup cache hit ratio | `rate(grafana_router_stack_lookups_total{result="cache_hit"}[5m]) / sum(rate(grafana_router_stack_lookups_total[5m]))` |
| Throttled stack lookups | `rate(grafana_router_stack_lookups_total{result="throttled"}[5m])` |
