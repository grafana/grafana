---
aliases:
  - ../../data-sources/loki/troubleshooting/
description: Troubleshoot issues with the Loki data source in Grafana
keywords:
  - grafana
  - loki
  - troubleshooting
  - errors
  - logs
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot issues with the Loki data source
weight: 600
refs:
  configure-loki:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
---

# Troubleshoot issues with the Loki data source

This document provides troubleshooting information for common errors you may encounter when using the Loki data source in Grafana.

## Connection errors

The following errors occur when Grafana cannot establish or maintain a connection to Loki.

### Unable to connect with Loki

**Error message:** "Unable to connect with Loki. Please check the server logs for more details."

**Cause:** Grafana cannot establish a network connection to the Loki server.

**Solution:**

1. Verify the Loki URL is correct in the [data source configuration](ref:configure-loki).
1. Check that Loki is running and accessible from the Grafana server.
1. Ensure no firewall rules are blocking the connection.
1. If using a proxy, verify the proxy settings are correct.
1. For Grafana Cloud, ensure you have configured [Private data source connect](ref:private-data-source-connect) if your Loki instance is not publicly accessible.

### Request timed out

**Error message:** "context deadline exceeded" or "request timed out"

**Cause:** The connection to Loki timed out before receiving a response.

**Solution:**

1. Check the network latency between Grafana and Loki.
1. Verify Loki is not overloaded or experiencing performance issues.
1. Increase the **Timeout** setting in the data source configuration under **Additional settings** > **Advanced HTTP settings**.
1. Check if any network devices (load balancers, proxies) are timing out the connection.
1. Reduce the time range or complexity of your query.

### Failed to parse data source URL

**Error message:** "Failed to parse data source URL"

**Cause:** The URL entered in the data source configuration is not valid.

**Solution:**

1. Verify the URL format is correct (for example, `http://localhost:3100` or `https://loki.example.com:3100`).
1. Ensure the URL includes the protocol (`http://` or `https://`).
1. Remove any trailing slashes or invalid characters from the URL.

## Authentication errors

The following errors occur when there are issues with authentication credentials or permissions.

### Unauthorized (401)

**Error message:** "Status: 401 Unauthorized"

**Cause:** The authentication credentials are invalid or missing.

**Solution:**

1. Verify the username and password are correct in the data source configuration.
1. Check the authentication method matches your Loki configuration.
1. If using a bearer token or API key, ensure it is valid and has not expired.
1. Verify the credentials have permission to access the Loki API.

### Forbidden (403)

**Error message:** "Status: 403 Forbidden"

**Cause:** The authenticated user does not have permission to access the requested resource.

**Solution:**

1. Verify the user has read access to the log streams you are querying.
1. Check Loki's authentication and authorization configuration.
1. If using multi-tenancy, ensure the correct tenant ID (X-Scope-OrgID header) is configured.
1. Review any access control policies in your Loki deployment.

## Query errors

The following errors occur when there are issues with LogQL query syntax or execution.

### Parse error

**Error message:** "parse error" or "syntax error"

**Cause:** The LogQL query contains invalid syntax.

**Solution:**

1. Check the query for typos or missing characters.
1. Verify all brackets, braces, and parentheses are properly balanced.
1. Ensure label matchers use the correct operators (`=`, `!=`, `=~`, `!~`).
1. Verify string values are enclosed in double quotes.
1. Refer to the [LogQL documentation](https://grafana.com/docs/loki/latest/query/) for correct syntax.

**Common syntax issues:**

| Issue | Incorrect | Correct |
| ----- | --------- | ------- |
| Missing quotes | `{job=app}` | `{job="app"}` |
| Wrong operator | `{job=="app"}` | `{job="app"}` |
| Unbalanced braces | `{job="app"` | `{job="app"}` |
| Invalid regex | `{job=~"["}` | `{job=~"\\["}` |

### Query limits exceeded

**Error message:** "query returned more than the max number of entries" or "max entries limit exceeded"

**Cause:** The query returned more log entries than the configured limit allows.

**Solution:**

1. Add more specific label selectors to reduce the number of matching streams.
1. Add line filters to narrow down the results (for example, `|= "error"`).
1. Reduce the time range of your query.
1. Increase the **Maximum lines** setting in the data source configuration.
1. If you control the Loki instance, consider adjusting Loki's `max_entries_limit_per_query` setting.

### Query timeout

**Error message:** "query timed out"

**Cause:** The query took longer to execute than the configured timeout.

**Solution:**

1. Simplify the query by adding more selective label matchers.
1. Reduce the time range.
1. Avoid expensive operations like complex regex patterns on high-cardinality data.
1. If you control the Loki instance, check Loki's query timeout settings.

### Too many outstanding requests

**Error message:** "too many outstanding requests"

**Cause:** Loki has reached its limit for concurrent queries.

**Solution:**

1. Wait a moment and retry the query.
1. Reduce the number of panels or dashboards querying Loki simultaneously.
1. If you control the Loki instance, consider increasing Loki's concurrency limits.

## Metric query errors

The following errors occur when using LogQL metric queries.

### Invalid unwrap expression

**Error message:** "invalid unwrap expression" or "unwrap: label does not exist"

**Cause:** The `unwrap` function references a label that doesn't exist or isn't numeric.

**Solution:**

1. Verify the label name in the `unwrap` expression exists in your log data.
1. Ensure the label contains numeric values.
1. Add a parser stage (`| logfmt`, `| json`, etc.) before `unwrap` to extract the label from log content.

**Example fix:**

```logql
# Incorrect - label might not exist
{job="app"} | unwrap latency

# Correct - parse the log first
{job="app"} | logfmt | unwrap latency
```

### Division by zero

**Error message:** "division by zero"

**Cause:** A metric query attempted to divide by zero.

**Solution:**

1. Add conditions to handle cases where the denominator could be zero.
1. Use the `or` operator to provide a default value.

## Common issues

The following issues don't always produce specific error messages but are commonly encountered.

### Empty query results

**Cause:** The query returns no data.

**Solution:**

1. Verify the time range includes data in your Loki instance.
1. Check that the label selectors match existing log streams.
1. Use the **Label browser** in the query editor to see available labels and values.
1. Start with a simple query like `{job="your-job"}` and add filters incrementally.
1. Verify logs are being ingested into Loki for the selected time range.

### Slow query performance

**Cause:** Queries take a long time to execute.

**Solution:**

1. Add more specific label selectors. Labels are indexed, so filtering by labels is fast.
1. Reduce the time range of your query.
1. Avoid regex filters on high-volume streams when possible.
1. Use line filters (`|=`, `!=`) before expensive regex operations.
1. For metric queries, ensure you're using appropriate aggregation intervals.

**Query optimization tips:**

| Slow | Fast |
| ---- | ---- |
| `{namespace="prod"} \|~ "error.*timeout"` | `{namespace="prod", level="error"} \|= "timeout"` |
| `{job=~".+"}` (matches all) | `{job="specific-job"}` |
| Wide time range, no filters | Narrow time range with label filters |

### Labels not appearing in dropdown

**Cause:** The label browser doesn't show expected labels.

**Solution:**

1. Check that logs with those labels exist in the selected time range.
1. Verify the labels are indexed in Loki (not just parsed from log content).
1. Refresh the label browser by clicking the refresh button.
1. Clear your browser cache and reload the page.

### Log lines truncated

**Cause:** Long log lines are cut off in the display.

**Solution:**

1. Click on a log line to expand and view the full content.
1. Use the **Wrap lines** option in the logs visualization settings.
1. The full log content is always available; only the display is truncated.

### Derived fields not working

**Cause:** Derived fields configured in the data source aren't appearing in log details.

**Solution:**

1. Verify the regex pattern in your derived field configuration matches your log format.
1. Test the regex in the **Debug** section of the derived fields configuration.
1. Ensure the derived field has a valid URL or internal data source configured.
1. Check that the log lines contain text matching the regex pattern.

## Multi-tenancy issues

### No org id

**Error message:** "no org id" or "X-Scope-OrgID header required"

**Cause:** Loki is configured for multi-tenancy but no tenant ID was provided.

**Solution:**

1. Add a custom HTTP header `X-Scope-OrgID` with your tenant ID in the data source configuration.
1. Navigate to **Additional settings** > **HTTP headers** and add the header.

### Tenant not found

**Error message:** "tenant not found" or "invalid tenant"

**Cause:** The specified tenant ID doesn't exist or the user doesn't have access.

**Solution:**

1. Verify the tenant ID is correct.
1. Check that the tenant exists in your Loki deployment.
1. Verify the user has permission to access the specified tenant.

## Get additional help

If you continue to experience issues:

- Check the [Grafana community forums](https://community.grafana.com/) for similar issues and solutions.
- Review the [Loki documentation](https://grafana.com/docs/loki/latest/) for detailed configuration and query guidance.
- Contact Grafana Support if you're an Enterprise, Cloud Pro, or Cloud contracted customer.

When reporting issues, include the following information:

- Grafana version
- Loki version
- Deployment type (self-hosted Loki, Grafana Cloud Logs)
- Error messages (redact sensitive information)
- Steps to reproduce the issue
- Relevant configuration such as data source settings, authentication method, and timeout values (redact credentials)
- Sample LogQL query (if applicable, with sensitive data redacted)
- Time range of the query
- Approximate volume of logs being queried

