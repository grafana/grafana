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
refs:
  configure-pyroscope:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/configure-pyroscope-data-source/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/configure-pyroscope-data-source/
  query-profile-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/query-profile-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/query-profile-data/
  explore-profiles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/profiles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/simplified-exploration/profiles/
  configure-traces-to-profiles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/configure-traces-to-profiles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/configure-traces-to-profiles/
  flame-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/flame-graph/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
---

# Troubleshoot Pyroscope data source issues

This document provides solutions to common issues you may encounter when configuring or using the Pyroscope data source. For configuration instructions, refer to [Configure the Grafana Pyroscope data source](ref:configure-pyroscope).

## Connection and configuration errors

These errors occur when setting up the data source or when connecting to the Pyroscope backend.

### "Data source is not working" or connection fails

**Symptoms:**

- Save & test fails with a connection error
- Error message indicates the Pyroscope backend is unreachable
- Timeout errors when testing the data source

**Possible causes and solutions:**

| Cause                              | Solution                                                                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incorrect URL                      | Verify the URL points to your Pyroscope instance. For self-managed deployments, the default port is `4040` (for example, `http://localhost:4040`).                                                |
| Pyroscope service not running      | Check that the Pyroscope backend is running and accessible. Use `curl` or a browser to test connectivity to the Pyroscope URL.                                                                    |
| Network connectivity issues        | Verify network connectivity from the Grafana server to the Pyroscope endpoint. Check firewall rules allow outbound connections on the required port.                                              |
| Microservices mode routing         | If running Pyroscope in microservices mode, ensure the URL points to a gateway or proxy that routes requests correctly. Refer to the Helm ingress configuration for routing requirements.         |
| TLS/SSL certificate issues         | If using HTTPS, verify the certificate is valid and trusted by the Grafana server. Configure TLS settings in the data source if using self-signed certificates.                                   |

### URL format issues

**Symptoms:**

- Data source test fails immediately
- Error indicates invalid URL

**Solutions:**

1. Ensure the URL includes the protocol (`http://` or `https://`).
1. Remove any trailing slashes from the URL.
1. For Grafana Cloud Profiles, find the correct URL under **Manage your stack** in your organization settings.
1. Verify the port number is correct for your deployment.

## Authentication errors

These errors occur when the data source cannot authenticate with the Pyroscope backend.

### "Authentication failed" or "Unauthorized"

**Symptoms:**

- Save & test fails with authentication errors
- Queries return 401 or 403 status codes
- Profile types don't load

**Possible causes and solutions:**

| Cause                               | Solution                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid credentials                 | Verify the username and password or API key are correct.                                                                                           |
| Expired credentials                 | Generate new credentials and update the data source configuration.                                                                                 |
| Incorrect authentication type       | Ensure you've selected the correct authentication method for your Pyroscope deployment (Basic auth, API key, or no authentication for local setups). |
| Missing authentication headers      | For custom authentication, verify the required headers are configured correctly in the data source settings.                                       |

### Basic authentication not working

**Symptoms:**

- Basic auth credentials are rejected
- Works in browser but fails in Grafana

**Solutions:**

1. Verify Basic authentication is enabled in the data source settings.
1. Ensure the username and password are entered correctly (no extra spaces).
1. Check that the Pyroscope backend is configured to accept Basic authentication.
1. For Grafana Cloud Profiles, use the API key authentication method instead.

### API key authentication issues

**Symptoms:**

- API key is rejected
- Error indicates invalid token

**Solutions:**

1. Verify you're using the correct API key format for your Pyroscope deployment.
1. For Grafana Cloud, generate a new API key from the Grafana Cloud portal.
1. Ensure the API key has the required permissions to read profiling data.
1. Check if the API key has expired and generate a new one if necessary.

## Query errors

These errors occur when executing queries against the Pyroscope data source.

### "No data" or empty results

**Symptoms:**

- Query executes without error but returns no data
- Flame graph shows "No data" message
- Metrics graph is empty

**Possible causes and solutions:**

| Cause                                 | Solution                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time range doesn't contain data       | Expand the dashboard time range. Profiling data may not exist for the selected period.                                                             |
| Application not sending profiles      | Verify your application is configured to send profiles to Pyroscope. Check the Pyroscope agent or SDK configuration.                              |
| Incorrect profile type selected       | Select a different profile type from the drop-down menu. Not all profile types are available for all applications.                                 |
| Label selector too restrictive        | Remove or modify label filters to broaden the query. Start without filters to verify data exists.                                                  |
| Wrong service or application selected | Verify the `service_name` label matches your application's configuration.                                                                          |
| Profile type or app not selected      | Ensure you've selected a profile type or app in the query editor. The query returns no data if neither is selected.                               |

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
1. Escape special characters in regex patterns when using `=~` or `!~`.

Example valid queries:

```promql
{service_name="my-app"}
{service_name="my-app", env="production"}
{service_name=~"my-app.*"}
```

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

These errors are specific to the [Profiles Drilldown](ref:explore-profiles) application.

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

## Traces to profiles issues

These errors occur when linking tracing and profiling data.

### Span profiles not appearing

**Symptoms:**

- Trace spans don't show profile links
- "Profiles for this span" option is missing

**Solutions:**

1. Verify the Tempo data source is configured with Traces to profiles enabled.
1. Ensure your application is instrumented to emit span profiles.
1. Check that the Pyroscope data source is selected in the Tempo data source configuration.
1. Verify profile data exists for the time range of the trace.

For more information, refer to [Configure Traces to profiles](ref:configure-traces-to-profiles).

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
1. Adjust the **Minimum step** setting to reduce the number of data points.
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
1. For Grafana Cloud connecting to private resources, configure [Private data source connect](ref:private-data-source-connect).
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
1. Consult the [Pyroscope documentation](https://grafana.com/docs/pyroscope/latest/) for additional guidance.
1. Contact [Grafana Support](https://grafana.com/contact/) if you're an Enterprise, Cloud Pro, or Cloud Contracted user.
1. When reporting issues, include:
   - Grafana version
   - Pyroscope version (if self-managed)
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Data source configuration (redact credentials)
