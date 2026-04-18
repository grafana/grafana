---
description: Troubleshoot common problems with the Tempo data source in Grafana
keywords:
  - grafana
  - tempo
  - tracing
  - troubleshooting
  - errors
  - TraceQL
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Tempo data source issues
weight: 600
---

# Troubleshoot Tempo data source issues

This document provides solutions to common issues you may encounter when configuring or using the Tempo data source in Grafana.

## Scope of this guide

This guide covers issues related to connecting Grafana to Tempo and using the data source features. It applies to the following setups:

- **Self-managed Grafana + self-managed Tempo**—you manage both Grafana (OSS or Enterprise) and Tempo.
- **Grafana Cloud + Cloud Traces**—you use Grafana Cloud with the managed Tempo backend (Grafana Cloud Traces). Some configuration (streaming, metrics generator) is handled automatically.
- **Grafana Cloud + self-managed Tempo via PDC**—you use Grafana Cloud but connect to your own Tempo instance through [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

Where troubleshooting steps differ between these setups, the guide calls it out. Sections labeled _Grafana Cloud only_ or _self-managed Tempo_ apply only to those environments.

### Resources for troubleshooting Tempo

For issues with Tempo itself (not the data source), refer to the Tempo product documentation:

- [Troubleshoot Tempo](https://grafana.com/docs/tempo/<TEMPO_VERSION>/troubleshooting/) - General Tempo troubleshooting, including ingestion failures and server-side errors.
- [Unable to find traces](https://grafana.com/docs/tempo/<TEMPO_VERSION>/troubleshooting/querying/unable-to-see-trace/) - Traces missing due to ingestion, sampling, or retention issues.
- [Too many requests error](https://grafana.com/docs/tempo/<TEMPO_VERSION>/troubleshooting/querying/too-many-requests-error/) - Query capacity limits and 429 errors.
- [Query issues](https://grafana.com/docs/tempo/<TEMPO_VERSION>/troubleshooting/querying/) - Server-side query failures, bad blocks, and performance tuning.

### Resources for troubleshooting tracings in Grafana Cloud

Additional resources for Grafana Cloud:

- [Troubleshoot Grafana Cloud Traces](https://grafana.com/docs/grafana-cloud/send-data/traces/troubleshoot/), which covers quick checks, ingestion issues, TraceQL and search, service graph, exemplars, and rate limiting and retry.
- [Investigate traces with Grafana Assistant](https://grafana.com/docs/grafana-cloud/send-data/traces/investigate-traces-with-assistant/) - Use Grafana Assistant to help troubleshoot any issues.
- [Troubleshoot traces collection with Alloy](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/traces-with-alloy/#troubleshoot)
- [Troubleshoot errors with metrics-generator in Cloud Traces](https://grafana.com/docs/grafana-cloud/send-data/traces/configure/metrics-generator/#troubleshoot-errors)

## Connection errors

These errors occur when Grafana cannot establish or maintain a connection to the Tempo instance.

### Failed to connect to Tempo

**Error message:** `Failed to connect to Tempo` or `dial tcp: connection refused`

**Cause:** Grafana can't reach the Tempo instance. This typically means the Tempo process isn't running, the URL in the data source settings is wrong, or a network-level rule is blocking the connection.

**Solution:**

1. Verify that the Tempo instance is running and accessible from the Grafana server.
1. Check that the URL is correct in the [data source configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/). The default Tempo HTTP port is `3200`. Common URL mistakes include:
   - Adding trailing path segments, for example, `/api` or `/tempo`, to self-managed Tempo URLs. The correct format is `http://<HOST>:3200` with no path. The `/tempo` suffix is only used for Grafana Cloud Traces URLs.
   - Using the gRPC port (`9095`) instead of the HTTP port (`3200`). The Tempo data source URL must be the HTTP endpoint. Grafana derives the gRPC connection for streaming from the same URL.
   - Refer to the [Connection](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/) section for URL format examples by environment.
1. Ensure there are no firewall rules blocking the connection between Grafana and Tempo.
1. For Grafana Cloud users connecting to a self-managed Tempo instance, ensure you have configured [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if Tempo isn't publicly accessible.
1. Verify the protocol (HTTP or HTTPS) matches your Tempo configuration.

### Connection timeout

**Error message:** `Connection timed out` or `context deadline exceeded`

**Cause:** The connection to Tempo timed out before receiving a response. This can happen when network latency is high, Tempo is overloaded, or an intermediary device (load balancer, proxy) terminates the connection before Tempo responds.

**Solution:**

1. Check the network latency between Grafana and Tempo.
1. Verify that Tempo isn't overloaded or experiencing performance issues. If you have [Tempo mixin dashboards](https://grafana.com/docs/tempo/<TEMPO_VERSION>/operations/monitor/) installed, check them for resource saturation or elevated error rates.
1. Increase the **Timeout** setting in the [data source configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/additional-settings/) under **Additional settings**.
1. Check if any network devices (load balancers, proxies) are timing out the connection.
1. For large trace queries, consider reducing the time range or adding more specific filters.

### TLS/SSL connection failures

**Error message:** `TLS handshake failed` or `x509: certificate signed by unknown authority`

**Cause:** There's a mismatch between the TLS settings in Grafana and what the Tempo instance supports or requires. For example, Tempo may present a self-signed certificate that the Grafana server doesn't trust, or the certificate's hostname doesn't match the URL.

**Solution:**

1. Verify that Tempo has a [valid TLS certificate if HTTPS is enabled](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#authentication).
1. Check that the certificate is trusted by the Grafana server.
1. If using a self-signed certificate, configure the **TLS/SSL Auth Details** in the [data source settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#authentication).
1. Ensure the certificate's Common Name (CN) or Subject Alternative Name (SAN) matches the hostname used in the URL.

For additional information on setting up TLS encryption with Tempo, refer to [Configure TLS communication](https://grafana.com/docs/tempo/<TEMPO_VERSION>/configuration/network/tls/).

## Authentication errors

These errors occur when there are issues with authentication credentials or permissions.

### Authentication failed

**Error message:** `401 Unauthorized` or `403 Forbidden`

**Cause:** The authentication credentials are invalid or the user doesn't have permission to access Tempo. This error appears when you select **Save & test** or when running a query.

**Solution:**

1. Verify that the authentication credentials (username/password or API key) are correct in the [data source settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#authentication).
1. Check that the user or service account has the required permissions.
1. Ensure the authentication method selected in the data source matches what Tempo expects.
1. For Grafana Cloud, verify that your Cloud Access Policy token has the `traces:read` scope. Refer to [Create a Cloud Access Policy token](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/add-access-policy/) for setup instructions. To find your stack URL and credentials, refer to [Locate your stack URL, user, and password](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/locate-url-user-password/).
1. For self-managed Tempo, ensure the credentials match those configured in the Tempo `server` block or reverse proxy.

### Save and test returns 404

**Error message:** `Tempo echo endpoint returned status 404` when selecting **Save & test**

**Cause:** The Grafana health check reaches the server but the `api/echo` endpoint returns a 404. The most common cause is incorrect path segments in the URL (such as `/api` or `/tempo` on a self-managed instance) that shift the health check request to a nonexistent path. A 404 can also occur when a reverse proxy in front of Tempo rejects requests that include unexpected basic authentication headers.

**Solution:**

1. Verify that the URL doesn't include trailing path segments. For self-managed Tempo, the URL should be `http://<HOST>:3200` with no path. Refer to the [Connection](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/) section for the correct format.
1. If a reverse proxy sits between Grafana and Tempo, check whether the proxy is returning the 404. Tempo itself ignores unexpected auth headers, but a proxy may reject them.
1. If Tempo doesn't require authentication, select **No authentication** in the [data source settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#authentication).
1. Check that the authentication credentials are entered in the correct fields. For Grafana Cloud, the **User** field is the instance ID (not your Grafana login), and the **Password** is a Cloud Access Policy token.

### Multi-tenant authentication issues

**Error message:** `Unauthorized` when using multi-tenant Tempo

**Cause:** The tenant ID (`X-Scope-OrgID` header) is missing or incorrect. This header must be set on both the write path (in your Alloy or OpenTelemetry Collector configuration) and the read path (in the Grafana data source settings) to route data to the correct tenant.

**Solution:**

1. In the Tempo data source settings, verify that the `X-Scope-OrgID` header is configured under **Authentication > HTTP Headers**. Refer to [Multi-tenancy](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/) for data source configuration steps.
1. On the write path, verify that the same `X-Scope-OrgID` header is set in your Alloy or OpenTelemetry Collector configuration so traces are ingested under the correct tenant.
1. Check that the authenticated user has access to the specified tenant.
1. For cross-tenant queries, ensure all specified tenants are accessible.

For more information, refer to [Enable multi-tenancy](https://grafana.com/docs/tempo/<TEMPO_VERSION>/operations/multitenancy/) and [Tenant IDs](https://grafana.com/docs/tempo/<TEMPO_VERSION>/configuration/tenant-ids/).

## Query errors

These errors occur when there are issues with TraceQL queries or trace lookups.

### Trace not found

**Error message:** `Trace not found` or `trace ID not found`

**Cause:** The specified trace ID doesn't exist in Tempo or has aged out of the configured retention period. Common reasons include:

- **Sampling:** Head or tail sampling in your instrumentation pipeline (Alloy, OpenTelemetry Collector) may have dropped the trace before it reached Tempo. This is the most common cause of missing traces.
- **Retention:** Traces are only available for the duration set in the Tempo retention configuration. For Grafana Cloud users, default retention periods apply unless you contact Support to change them.
- **Ingestion failure:** The trace may not have been successfully ingested due to rate limits, errors, or misconfigured pipelines.

**Solution:**

1. Verify the trace ID is correct and complete.
1. Check your sampling configuration in Alloy or OpenTelemetry Collector. If head or tail sampling is enabled, the trace may have been intentionally dropped. Refer to [Sampling strategies](https://grafana.com/docs/tempo/<TEMPO_VERSION>/set-up-for-tracing/instrument-send/set-up-collector/tail-sampling/) for guidance.
1. Check that the trace is within the configured retention period for Tempo.
1. If using time range restrictions, expand the time range in the [**TraceID query** settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/additional-settings/#traceid-query).
1. Enable **Use time range in query** in the [TraceID query settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/additional-settings/#traceid-query) and adjust the time shift values to search a broader range.
1. Verify the trace was successfully ingested by Tempo. You can run a broad query to check for recent traces:

   ```traceql
   { } | count() > 0
   ```

   If this returns results, traces are being ingested but your specific trace ID may have been dropped by sampling or aged out. For more query examples, refer to the [TraceQL cookbook](https://grafana.com/docs/grafana-cloud/send-data/traces/traces-query-editor/traceql-cookbook/).

1. For Grafana Cloud users, refer to [Troubleshoot TraceQL and search](https://grafana.com/docs/grafana-cloud/send-data/traces/troubleshoot/#traceql-and-search) for TraceQL queries that can help investigate missing traces.

### TraceQL syntax errors

**Error message:** `parse error` or `unexpected token`

**Cause:** The TraceQL query contains syntax errors.

**Solution:**

1. Verify the query follows [TraceQL syntax](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/).
1. Check that all braces, parentheses, and quotes are balanced.
1. Ensure attribute names are correctly formatted with the correct scope. Use dot notation for span or resource attributes, for example, `span.http.status_code` or `resource.service.name`.
1. Use the **Search** query builder to generate valid TraceQL queries if you're unfamiliar with the syntax.
1. Verify operators are used correctly. Supported operators include `=`, `!=`, `=~`, `!~`, `>`, `<`, `>=`, `<=`.

### Query returns no results

**Cause:** The query is valid but doesn't match any traces.

**Solution:**

1. Expand the time range to search a broader period.
1. Verify the attribute names and values exist in your traces.
1. Check that the attribute names match exactly, as they're case-sensitive.
1. Use the **Search** query builder to explore available attributes and values.
1. Start with a broader query and progressively add filters to narrow results.
1. Try [Grafana Traces Drilldown](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/traces/), a queryless app that lets you explore tracing data using RED metrics without writing TraceQL.
1. Note that Tempo search is non-deterministic—identical queries can return different results because Tempo scans in parallel and returns the first matching traces. Refer to [Understand search behavior](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/query-editor/) for details.
1. Verify traces are being ingested into Tempo by querying for a known trace ID.

### Traces not appearing after successful connection

**Cause:** **Save & test** succeeds, but running queries in Explore returns no traces. The data source connection is valid, but no trace data is reaching Tempo, or the queries don't match any ingested data.

**Solution:**

1. Verify that your applications are instrumented and that your collector (Alloy, OpenTelemetry Collector) is forwarding spans to Tempo. Check collector logs for send errors, rejected spans, or drops.
1. For Grafana Cloud users who send traces with Alloy, refer to [Troubleshoot sending traces with Alloy](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/traces-with-alloy/#troubleshoot) for ingestion-side issues.
1. Confirm that the query time range covers the period when traces were generated. Trace data only appears for the window in which spans were ingested.
1. For multi-tenant setups, verify that the `X-Scope-OrgID` header is the same on both the write path (collector) and the read path (Grafana data source). A mismatch causes traces to be ingested under one tenant and queried under another.
1. Try a broad query, for example, `{}`, with a short, recent time range to confirm that any traces exist in Tempo. If this returns results, your original query filters are too narrow.

### Query timeout

**Error message:** `context deadline exceeded` or `query timeout`

**Cause:** The query took too long to execute. Trace searches scan raw trace data across the selected time range, so broad queries over long periods can exceed timeout limits.

**Solution:**

1. Reduce the time range to limit the amount of data scanned.
1. Add more specific filters to narrow the search scope.
1. Use indexed attributes in your queries when possible for faster lookups.
1. For self-managed Tempo, increase the query timeout in the Tempo server configuration if appropriate.
1. If you need aggregate data (rates, counts, durations) rather than individual traces, consider using [TraceQL metrics queries](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/metrics-queries/) (for example, `{ } | rate()`) or pre-computed metrics from the [metrics generator](https://grafana.com/docs/tempo/<TEMPO_VERSION>/metrics-generator/), which are optimized for aggregate workloads.

### TraceQL metrics query fails

**Error message:** `localblocks processor not found` or `metrics-generator not configured`

**Cause:** TraceQL metrics queries (such as `{ } | rate()` or `{ } | count_over_time()`) require the `local-blocks` processor to be active in the Tempo metrics-generator configuration. This processor is separate from the `service-graphs` and `span-metrics` processors and must be enabled independently.

**Solution:**

1. For self-managed Tempo, activate the `local-blocks` processor in the overrides configuration. The configuration path depends on your Tempo version and deployment method:
   - Standard: `overrides.metrics_generator_processors: ["local-blocks"]`
   - Newer versions and Helm: `overrides.defaults.metrics_generator.processors: [local-blocks]`

   Refer to [Configure TraceQL metrics](https://grafana.com/docs/tempo/<TEMPO_VERSION>/metrics-from-traces/metrics-queries/configure-traceql-metrics/) for setup steps and required configuration.

1. For Grafana Cloud, the `local-blocks` processor is enabled by default. If you still see this error, contact [Grafana Support](https://grafana.com/contact/).
1. Verify that the metrics generator is running and healthy by checking the Tempo metrics-generator logs for errors.

## Streaming issues

Streaming displays TraceQL query results as they become available. Without streaming, you don't see results until the query completes. Streaming is available for Grafana Cloud users by default. For self-managed Tempo, search streaming requires Tempo v2.2 or later, and metrics streaming requires Tempo v2.7 or later. Both require `stream_over_http_enabled: true` in the Tempo configuration.

For more information, refer to [Streaming](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#streaming).

### Streaming not working

**Cause:** Results don't appear incrementally and only display after the full query completes.

**Solution:**

1. For self-managed Tempo, verify that you're using the required Tempo version (v2.2 or later for search streaming, v2.7 or later for metrics streaming) and that streaming is enabled in your configuration (`stream_over_http_enabled: true`). Refer to [Tempo gRPC API](https://grafana.com/docs/tempo/<TEMPO_VERSION>/api_docs/#tempo-grpc-api) in the Tempo documentation. Streaming is available for Grafana Cloud users by default.
1. Verify that **Streaming** is enabled in your [Tempo data source settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#streaming). The **Search queries** and **Metrics queries** toggles are independent—check that the toggle for the query type you're using is enabled.
1. If your Tempo instance is behind a load balancer or proxy that doesn't support gRPC or HTTP2, streaming may not work. Disable streaming and use standard HTTP queries instead.
1. If you're using [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) to reach Tempo, verify that the PDC tunnel is running and the Tempo instance is reachable from the PDC agent. PDC connectivity issues can present as streaming timeouts.

### gRPC transport security error

**Error message:** `rpc error: code = Unavailable desc = credentials require transport level security`

**Cause:** Grafana tries to use gRPC over an insecure (non-TLS) connection. Streaming uses gRPC, which may require TLS depending on your Tempo configuration.

**Solution:**

1. Configure TLS between Grafana and Tempo. Refer to [Configure TLS communication](https://grafana.com/docs/tempo/<TEMPO_VERSION>/configuration/network/tls/).
1. If TLS isn't an option, disable streaming in the [Tempo data source settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#streaming) and use standard HTTP queries instead.

### Partial results or streaming errors

**Error message:** `stream error` or incomplete results during streaming

**Cause:** The streaming connection was interrupted before all results were delivered.

**Solution:**

1. Check network stability between the browser and Grafana.
1. Verify that proxies or load balancers aren't terminating long-lived connections.
1. Disable streaming and use standard queries if issues persist.
1. Check Tempo server logs for any errors related to streaming.

## Service graph issues

The Service Graph visualizes service dependencies and highlights request rate, error rate, and duration (RED metrics) across connections. It requires a linked Prometheus data source with service graph metrics generated by the Tempo metrics generator or Grafana Alloy. For more information, refer to [Service Graph and Service Graph view](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/service-graph/).

### Service graph not displaying

**Cause:** The Service Graph view shows no data or an empty graph.

**Solution:**

1. Verify that a Prometheus data source is linked in the Tempo data source **Service Graph** settings under [Additional settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/additional-settings/).
1. For self-managed Tempo, check that the metrics generator is configured to produce service graph metrics. Refer to [Service graph metrics](https://grafana.com/docs/tempo/<TEMPO_VERSION>/metrics-generator/service-graph-view/) in the Tempo documentation.
1. Ensure the following service graph metrics exist in Prometheus:
   - `traces_service_graph_request_total`
   - `traces_service_graph_request_failed_total`
   - `traces_service_graph_request_server_seconds_sum`
1. Verify that Grafana Alloy or the Tempo metrics generator is configured to produce these metrics. These are distinct from span metrics (`traces_spanmetrics_*`), which power the Service Graph view table.
1. To verify the metrics exist, run the following query in Explore with your Prometheus data source selected:

   ```promql
   {__name__=~"traces_service_graph_request.*"}
   ```

1. Check the Prometheus data source connection is working.
1. For Grafana Cloud Traces users, refer to [Troubleshoot service graph and RED metrics](https://grafana.com/docs/grafana-cloud/send-data/traces/troubleshoot/#troubleshoot-service-graph-and-red-metrics).

### Service Graph view table is empty

**Cause:** The Service Graph node graph renders correctly, but the RED metrics table alongside it shows no data.

**Solution:**

1. The Service Graph view table uses a different set of metrics from the node graph. The Grafana frontend queries `traces_spanmetrics_calls_total` and `traces_spanmetrics_latency_bucket`. Confirm that these metrics exist in your linked Prometheus data source. Newer Tempo versions may produce `traces_spanmetrics_duration_seconds_bucket` instead of `traces_spanmetrics_latency_bucket`. If you only have the newer metric name, the duration column shows no data until the Grafana frontend supports the renamed metric.
1. Verify that span metrics generation is enabled in your Tempo or Alloy configuration. Refer to [Enable service graphs](https://grafana.com/docs/tempo/<TEMPO_VERSION>/metrics-from-traces/service_graphs/enable-service-graphs/) in the Tempo documentation.

### High cardinality warnings

**Cause:** Service graph or span metrics queries produce high-cardinality warnings or slow queries.

**Solution:**

1. Review the label cardinality of your service graph and span metrics. High-cardinality labels (such as unique Pod names or request IDs) create many time series and degrade query performance.
1. Refer to [Cardinality](https://grafana.com/docs/tempo/<TEMPO_VERSION>/metrics-from-traces/metrics-generator/cardinality/) in the Tempo documentation for guidance on managing label cardinality.

### Service graph shows incomplete data

**Cause:** Some services or connections are missing from the graph.

**Solution:**

1. Verify that all services are instrumented and sending spans.
1. Check that span names and service names are consistent.
1. Ensure the time range includes data from all expected services.
1. Verify the Prometheus data source has metrics for all services.

## Trace to logs/metrics/profiles issues

These issues relate to the correlation features that link traces to other telemetry signals. For configuration details, refer to [Trace to logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/), [Trace to metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-metrics/), and [Trace to profiles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-profiles/).

### Trace to logs link not appearing

**Cause:** Links to logs don't appear when viewing a trace.

**Solution:**

1. Verify that a Loki or other log data source is configured in the [Trace to logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/) settings.
1. Check that the configured tags exist in your spans.
1. Ensure at least one mapped tag has a non-empty value in the span.
1. If using a custom query, verify the query syntax is valid for the target data source.
1. Check that **Filter by trace ID** or **Filter by span ID** aren't enabled when using a custom query.
1. If using **Filter by trace ID** with Loki derived fields, verify that the derived field regular expression matches the trace ID field name used in your logs. Different instrumentation libraries use different field names (`traceID`, `trace_id`, or `traceId`). Refer to [Trace to logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/) for common regular expression patterns by instrumentation format.

### Loki log lines don't show a trace link

**Cause:** The reverse direction—navigating from a Loki log line to a trace—isn't working. No trace link appears on log lines.

**Solution:**

1. Verify that a derived field is configured in the Loki data source under **Additional settings > Derived fields**. The derived field extracts the trace ID from log lines and creates a link to Tempo.
1. Check that the derived field regular expression matches the trace ID format in your logs. Use **Show example log message** in the derived field settings to test the regular expression against a sample log line.
1. Confirm the **Internal link** toggle is enabled and points to the correct Tempo data source.
1. If different services use different trace ID field names, you need a separate derived field entry for each format. Refer to [Trace to logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/) for regular expression patterns by format.

### Trace to metrics link not appearing

**Cause:** Links to metrics don't appear when viewing a trace.

**Solution:**

1. Verify that a Prometheus or other metrics data source is configured in the [Trace to metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-metrics/) settings.
1. Check that the configured tags exist in your spans.
1. If using custom queries, verify they're valid PromQL.
1. Ensure the `$__tags` variable is correctly placed in custom queries.

### Trace to profiles link not appearing

**Cause:** Links to profiling data don't appear when viewing a trace.

**Solution:**

1. Verify that a Grafana Pyroscope data source is configured in the [Trace to profiles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-profiles/) settings.
1. Check that the configured tags exist in your spans.
1. Verify that the configured profile type matches what Pyroscope has data for (for example, `process_cpu:cpu:nanoseconds:cpu:nanoseconds`). A mismatch between the configured profile type and the available data causes the link to not appear.
1. Tighten the **Span start time shift** and **Span end time shift** values. Profiles are sampled at intervals, so a narrow time window around the span is more likely to match profile data than a wide one.
1. Verify that the profiling data source is connected and returning data.

### Links appear but return no data

**Cause:** The generated query doesn't match any data in the target data source.

**Solution:**

1. Adjust the **Span start time shift** and **Span end time shift** to widen the time range.
1. Verify that log or metric labels match the span attributes.
1. Check that the tag mappings correctly translate attribute names between data sources. Span attributes use dots (for example, `service.name`) but Loki labels use underscores (for example, `service_name`). Ensure tag mappings account for this difference. Refer to [Trace to logs](ref:trace-to-logs) for tag mapping configuration.
1. If a tag like `pod` is stored as Loki [structured metadata](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/) rather than an indexed label, the auto-generated stream selector `{pod="..."}` returns no results. Enable **Use custom query** and move the tag to a pipeline filter. Refer to [Trace to logs](ref:trace-to-logs) for a custom query example.
1. Run the generated query directly in the target data source's Explore view to confirm it returns data outside of the trace context.
1. Use the Query Inspector to view the generated query and verify it's correct.

## Performance issues

These issues relate to slow queries or high resource usage.

### Slow trace queries

**Cause:** Queries take a long time to return results.

**Solution:**

1. Reduce the dashboard or Explore time range.
1. Add more specific filters to narrow the search scope.
1. Use indexed attributes in TraceQL queries when possible.
1. Enable streaming to see results as they become available.
1. Consider using the **Search** query builder which can help optimize queries.

### High memory usage during queries

**Cause:** Large traces or result sets consume excessive memory.

**Solution:**

1. Reduce the **Limit** setting in query options to return fewer traces.
1. Reduce the **Span Limit** setting to return fewer spans per trace.
1. Add filters to reduce the result set size.
1. Avoid querying very large time ranges.

## Other common issues

The following issues don't produce specific error messages but are commonly encountered.

### Node graph not displaying

**Cause:** The node graph visualization doesn't appear above the trace view.

**Solution:**

1. Verify that **Node graph** is enabled in the Tempo data source settings under [Additional settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/additional-settings/).
1. Check that the trace contains multiple spans with parent-child relationships. Spans must include `traceID` and `spanID`, and non-root spans must include `parentSpanID` to establish hierarchy. If these identifiers are missing, the trace data is incomplete at the instrumentation level and the graph can't be rendered.

### Autocomplete not working

**Cause:** The TraceQL editor doesn't show suggestions for attributes or values. Autocomplete requires Tempo to enumerate tags, which requires a supported storage backend (`vParquet` or later).

**Solution:**

1. For self-managed Tempo, verify that the storage backend supports tag search. Tempo requires `vParquet` format or later for tag-based search and autocomplete. Refer to [Parquet configuration](https://grafana.com/docs/tempo/<TEMPO_VERSION>/configuration/parquet/) for details. Grafana Cloud Traces supports autocomplete by default.
1. Check the **Tags time range** setting in the [data source settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/additional-settings/) to ensure it covers a period with recent trace data.
1. Increase the **Tag limit** setting if you have many unique attributes.
1. Verify the Tempo data source connection is working by selecting **Save & test** in the data source settings.

### Data source settings disappear after restart

**Cause:** You configured settings in the Grafana UI (such as trace-to-logs links, service graph, or span time shifts), but they disappear after Grafana restarts. This happens when the data source is provisioned via a YAML configuration file, Helm chart, or Terraform. Provisioned data sources are read-only in the UI—any changes you make through the UI aren't persisted and silently revert on the next restart.

You can tell a data source is provisioned if the settings form is read-only and the button reads **Test** instead of **Save & test**.

**Solution:**

1. To change settings permanently, edit the provisioning YAML file and restart Grafana (or wait for the provisioning system to reload). Any setting available in the UI can be set in the YAML file, including trace-to-logs, trace-to-metrics, and service graph configuration. Refer to [Provision the Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/) for the full YAML reference.
1. For Grafana Cloud, you can clone the provisioned data source to create an editable copy that persists UI changes. Refer to [Clone a provisioned data source for Grafana Cloud](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/#clone-a-provisioned-data-source-for-grafana-cloud) for the steps.

### TraceQL alerting not available

**Cause:** You can select the Tempo data source in the Grafana Alerting rule builder, but standard TraceQL search queries return trace data (spans and trace IDs), not numeric time series. Alert rules require numeric data to evaluate thresholds, so trace search queries don't produce usable alert conditions.

**Solution:**

TraceQL metrics queries (such as `{ } | rate()` or `{ status = error } | count_over_time()`) return numeric time series and can drive alert thresholds directly. However, TraceQL alerting requires the experimental `tempoAlerting` feature flag, which is disabled by default. To enable it, set the [`tempoAlerting` feature flag](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles) in your Grafana configuration. For Grafana Cloud, contact Support to enable it. For step-by-step setup, refer to [Trace-based alerts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/examples/trace-based-alerts/).

{{< admonition type="caution" >}}
The `tempoAlerting` feature flag is experimental. For production alerting, consider the Prometheus-based approach described below.
{{< /admonition >}}

Alternatively, use the Tempo metrics generator to produce Prometheus metrics from trace data, then create alert rules against the Prometheus data source that stores those metrics.

1. Configure the Tempo [metrics generator](https://grafana.com/docs/tempo/<TEMPO_VERSION>/metrics-generator/) (using the `service-graphs`, `span-metrics`, or `local-blocks` processor) to produce metrics from traces and remote-write them to a Prometheus-compatible backend.
1. Create alert rules against the Prometheus data source that receives those metrics. For example, alert on high error rates using `traces_spanmetrics_calls_total` with a `status_code="STATUS_CODE_ERROR"` filter.
1. Refer to the feature support table in the [Tempo data source overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/) for details on alerting support.

### Switching between multiple Tempo instances

**Cause:** You have multiple Tempo data sources configured (for example, one per environment or per tenant), but there's no built-in UI dropdown in Explore or dashboards to switch between them dynamically.

**Workaround:**

1. In dashboards, create a [data source template variable](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-a-data-source-variable) filtered to `tempo` type. This adds a dropdown that lets viewers switch between Tempo instances without editing the dashboard.
1. In Explore, use the data source picker in the top bar to switch between configured Tempo data sources.
1. For multi-tenant setups on a single Tempo instance, consider using the `X-Scope-OrgID` header instead of separate data sources. Refer to [Multi-tenancy](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/) for configuration details.

## Private data source connect issues (_Grafana Cloud only_)

These issues relate to connecting to a private Tempo instance using Private data source connect (PDC). PDC is only available in Grafana Cloud.

{{< admonition type="note" >}}
Private data source connect allows Grafana Cloud to securely connect to data sources in your private network without exposing them to the public internet. For setup instructions, refer to [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).
{{< /admonition >}}

### PDC agent not connected

**Error message:** `No healthy PDC agents available` or `Private data source connect agent not connected`

**Cause:** The PDC agent installed in your private network isn't running or can't connect to Grafana Cloud.

**Solution:**

1. Verify the PDC agent is running in your private network.
1. Check the PDC agent logs for connection errors.
1. Ensure the PDC agent has outbound network access to Grafana Cloud endpoints.
1. Verify the PDC agent is using the correct token for your Grafana Cloud instance.
1. Check that firewall rules allow outbound HTTPS (port 443) connections from the PDC agent.
1. Restart the PDC agent if it appears stuck or unresponsive.

For more information, refer to [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

### Connection through PDC failing

**Error message:** `Failed to connect through private data source` or `Connection refused via PDC`

**Cause:** The PDC agent is connected to Grafana Cloud but cannot reach the Tempo instance in your private network.

**Solution:**

1. Verify the Tempo URL is correct and accessible from the machine running the PDC agent.
1. Check that the PDC agent can resolve the Tempo hostname (DNS resolution).
1. Ensure there are no firewall rules blocking connections from the PDC agent to Tempo.
1. Verify the Tempo port (default `3200`) is open and accessible.
1. Test connectivity from the PDC agent host to Tempo using `curl` or `telnet`.

### PDC timeout errors

**Error message:** `Request timed out via private data source connect`

**Cause:** Queries through the PDC tunnel are timing out.

**Solution:**

1. Check network latency between the PDC agent and Tempo.
1. Verify the PDC agent host has sufficient resources (CPU, memory, network bandwidth).
1. Ensure no network devices between the PDC agent and Tempo are dropping long-running connections.
1. For large queries, consider reducing the time range or adding more specific filters.
1. Check if multiple data sources are sharing the same PDC agent, which may cause resource contention.

### PDC authentication mismatch

**Error message:** `Unauthorized` or `403 Forbidden` when using PDC

**Cause:** The authentication configured in the data source doesn't work with the PDC connection.

**Solution:**

1. Verify that authentication credentials are configured correctly in the Grafana Cloud data source settings.
1. Check that the Tempo instance accepts the authentication method configured.
1. Ensure any required headers (such as `X-Scope-OrgID` for multi-tenant Tempo) are properly forwarded through PDC.
1. Test the connection directly from the PDC agent host to verify credentials work outside of PDC.

## Get additional help

If you continue to experience issues after following this troubleshooting guide:

1. For Grafana Cloud users, try [Grafana Assistant](https://grafana.com/docs/grafana-cloud/send-data/traces/investigate-traces-with-assistant/) to investigate trace issues interactively (if enabled on your account).
1. For Grafana Cloud users who send traces with Alloy, refer to the [Alloy troubleshooting steps](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/traces-with-alloy/#troubleshoot) for ingestion-side issues.
1. Ask questions in the [Grafana community forums](https://community.grafana.com/) or the [Grafana Community Slack](https://slack.grafana.com/).
1. Review the [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Review the [Tempo GitHub issues](https://github.com/grafana/tempo/issues) for Tempo-specific bugs.
1. Enable [debug logging](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#log) in Grafana to capture detailed error information.
1. Check [Tempo server logs](https://grafana.com/docs/tempo/<TEMPO_VERSION>/operations/monitor/) for additional error details.
1. Contact [Grafana Support](https://grafana.com/contact/) if you're an Enterprise, Cloud Pro, or Cloud Contracted user.

When reporting issues, include:

- Grafana version
- Tempo version
- Error messages (redact sensitive information)
- Steps to reproduce
- TraceQL query examples (redact sensitive data)
- Relevant configuration settings
