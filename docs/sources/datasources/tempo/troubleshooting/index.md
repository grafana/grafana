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
refs:
  configure-tempo-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/configure-tempo-data-source/
  tempo-query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/query-editor/
  service-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/service-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/service-graph/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
---

# Troubleshoot Tempo data source issues

This document provides solutions to common issues you may encounter when configuring or using the Tempo data source in Grafana.

## Scope of this guide

This guide focuses on issues related to connecting Grafana to Tempo and using the data source features. For issues with Tempo itself, refer to the Tempo product documentation:

- [Troubleshoot Tempo](https://grafana.com/docs/tempo/<TEMPO_VERSION>/troubleshooting/) - General Tempo troubleshooting, including ingestion failures and server-side errors.
- [Unable to find traces](https://grafana.com/docs/tempo/<TEMPO_VERSION>/troubleshooting/querying/unable-to-see-trace/) - Traces missing due to ingestion, sampling, or retention issues.
- [Too many requests error](https://grafana.com/docs/tempo/<TEMPO_VERSION>/troubleshooting/querying/too-many-requests-error/) - Query capacity limits and 429 errors.
- [Query issues](https://grafana.com/docs/tempo/<TEMPO_VERSION>/troubleshooting/querying/) - Server-side query failures, bad blocks, and performance tuning.

## Connection errors

These errors occur when Grafana cannot establish or maintain a connection to the Tempo instance.

### Unable to connect to Tempo

**Error message:** "Unable to connect to Tempo" or "dial tcp: connection refused"

**Cause:** Grafana cannot establish a network connection to the Tempo instance.

**Solution:**

1. Verify that the Tempo instance is running and accessible.
1. Check that the URL is correct in the data source configuration. The default Tempo HTTP port is `3200`.
1. Ensure there are no firewall rules blocking the connection between Grafana and Tempo.
1. For Grafana Cloud, ensure you have configured [Private data source connect](ref:private-data-source-connect) if your Tempo instance is not publicly accessible.
1. Verify the protocol (HTTP or HTTPS) matches your Tempo configuration.

### Connection timeout

**Error message:** "Connection timed out" or "context deadline exceeded"

**Cause:** The connection to Tempo timed out before receiving a response.

**Solution:**

1. Check the network latency between Grafana and Tempo.
1. Verify that Tempo is not overloaded or experiencing performance issues.
1. Increase the **Timeout** setting in the data source configuration under **Additional settings**.
1. Check if any network devices (load balancers, proxies) are timing out the connection.
1. For large trace queries, consider reducing the time range or adding more specific filters.

### TLS/SSL connection failures

**Error message:** "TLS handshake failed" or "x509: certificate signed by unknown authority"

**Cause:** There is a mismatch between the TLS settings in Grafana and what Tempo supports or requires.

**Solution:**

1. Verify that Tempo has a valid TLS certificate if HTTPS is enabled.
1. Check that the certificate is trusted by the Grafana server.
1. If using a self-signed certificate, configure the **TLS/SSL Auth Details** in the data source settings.
1. Ensure the certificate's Common Name (CN) or Subject Alternative Name (SAN) matches the hostname used in the URL.

For additional information on setting up TLS encryption with Tempo, refer to [Configure TLS communication](https://grafana.com/docs/tempo/<TEMPO_VERSION>/configuration/network/tls/).

## Authentication errors

These errors occur when there are issues with authentication credentials or permissions.

### Authentication failed

**Error message:** "401 Unauthorized" or "403 Forbidden"

**Cause:** The authentication credentials are invalid or the user doesn't have permission to access Tempo.

**Solution:**

1. Verify that the authentication credentials (username/password or API key) are correct.
1. Check that the user or service account has the required permissions.
1. Ensure the authentication method selected in the data source matches what Tempo expects.
1. For Grafana Cloud, verify that your API key has the correct scopes.

### Multi-tenant authentication issues

**Error message:** "Unauthorized" when using multi-tenant Tempo

**Cause:** The tenant ID (X-Scope-OrgID header) is missing or incorrect.

**Solution:**

1. Verify that the `X-Scope-OrgID` header is configured correctly in the data source settings.
1. Check that the authenticated user has access to the specified tenant.
1. For cross-tenant queries, ensure all specified tenants are accessible.

For more information about multi-tenancy, refer to [Enable multitenancy](https://grafana.com/docs/tempo/<TEMPO_VERSION>/operations/multitenancy/).

## Query errors

These errors occur when there are issues with TraceQL queries or trace lookups.

### Trace not found

**Error message:** "Trace not found" or "trace ID not found"

**Cause:** The specified trace ID doesn't exist in Tempo or is outside the retention period.

**Solution:**

1. Verify the trace ID is correct and complete.
1. Check that the trace is within Tempo's retention period.
1. If using time range restrictions, expand the time range in the **TraceID query** settings.
1. Enable **Enable time range** in the data source settings and adjust the time shift values to search a broader range.
1. Verify the trace was successfully ingested by Tempo.

### TraceQL syntax errors

**Error message:** "parse error" or "unexpected token"

**Cause:** The TraceQL query contains syntax errors.

**Solution:**

1. Verify the query follows [TraceQL syntax](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql).
1. Check that all braces, parentheses, and quotes are balanced.
1. Ensure attribute names are correctly formatted. For attributes with special characters, use bracket notation: `span["http.status_code"]`.
1. Use the **Search** query builder to generate valid TraceQL queries if you're unfamiliar with the syntax.
1. Verify operators are used correctly. Common operators include `=`, `!=`, `=~`, `>`, `<`, `>=`, `<=`.

### Query returns no results

**Cause:** The query is valid but doesn't match any traces.

**Solution:**

1. Expand the time range to search a broader period.
1. Verify the attribute names and values exist in your traces.
1. Check that the attribute names match exactly, as they're case-sensitive.
1. Use the **Search** query builder to explore available attributes and values.
1. Start with a broader query and progressively add filters to narrow results.
1. Verify traces are being ingested into Tempo by querying for a known trace ID.

### Query timeout

**Error message:** "context deadline exceeded" or "query timeout"

**Cause:** The query took too long to execute.

**Solution:**

1. Reduce the time range to limit the amount of data scanned.
1. Add more specific filters to narrow the search scope.
1. Use indexed attributes in your queries when possible.
1. Consider enabling [TraceQL metrics](https://grafana.com/docs/tempo/<TEMPO_VERSION>/metrics-generator/) for aggregate queries.
1. Increase the query timeout in Tempo configuration if appropriate.

## Streaming issues

These issues relate to the streaming feature that displays partial query results.

### Streaming not working

**Cause:** Results don't appear incrementally and only display after the full query completes.

**Solution:**

1. Verify that streaming is enabled in the Tempo data source settings.
1. Check that Tempo is version 2.2 or later.
1. Ensure `stream_over_http_enabled: true` is set in Tempo's configuration.
1. If your Tempo instance is behind a load balancer or proxy that doesn't support gRPC or HTTP2, disable streaming.
1. Check that the browser supports streaming responses.

### Partial results or streaming errors

**Error message:** "stream error" or incomplete results during streaming

**Cause:** The streaming connection was interrupted.

**Solution:**

1. Check network stability between the browser and Grafana.
1. Verify that proxies or load balancers aren't terminating long-lived connections.
1. Disable streaming and use standard queries if issues persist.
1. Check Tempo logs for any errors related to streaming.

## Service graph issues

These issues relate to the Service Graph visualization.

### Service graph not displaying

**Cause:** The Service Graph view shows no data or an empty graph.

**Solution:**

1. Verify that a Prometheus data source is linked in the Tempo data source's **Service Graph** settings.
1. Check that Tempo's metrics generator is configured to generate Service Graph data.
1. Ensure the following metrics exist in Prometheus:
   - `traces_spanmetrics_calls_total`
   - `traces_spanmetrics_latency_bucket`
1. Verify that Grafana Alloy or Tempo is configured to generate span metrics.
1. Check the Prometheus data source connection is working.

For more information, refer to [Service Graph and Service Graph view](ref:service-graph).

### Service graph shows incomplete data

**Cause:** Some services or connections are missing from the graph.

**Solution:**

1. Verify that all services are instrumented and sending spans.
1. Check that span names and service names are consistent.
1. Ensure the time range includes data from all expected services.
1. Verify the Prometheus data source has metrics for all services.

## Trace to logs/metrics/profiles issues

These issues relate to the correlation features between traces and other telemetry signals.

### Trace to logs link not appearing

**Cause:** Links to logs don't appear when viewing a trace.

**Solution:**

1. Verify that a Loki or other log data source is configured in the **Trace to logs** settings.
1. Check that the configured tags exist in your spans.
1. Ensure at least one mapped tag has a non-empty value in the span.
1. If using a custom query, verify the query syntax is valid for the target data source.
1. Check that **Filter by trace ID** or **Filter by span ID** aren't enabled when using a custom query.

### Trace to metrics link not appearing

**Cause:** Links to metrics don't appear when viewing a trace.

**Solution:**

1. Verify that a Prometheus or other metrics data source is configured in the **Trace to metrics** settings.
1. Check that the configured tags exist in your spans.
1. If using custom queries, verify they're valid PromQL.
1. Ensure the `$__tags` variable is correctly placed in custom queries.

### Links appear but return no data

**Cause:** The generated query doesn't match any data in the target data source.

**Solution:**

1. Adjust the **Span start time shift** and **Span end time shift** to widen the time range.
1. Verify that log or metric labels match the span attributes.
1. Check that the tag mappings correctly translate attribute names between data sources.
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

1. Verify that **Node graph** is enabled in the Tempo data source settings.
1. Check that the trace contains multiple spans with parent-child relationships.
1. Ensure the trace data includes the required span attributes.

### Autocomplete not working

**Cause:** The TraceQL editor doesn't show suggestions for attributes or values.

**Solution:**

1. Verify that Tempo is configured to support tag/attribute queries.
1. Check the **Tags time range** setting to ensure it covers recent data.
1. Increase the **Tag limit** setting if you have many unique attributes.
1. Verify the Tempo data source connection is working.

### Provisioned data source can't be modified

**Cause:** You can't edit settings for a data source that was provisioned via configuration file.

**Solution:**

1. Modify the provisioning YAML file to change data source settings.
1. For Grafana Cloud, clone the provisioned data source to create an editable copy.
1. Refer to [Configure the Tempo data source](ref:configure-tempo-data-source) for provisioning instructions.

## Private data source connect issues (_Grafana Cloud only_)

These issues relate to connecting to a private Tempo instance using Private data source connect (PDC). PDC is only available in Grafana Cloud.

{{< admonition type="note" >}}
Private data source connect allows Grafana Cloud to securely connect to data sources in your private network without exposing them to the public internet. For setup instructions, refer to [Private data source connect](ref:private-data-source-connect).
{{< /admonition >}}

### PDC agent not connected

**Error message:** "No healthy PDC agents available" or "Private data source connect agent not connected"

**Cause:** The PDC agent installed in your private network isn't running or can't connect to Grafana Cloud.

**Solution:**

1. Verify the PDC agent is running in your private network.
1. Check the PDC agent logs for connection errors.
1. Ensure the PDC agent has outbound network access to Grafana Cloud endpoints.
1. Verify the PDC agent is using the correct token for your Grafana Cloud instance.
1. Check that firewall rules allow outbound HTTPS (port 443) connections from the PDC agent.
1. Restart the PDC agent if it appears stuck or unresponsive.

For more information, refer to [Private data source connect](ref:private-data-source-connect).

### Connection through PDC failing

**Error message:** "Failed to connect through private data source" or "Connection refused via PDC"

**Cause:** The PDC agent is connected to Grafana Cloud but cannot reach the Tempo instance in your private network.

**Solution:**

1. Verify the Tempo URL is correct and accessible from the machine running the PDC agent.
1. Check that the PDC agent can resolve the Tempo hostname (DNS resolution).
1. Ensure there are no firewall rules blocking connections from the PDC agent to Tempo.
1. Verify the Tempo port (default `3200`) is open and accessible.
1. Test connectivity from the PDC agent host to Tempo using `curl` or `telnet`.

### PDC timeout errors

**Error message:** "Request timed out via private data source connect"

**Cause:** Queries through the PDC tunnel are timing out.

**Solution:**

1. Check network latency between the PDC agent and Tempo.
1. Verify the PDC agent host has sufficient resources (CPU, memory, network bandwidth).
1. Ensure no network devices between the PDC agent and Tempo are dropping long-running connections.
1. For large queries, consider reducing the time range or adding more specific filters.
1. Check if multiple data sources are sharing the same PDC agent, which may cause resource contention.

### PDC authentication mismatch

**Error message:** "Unauthorized" or "403 Forbidden" when using PDC

**Cause:** The authentication configured in the data source doesn't work with the PDC connection.

**Solution:**

1. Verify that authentication credentials are configured correctly in the Grafana Cloud data source settings.
1. Check that the Tempo instance accepts the authentication method configured.
1. Ensure any required headers (such as `X-Scope-OrgID` for multi-tenant Tempo) are properly forwarded through PDC.
1. Test the connection directly from the PDC agent host to verify credentials work outside of PDC.

## Get additional help

If you continue to experience issues after following this troubleshooting guide:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Review the [Tempo GitHub issues](https://github.com/grafana/tempo/issues) for Tempo-specific bugs.
1. Enable debug logging in Grafana to capture detailed error information.
1. Check Tempo logs for additional error details.
1. Contact [Grafana Support](https://grafana.com/contact/) if you’re an Enterprise, Cloud Pro or Cloud Contracted user.

When reporting issues, include:

- Grafana version
- Tempo version
- Error messages (redact sensitive information)
- Steps to reproduce
- TraceQL query examples (redact sensitive data)
- Relevant configuration settings
