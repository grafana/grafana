---
description: Troubleshooting guide for the Grafana Pyroscope data source
keywords:
  - grafana
  - pyroscope
  - profiling
  - troubleshooting
  - errors
  - flame graph
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Pyroscope data source issues
weight: 500
review_date: 2026-07-08
---

# Troubleshoot Pyroscope data source issues

This document provides solutions to common issues you may encounter when configuring or using the Pyroscope data source. For configuration instructions, refer to [Configure the Grafana Pyroscope data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/configure/).

## Connection and configuration errors

These errors occur when setting up the data source or when connecting to the Pyroscope backend.

### "Data source is not working" or connection fails

**Symptoms:**

- Save & test fails with a connection error
- Error message indicates the Pyroscope backend is unreachable
- Timeout errors when testing the data source

**Possible causes and solutions:**

| Cause                         | Solution                                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incorrect URL                 | Verify the URL points to your Pyroscope instance. For self-managed deployments, the default port is `4040` (for example, `http://localhost:4040`).                                        |
| Pyroscope service not running | Check that the Pyroscope backend is running and accessible. Use `curl` or a browser to test connectivity to the Pyroscope URL.                                                            |
| Network connectivity issues   | Verify network connectivity from the Grafana server to the Pyroscope endpoint. Check firewall rules allow outbound connections on the required port.                                      |
| Microservices mode routing    | If running Pyroscope in microservices mode, ensure the URL points to a gateway or proxy that routes requests correctly. Refer to the Helm ingress configuration for routing requirements. |
| TLS/SSL certificate issues    | If using HTTPS, verify the certificate is valid and trusted by the Grafana server. Configure TLS settings in the data source if using self-signed certificates.                           |

### URL format issues

**Symptoms:**

- Data source test fails immediately
- Error indicates invalid URL

**Solutions:**

1. Ensure the URL includes the protocol (`http://` or `https://`).
1. Remove any trailing slashes from the URL.
1. For Grafana Cloud Profiles, find the correct URL under **Manage your stack** in your organization settings.
1. Verify the port number is correct for your deployment.

### Private connectivity or reverse proxy issues

**Symptoms:**

- The data source works from some networks but not others.
- Connecting through a reverse proxy, load balancer, or private link fails.

**Solutions:**

1. Include the scheme in the **Connection URL**. When connecting through a private endpoint or reverse proxy, use `https://` explicitly rather than a bare host name.
1. Ensure the reverse proxy or gateway forwards the Pyroscope API paths unchanged. Rewriting or stripping the request path prevents the data source from reaching the backend.
1. For Grafana Cloud connecting to a Pyroscope backend on a private network, configure [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).
1. Verify that any firewall or private link allows outbound HTTPS from Grafana to the Pyroscope endpoint.

## Authentication errors

These errors occur when the data source cannot authenticate with the Pyroscope backend.

### "Authentication failed" or "Unauthorized"

**Symptoms:**

- Save & test fails with authentication errors
- Queries return 401 or 403 status codes
- Profile types don't load

**Possible causes and solutions:**

| Cause                          | Solution                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid credentials            | Verify the username and password or API key are correct.                                                                                             |
| Expired credentials            | Generate new credentials and update the data source configuration.                                                                                   |
| Incorrect authentication type  | Ensure you've selected the correct authentication method for your Pyroscope deployment (Basic auth, API key, or no authentication for local setups). |
| Missing authentication headers | For custom authentication, verify the required headers are configured correctly in the data source settings.                                         |

### Basic authentication not working

**Symptoms:**

- Basic auth credentials are rejected
- Works in browser but fails in Grafana

**Solutions:**

1. Verify Basic authentication is enabled in the data source settings.
1. Ensure the username and password are entered correctly (no extra spaces).
1. Check that the Pyroscope backend is configured to accept Basic authentication.
1. For Grafana Cloud Profiles, use Basic authentication with your access policy token as the password. Refer to [Grafana Cloud access policy and token issues](#grafana-cloud-access-policy-and-token-issues).

### API key authentication issues

**Symptoms:**

- API key is rejected
- Error indicates invalid token

**Solutions:**

1. Verify you're using the correct API key format for your Pyroscope deployment.
1. For Grafana Cloud, generate a new access policy token with the `profiles:read` scope.
1. Ensure the credentials have the required permissions to read profiling data.
1. Check if the token has expired and generate a new one if necessary.

### Grafana Cloud access policy and token issues

**Symptoms:**

- Authentication fails when connecting a data source to Grafana Cloud Profiles.
- Queries return 401 or 403 after a backend migration or stack change.
- The data source reads from a different stack or tenant than expected.

**Cause:**

Grafana Cloud Profiles authenticates with an access policy token rather than a user password. The token must belong to an access policy that includes the `profiles:read` scope and targets the correct stack. A token with the wrong scope, or one created for a different stack, fails authentication or returns data from the wrong tenant. Tokens and connection URLs are stack-specific and don't carry over during a migration.

**Solutions:**

1. Create or select an access policy that includes the `profiles:read` scope and whose realm targets the correct stack, then generate a token for that policy.
1. In the data source, enable **Basic auth**. Enter the numeric instance ID as the username and the access policy token as the password. Find the instance ID and endpoint under **Manage your stack**.
1. Confirm the **Connection URL** points to the Pyroscope endpoint for the same stack as the token.
1. After a backend migration or stack change, regenerate the token, then update both the URL and credentials.

## Query errors

These errors occur when executing queries against the Pyroscope data source.

### "No data" or empty results

**Symptoms:**

- Query executes without error but returns no data
- Flame graph shows "No data" message
- Metrics graph is empty

**Possible causes and solutions:**

| Cause                                 | Solution                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Time range doesn't contain data       | Expand the dashboard time range. Profiling data may not exist for the selected period.                               |
| Application not sending profiles      | Verify your application is configured to send profiles to Pyroscope. Check the Pyroscope agent or SDK configuration. |
| Incorrect profile type selected       | Select a different profile type from the drop-down menu. Not all profile types are available for all applications.   |
| Label selector too restrictive        | Remove or modify label filters to broaden the query. Start without filters to verify data exists.                    |
| Wrong service or application selected | Verify the `service_name` label matches your application's configuration.                                            |
| Profile type or app not selected      | Ensure you've selected a profile type or app in the query editor. The query returns no data if neither is selected.  |

{{< admonition type="note" >}}
If the data source connection tests successfully but no profiles exist for any query, the problem is usually on the ingestion side rather than in the data source. The data source only reads profiles from Pyroscope; it doesn't collect or send them. Verify that your application, SDK, or collector, such as Grafana Alloy or an OpenTelemetry Collector, is sending profiles to your Pyroscope backend. For ingestion setup, refer to [Configure the client to send profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/).
{{< /admonition >}}

### "Profile type not found" or empty profile type selector

**Symptoms:**

- Profile type drop-down is empty
- Error indicates profile type doesn't exist

**Solutions:**

1. Verify the Pyroscope backend is receiving profiles from your applications.
1. Check that the time range includes periods when profiles were collected.
1. Test the data source connection to ensure it's working correctly.
1. For new deployments, wait a few minutes for initial profile data to be ingested.

### Label names or values not loading

**Symptoms:**

- Label selector doesn't populate
- No labels appear in the drop-down menus
- Autocomplete doesn't work

**Solutions:**

1. Verify the data source connection is working by testing it in the settings.
1. Select a profile type first, as labels are loaded based on the selected profile type.
1. Expand the time range to ensure label data is available.
1. Check the browser console for JavaScript errors that might indicate issues.

### Query syntax errors

**Symptoms:**

- Error message indicates invalid query syntax
- Label selector is rejected

**Solutions:**

1. Use the correct label selector syntax. Pyroscope uses a syntax similar to Prometheus.
1. Enclose label values in double quotes: `{service_name="my-service"}`.
1. Use valid operators: `=`, `!=`, `=~`, `!~`.
1. Escape special characters in regular expression patterns when using `=~` or `!~`.

Example valid queries:

```
{service_name="my-app"}
{service_name="my-app", env="production"}
{service_name=~"my-app.*"}
```

### Queries return only recent data even though older data is retained

If a query over a long time range returns data only for the most recent days, the query time range likely exceeds a server-side query limit. This is most commonly reported in Grafana Cloud Profiles. Refer to [Query time range and retention limits](#query-time-range-and-retention-limits).

## Template variable errors

These errors occur when using template variables with the Pyroscope data source.

### Variables return no values

**Symptoms:**

- The variable drop-down is empty
- Dependent variables don't populate

**Solutions:**

1. Verify the data source connection is working by testing it in the settings.
1. For **Label** and **Label value** variables, verify that a profile type is selected. Labels and label values are scoped to the selected profile type.
1. Expand the dashboard time range to ensure the variable query covers a period when profiles were collected.
1. Confirm the Pyroscope backend is receiving profiles from your applications.

### Variables don't filter queries as expected

**Symptoms:**

- Query results don't change when the variable value changes
- Queries return no data after selecting a variable value

**Solutions:**

1. Verify the variable is referenced correctly in the label selector, for example, `{service_name="$service"}`.
1. When **Multi-value** or **Include All** is enabled, the variable value becomes a regular expression pattern. Use the `=~` operator instead of `=`, for example, `{service_name=~"$service"}`.
1. Confirm the label used in the variable exists on the profiling data for the selected profile type.

For more information, refer to [Grafana Pyroscope template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/template-variables/).

## Flame graph issues

These errors are specific to the flame graph visualization.

### Flame graph not rendering

**Symptoms:**

- Query returns data but flame graph doesn't display
- Flame graph area is blank
- Loading indicator never completes

**Solutions:**

1. Check that the Query Type is set to include profile data (not metrics only).
1. Verify the response contains valid profile data using the Query Inspector.
1. Try refreshing the page or re-running the query.
1. For large profiles, increase the browser memory limits or reduce the time range.

### Flame graph times out or fails to load on large time ranges

**Symptoms:**

- A flame graph renders for a short time range, such as five minutes, but times out for a longer range, such as 30 minutes or more.
- Queries over large time ranges are slow or fail intermittently.

**Cause:**

Rendering a flame graph over a large time range requires the Pyroscope backend to merge many profiles, which increases query time and memory use. Large or high-cardinality ranges can exceed request timeouts before a result returns.

**Solutions:**

1. Narrow the time range. Start with a short window, such as five minutes, then widen it gradually to find the largest range that renders reliably.
1. Add label filters to reduce the volume of profiles the backend must merge.
1. Confirm the range is within the server-side query limits described in [Query time range and retention limits](#query-time-range-and-retention-limits).
1. For self-managed deployments, review backend resources and query timeout settings if large ranges consistently fail.

### Flame graph shows aggregated data without detail

**Symptoms:**

- Flame graph lacks expected granularity
- Function names are missing or truncated
- Stack traces appear incomplete

**Solutions:**

1. Zoom in to a smaller time range to get more detailed profiles.
1. Verify your application is instrumented to capture full stack traces.
1. Check if the profiling agent is configured with sufficient sampling rate.
1. For compiled languages, ensure debug symbols are available.

### Unable to interact with flame graph

**Symptoms:**

- Clicking on flame graph elements doesn't work
- Tooltip doesn't appear
- Zoom and filter controls are unresponsive

**Solutions:**

1. Verify JavaScript is enabled in your browser.
1. Check the browser console for JavaScript errors.
1. Try using a different browser or clearing the browser cache.
1. Update Grafana to the latest version.

## Profiles Drilldown issues

These errors are specific to the [Profiles Drilldown](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/profiles/) application.

### Profiles Drilldown not available

**Symptoms:**

- Profiles Drilldown option doesn't appear in the menu
- Error when trying to access Profiles Drilldown

**Solutions:**

1. Verify the Profiles Drilldown plugin is installed and enabled.
1. For self-managed Grafana, install the plugin from the Grafana plugin catalog.
1. Restart Grafana after installing the plugin.
1. Check that you have the required permissions to access the application.

### Services or profiles not appearing in Profiles Drilldown

**Symptoms:**

- Profiles Drilldown shows no services
- Expected applications are missing

**Solutions:**

1. Verify the Pyroscope data source is configured and working.
1. Check that profiles are being ingested with the correct `service_name` label.
1. Ensure the time range includes periods when profiles were collected.
1. For microservices mode, verify the data source URL points to the correct gateway.

## Trace to profiles issues

These errors occur when linking tracing and profiling data.

Trace to profiles is the most configuration-sensitive feature of the data source. Most issues come from an unmet prerequisite rather than a data source misconfiguration.

**Prerequisites checklist:**

Confirm all of the following before troubleshooting further:

1. Your application is instrumented with a Pyroscope language SDK for profiling and with OpenTelemetry for tracing.
1. You installed the OpenTelemetry span-profiling bridge package for your language. This is a separate package from the Pyroscope SDK and the OpenTelemetry SDK.
1. Profiling uses SDK-based instrumentation. Span profiles aren't available with eBPF-based collection.
1. The Tempo data source has Trace to profiles configured and points to your Pyroscope data source.
1. The tags configured in the Tempo data source are present on the span's attributes or resources.

For per-language setup instructions, refer to [Link traces to profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/).

### Span profiles not appearing

**Symptoms:**

- Trace spans don't show profile links
- "Profiles for this span" option is missing

**Solutions:**

1. Verify the Tempo data source is configured with Trace to profiles enabled and that it points to your Pyroscope data source.
1. Confirm the `pyroscope.profile.id` attribute exists on the span in Tempo. If it's missing, the bridge package isn't tagging spans correctly.
1. Confirm the `span_name` label exists on the profiling data in Pyroscope. If it's missing, the bridge package isn't labeling samples correctly.
1. Verify that the tags you configured in the Tempo data source match the span's attributes or resources. If they don't match, the link doesn't appear.
1. Verify profile data exists for the time range of the trace.

For more information, refer to [Configure Trace to profiles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/configure-traces-to-profiles/).

### Span profiles aren't available with eBPF-based collection

**Symptoms:**

- Traces and profiles both exist, but no span links appear.
- Profiling is collected with eBPF, for example through Grafana Alloy or Beyla.

**Cause:**

Span profiling correlates profiling samples with the active trace span, which requires a language SDK and the OpenTelemetry span-profiling bridge. eBPF-based collection can't associate samples with individual spans, so it doesn't produce span profiles.

**Solutions:**

1. Instrument the application with a supported Pyroscope language SDK and the matching bridge package to enable span profiles.
1. If you must use eBPF profiling, view profiles by service instead. Per-span correlation isn't currently supported for eBPF-collected data.

### Filter span profiles by span name or trace ID, not span ID

**Symptoms:**

- Queries filtered by `span_id` return no data, while `span_name` works.
- Correlating profiles to a specific span by `span_id` is unreliable.

**Cause:**

The span-profiling bridge labels profiling samples with `span_name` and `trace_id`. Depending on the SDK, profiling context may be attached only to the root span of a trace, with child spans inheriting it. `span_id` is high cardinality and isn't a dependable correlation label.

**Solutions:**

1. Filter profiling data by `span_name` or `trace_id` rather than `span_id`.
1. Use the **Profiles for this span** link, which correlates using the `pyroscope.profile.id` span attribute rather than a label query.

### .NET profiler conflict with OpenTelemetry auto-instrumentation

**Symptoms:**

- On .NET, span profiles don't work when the Pyroscope .NET profiler and OpenTelemetry auto-instrumentation are both enabled.
- One profiler fails to attach.

**Cause:**

The .NET CLR allows only one profiler to attach to a process at a time. The Pyroscope .NET profiler and OpenTelemetry auto-instrumentation each rely on a separate CLR profiler, so they conflict.

**Solutions:**

1. Use OpenTelemetry manual instrumentation instead of auto-instrumentation.
1. Add the `Pyroscope.OpenTelemetry` package and register the `PyroscopeSpanProcessor` in your tracing pipeline.
1. For setup instructions, refer to [Span profiles with Traces to profiles for .NET](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/dotnet-span-profiles/).

### Correlate logs with profiles

**Symptoms:**

- You want to navigate from a log line directly to profiling data, but no link exists.

**Cause:**

Grafana supports Trace to profiles, but there's no direct logs-to-profiles correlation.

**Solutions:**

1. Correlate through shared labels, such as `service_name`, to move between logs and profiles for the same service and time range.
1. If your logs contain a `trace_id`, use a Loki derived field to open the trace, then use **Profiles for this span** from the trace to reach the profiling data.

### Profile doesn't match the trace span

**Symptoms:**

- Profile data doesn't correlate with the trace
- Wrong time range in profile

**Solutions:**

1. Verify the trace and profile timestamps are synchronized.
1. Check that the application's clock is accurate.
1. Ensure the `span_id` and `trace_id` labels are correctly propagated to profiles.

## Performance issues

These issues relate to slow queries or high resource usage.

### Slow queries or timeouts

**Symptoms:**

- Queries take a long time to complete
- Requests time out before returning results
- Dashboard panels fail to load

**Solutions:**

1. Reduce the time range to decrease the amount of data processed.
1. Add label filters to narrow the query scope.
1. Increase the **Timeout** setting in the data source's **Additional settings**.
1. Adjust the **Minimal step** setting to reduce the number of data points.
1. For large deployments, ensure the Pyroscope backend has sufficient resources.

### High memory usage in browser

**Symptoms:**

- Browser becomes unresponsive when viewing profiles
- Memory warnings appear
- Page crashes when loading flame graphs

**Solutions:**

1. Reduce the time range to load smaller profiles.
1. Close unnecessary browser tabs to free up memory.
1. Use a smaller aggregation window for very large profiles.
1. Consider using Profiles Drilldown for large-scale analysis.

## Network and connectivity errors

These errors indicate problems with network connectivity between Grafana and Pyroscope.

### "Connection refused" or timeout errors

**Symptoms:**

- Data source test fails with network errors
- Queries fail with connection errors
- Intermittent connectivity issues

**Solutions:**

1. Verify network connectivity from the Grafana server to the Pyroscope endpoint.
1. Check firewall rules allow outbound connections on the required port (default: 4040).
1. For Kubernetes deployments, verify the service is exposed correctly.
1. For Grafana Cloud connecting to private resources, configure [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).
1. Check if a proxy is required and configure it in the data source settings.

### SSL/TLS certificate errors

**Symptoms:**

- Certificate validation failures
- SSL handshake errors
- "Certificate not trusted" messages

**Solutions:**

1. Ensure the system time is correct on the Grafana server.
1. Verify the certificate is valid and not expired.
1. For self-signed certificates, enable **Skip TLS Verify** in the data source settings (not recommended for production).
1. Add the CA certificate to the Grafana server's trusted certificates.
1. Check that intermediate certificates are included in the certificate chain.

## Grafana Cloud-specific issues

These issues are most commonly reported in Grafana Cloud Profiles. Some limits also apply to self-managed Pyroscope deployments, where you can adjust them directly in the Pyroscope configuration.

### Query time range and retention limits

**Symptoms:**

- A query over a long time range, such as 30 days, returns data only for the most recent days.
- Older profiles appear to be missing even though the retention period hasn't elapsed.
- Users interpret the missing data as data loss or a bug.

**Cause:**

Pyroscope enforces query limits on the server side that are separate from, and often shorter than, the data retention period. These limits are enforced by the Pyroscope query frontend, not by the Grafana data source, so the data source can't change or override them.

| Limit                        | Default | Description                                                                                                                                                                                             |
| ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `querier.max-query-lookback` | `7d`    | How far back from the current time a query can read. Requests for data older than this window don't fail. Instead, the range is silently truncated to the allowed window, which looks like missing data. |
| `querier.max-query-length`   | `24h`   | The maximum time span of a single query. Requests that exceed this span are rejected.                                                                                                                  |

Because retention is typically longer than the query window, profiles can be retained but not queryable. For example, Grafana Cloud Profiles retains data for 14 days on free plans and 30 days on paid plans, while the default query window is 7 days.

{{< admonition type="note" >}}
The default values shown are the Pyroscope OSS defaults. Grafana Cloud and self-managed deployments may configure different values.
{{< /admonition >}}

**Solutions:**

1. Confirm this is a limit rather than a gap in ingestion by narrowing the time range to the most recent period and verifying that data appears.
1. To query further back than the query window, raise the limit rather than splitting the query into smaller ranges. Because the window is measured from the current time, splitting a long range into 7-day increments doesn't return older data.
1. For self-managed deployments, increase `querier.max-query-lookback` and, if needed, `querier.max-query-length` in the Pyroscope limits configuration. Set a value to `0` to disable that limit.
1. For Grafana Cloud Profiles, contact Grafana Support to adjust these limits for your tenant.
1. If a single query exceeds `querier.max-query-length`, reduce the query's time span so it stays within the configured limit.

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for Pyroscope-specific entries that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions in this guide and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Pyroscope GitHub issues](https://github.com/grafana/pyroscope/issues) for known bugs.
1. Refer to [Pyroscope documentation](https://grafana.com/docs/pyroscope/latest/) for additional guidance.
1. Contact [Grafana Support](https://grafana.com/contact/) if you're an Enterprise, Cloud Pro, or Cloud Contracted user.
1. When reporting issues, include:
   - Grafana version
   - Pyroscope version (if self-managed)
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Data source configuration (redact credentials)
