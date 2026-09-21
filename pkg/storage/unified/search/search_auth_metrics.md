# PreRank vs PostRank auth metrics

The `index_server_search_auth_*` metrics describe executed Bleve searches, after
request validation. They do not count incoming RPCs rejected before execution.
Deployment registries may add a `grafana_` prefix, as with other index metrics.

`mode` records the path actually executed: `pre_rank`, `post_rank`, or `none`
(no authorization client). A request falling back because of a cursor created
with PreRank is counted as `pre_rank`, even when PostRank is configured.
`query_type` is `page`, `count`, `facets`, or `trash`; trash takes precedence over
facets and count. No tenant, user, resource name, or search term is a metric label.

| Suffix | Meaning |
| --- | --- |
| `duration_seconds` | Native histogram of execution time, including ranking, authorization, and response conversion. `outcome` is `success` or `error`. Histogram count measures executed searches. |
| `candidates` | Native histogram of candidate visits entering authorization per search, including partial work on failures. Facet and page passes can visit the same document twice. |
| `returned_documents` | Native histogram of rows returned by successful searches. Count-only searches observe zero rows. |
| `calls` | Native histogram of AccessClient invocations per search, labeled by `method`: `check`, `batch_check`, or `compile`. Includes zero calls and failed calls. |
| `checks` | Native histogram of items submitted through Check and BatchCheck per search, including failed calls. Compile is excluded. |
| `events_total` | Counter labeled by `reason`: `cursor_fallback`, `candidate_budget`, or `facet_budget`. Budget events mean the limit stopped a scan with unseen matches; merely filling a page or exhausting all matches is not a budget event. |

Candidate visits and checks are work counts, not unique documents. AccessClient
calls can be cached, batched, or satisfied without a network request; use
`grafana_authz_server_client_request_duration_seconds` to measure outbound RPCs.
Federated searches aggregate candidate visits and helper calls into the parent
search observation. Per-search accumulation is safe across concurrent index scans.

Example queries below use the `grafana_` prefix and should be scoped with cluster
and namespace selectors for rollout analysis.

```promql
# Executed searches per second by actual auth mode.
sum by (mode) (
  histogram_count(rate(grafana_index_server_search_auth_duration_seconds[5m]))
)

# p95 execution time at a comparable query type and outcome.
histogram_quantile(0.95,
  sum by (mode, query_type) (
    rate(grafana_index_server_search_auth_duration_seconds{outcome="success"}[5m])
  )
)

# Mean candidates visited per search, including both passes for facets.
histogram_avg(
  sum by (mode, query_type) (
    rate(grafana_index_server_search_auth_candidates[5m])
  )
)

# Mean helper calls per search, broken down by method.
histogram_avg(
  sum by (mode, query_type, method) (
    rate(grafana_index_server_search_auth_calls[5m])
  )
)
```

Compare the same query type, environment and cell. These metrics establish path
usage and observed work, not a controlled causal comparison: tenants, corpus sizes,
permissions, requested page sizes and cache state can still differ. Existing RPC
latency metrics remain the measure of service request latency; the new duration
starts after validation and index acquisition. Storage ResourceStore/List is not
instrumented by these search metrics.
