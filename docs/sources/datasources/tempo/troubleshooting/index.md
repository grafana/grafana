---
description: Troubleshooting the Tempo data source in Grafana
keywords:
  - grafana
  - tempo
  - troubleshooting
  - tracing
  - errors
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot issues with the Tempo data source
weight: 600
---

# Troubleshoot issues with the Tempo data source

This document provides troubleshooting information for common errors you may encounter when using the Tempo data source in Grafana.

## Connection errors

The following errors occur when Grafana cannot establish or maintain a connection to Tempo.

### Failed to connect to Tempo

**Error message:** "Health check failed: Failed to connect to Tempo"

**Cause:** Grafana cannot establish a network connection to the Tempo server.

**Solution:**

1. Verify that the Tempo URL is correct in the data source configuration.
1. Check that Tempo is running and accessible from the Grafana server.
1. Ensure there are no firewall rules blocking the connection.
1. If using a proxy, verify the proxy settings are correct.
1. For Grafana Cloud, ensure you have configured [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if your Tempo instance is not publicly accessible.

### Request timed out

**Error message:** "Health check failed: Tempo data source is not healthy. Request timed out"

**Cause:** The connection to Tempo timed out before receiving a response.

**Solution:**

1. Check the network latency between Grafana and Tempo.
1. Verify that Tempo is not overloaded or experiencing performance issues.
1. Increase the timeout setting in the data source configuration if needed.
1. Check if any network devices (load balancers, proxies) are timing out the connection.
1. For large trace queries, consider reducing the time range or adding more specific filters.

## Authentication errors

The following errors occur when there are issues with authentication credentials or permissions.

### Unauthorized (401)

**Error message:** "Health check failed: Tempo data source is not healthy. Status: 401 Unauthorized"

**Cause:** The authentication credentials are invalid or missing.

**Solution:**

1. Verify that the username and password are correct.
1. If using an API key or bearer token, ensure the key is valid and has not expired.
1. Check that the authentication method selected matches your Tempo configuration.
1. For Grafana Cloud Traces, verify the Grafana Cloud API key has the correct permissions.

### Forbidden (403)

**Error message:** "Health check failed: Tempo data source is not healthy. Status: 403 Forbidden"

**Cause:** The authenticated user does not have permission to access Tempo.

**Solution:**

1. Verify the user has the required role to access the Tempo data source.
1. Check tenant configuration if using multi-tenant Tempo.
1. Ensure the `X-Scope-OrgID` header is correctly configured for multi-tenant setups.
1. Review Tempo's authentication and authorization configuration.

## Trace retrieval errors

The following errors occur when there are issues retrieving or displaying traces.

### Trace not found

**Error message:** "Trace not found" or "failed to get trace"

**Cause:** The requested trace ID does not exist in Tempo or has been removed by retention policies.

**Solution:**

1. Verify the trace ID is correct and complete.
1. Check that the trace falls within Tempo's configured retention period.
1. Ensure the trace has been fully flushed from the ingester to the backend storage.
1. If using multi-tenant Tempo, verify you are querying the correct tenant.
1. Wait a few seconds and retry—traces may not be immediately available after ingestion.

### Trace too large

**Error message:** "trace exceeds max_bytes_per_trace" or response is truncated.

**Cause:** The trace contains more spans than Tempo is configured to return.

**Solution:**

1. Check the `max_bytes_per_trace` setting in Tempo's configuration.
1. Increase the limit if appropriate for your use case.
1. Consider whether the instrumented application is creating an excessive number of spans.
1. Review the instrumentation to reduce unnecessary spans or use sampling.

### Partial trace results

**Cause:** A trace query returns some spans but appears incomplete.

**Solution:**

1. Check if all Tempo components (distributors, ingesters, compactors, queriers) are healthy.
1. Verify that ingested traces have been flushed to backend storage.
1. If using Tempo in microservices mode, ensure all querier instances can access all blocks.
1. Check for clock skew between services—spans with future timestamps may not appear in time-bounded queries.

## TraceQL query errors

The following errors occur when there are issues with TraceQL queries.

### TraceQL syntax error

**Error message:** "parse error" or "unexpected token"

**Cause:** The TraceQL query contains a syntax error.

**Solution:**

1. Verify the query syntax against the [TraceQL documentation](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/).
1. Ensure attribute names are correctly formatted (for example, `span.http.status_code` or `resource.service.name`).
1. Check that string values are enclosed in double quotes (for example, `"GET"`).
1. Verify that comparison operators are valid (`=`, `!=`, `>`, `<`, `>=`, `<=`, `=~`, `!~`).

### TraceQL query timeout

**Error message:** "context deadline exceeded" or "query timed out"

**Cause:** The TraceQL query is too broad or Tempo cannot process it within the configured timeout.

**Solution:**

1. Narrow the time range of your query.
1. Add more specific filters to reduce the number of traces scanned.
1. Use indexed attributes (resource-level attributes) for filtering when possible.
1. Increase the query timeout in Tempo's configuration if the query is expected to be long-running.
1. Check Tempo querier resource allocation—queries may need more CPU or memory.

### No results returned

**Cause:** A TraceQL query returns empty results when data is expected.

**Solution:**

1. Verify the time range includes data in your Tempo instance.
1. Check that attribute names match exactly (attribute names are case-sensitive).
1. Test with a broad query first (for example, `{}`) and then narrow down.
1. Verify that the correct data source is selected in the query editor.
1. For resource-level attributes, use the `resource.` prefix (for example, `resource.service.name`).

## Service graph errors

The following errors occur when there are issues with the service graph feature.

### Service graph not displaying

**Cause:** The service graph panel shows no data or an error.

**Solution:**

1. Verify that a Prometheus-compatible data source is configured as the service graph data source in the Tempo data source settings.
1. Check that Tempo's metrics generator is enabled and configured to produce service graph metrics.
1. Ensure the Prometheus data source contains the metrics `traces_service_graph_request_total` and `traces_service_graph_request_failed_total`.
1. Verify the time range includes data with service graph metrics.

### Missing edges or nodes

**Cause:** Some services or connections are not appearing in the service graph.

**Solution:**

1. Verify that all services are instrumented and sending traces to Tempo.
1. Check that trace context propagation is correctly configured between services.
1. Ensure the metrics generator has processed enough traces to establish connections.
1. Increase the time range to include more data.

## Trace-to-logs and trace-to-metrics correlation errors

The following errors occur when there are issues with correlation features.

### Trace-to-logs link not working

**Cause:** Clicking on a trace-to-logs link does not show relevant logs.

**Solution:**

1. Verify the Loki data source is correctly configured in the Tempo data source settings under **Trace to logs**.
1. Check that the configured tags or mapped attributes exist in both the trace spans and the log labels.
1. Ensure the filter by trace ID or span ID option matches your log format.
1. Verify Loki contains logs for the time range of the trace.

### Trace-to-metrics link not working

**Cause:** Clicking on a trace-to-metrics link does not show relevant metrics.

**Solution:**

1. Verify the Prometheus data source is correctly configured in the Tempo data source settings under **Trace to metrics**.
1. Check that the configured query includes valid label mappings from span attributes to metric labels.
1. Ensure the Prometheus data source contains the referenced metrics.

## Performance issues

The following issues relate to slow or resource-intensive operations.

### Slow trace search

**Cause:** Searching for traces takes a long time.

**Solution:**

1. Reduce the time range of your search.
1. Use more specific filters (service name, operation, duration, status).
1. Ensure Tempo's compactor is running and blocks are being compacted regularly.
1. Check Tempo querier resource allocation.
1. For Tempo with the `vparquet` block format, verify that the dedicated attribute columns include your most-queried attributes.

### High memory usage during queries

**Cause:** Tempo queries consume excessive memory in Grafana.

**Solution:**

1. Limit the number of traces returned using the **Limit** field in the query editor.
1. Reduce the time range of your query.
1. Avoid fetching very large traces (thousands of spans) when not needed.
1. Check Grafana's memory allocation and increase if necessary.

## Get additional help

If you continue to experience issues after following this troubleshooting guide:

1. Check the [Tempo documentation](https://grafana.com/docs/tempo/<TEMPO_VERSION>/) for configuration guidance.
1. Review the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Contact Grafana Support if you have an Enterprise or Cloud license.
