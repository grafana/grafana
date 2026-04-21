---
description: Troubleshooting guide for the Zipkin data source in Grafana
keywords:
  - grafana
  - zipkin
  - tracing
  - troubleshooting
  - errors
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Zipkin data source issues
weight: 400
review_date: 2026-04-08
---

# Troubleshoot Zipkin data source issues

This document provides solutions to common issues you may encounter when configuring or using the Zipkin data source, including connection failures, query errors, JSON upload issues, and configuration problems. For configuration instructions, refer to [Configure Zipkin](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/configure/).

## Connection errors

These errors occur when Grafana can't connect to the Zipkin instance.

### `error reading settings: url is empty`

**Symptoms:**

- **Save & test** fails immediately
- Health check returns an error

**Solutions:**

1. Open the data source settings and verify the **URL** field isn't empty.
1. Enter the full URL of your Zipkin instance, such as `http://localhost:9411`.

### "request failed: 404 Not Found" or other HTTP status errors

**Symptoms:**

- **Save & test** fails with an HTTP status error
- Trace queries return errors

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Incorrect URL or port | Verify the URL and port. The default Zipkin port is `9411`. Ensure you haven't accidentally used the Jaeger port (`16686`). |
| Missing `/api/v2` path | The Zipkin data source calls `/api/v2/services`, `/api/v2/traces`, etc. Verify these endpoints are accessible at the configured URL. |
| Reverse proxy misconfiguration | If using a reverse proxy, ensure it correctly forwards requests to the Zipkin API. |
| Authentication failure | If the Zipkin instance requires authentication, verify your credentials are correct. |

### `error creating http client` or TLS errors

**Symptoms:**

- **Save & test** fails with a connection or TLS error
- HTTPS connections are refused

**Solutions:**

1. If using HTTPS, verify the TLS certificate is valid and trusted by the Grafana server.
1. Configure TLS settings in **Additional settings** > **Advanced HTTP settings**.
1. For self-signed certificates, add the CA certificate to the Grafana server trust store or toggle **Skip TLS Verify** (not recommended for production).

### Save & test times out

**Symptoms:**

- **Save & test** hangs and eventually times out
- No error message is returned

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Zipkin instance is down | Confirm the Zipkin instance is running and accessible from the Grafana server. |
| Firewall or network rules | Ensure the Grafana server can reach the Zipkin instance. Check that firewall rules allow outbound traffic on the configured port. |
| DNS resolution failure | Verify the hostname in the URL resolves correctly from the Grafana server. |

For Grafana Cloud, if you're accessing a private Zipkin instance, configure [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

## Query editor errors

These errors occur when using the query editor in Explore or dashboards.

### "Failed to load spans from Zipkin"

**Symptoms:**

- Error message appears in the query editor
- The **Traces** cascading selector doesn't populate services, spans, or traces

This error occurs when the frontend can't reach the Zipkin API endpoints (`/api/v2/services`, `/api/v2/spans`, or `/api/v2/traces`).

**Solutions:**

1. Verify the Zipkin instance is running and accessible.
1. Test the endpoint directly: `curl http://<ZIPKIN_URL>/api/v2/services`.
1. Check that the Grafana server can reach the Zipkin API.
1. Review the Grafana server logs for more details. Look for `An error occurred while doing a resource call` in the logs.

### "An error occurred within the plugin"

**Symptoms:**

- A generic error appears when querying or browsing traces
- No specific error details are shown in the UI

This is a generic error returned by the Zipkin plugin backend when an internal error occurs. The actual error details are only available in the Grafana server logs.

**Solutions:**

1. Enable [debug logging](#enable-debug-logging) to capture detailed error information.
1. Check the Grafana server logs for messages like `An error occurred while doing a resource call` or `An error occurred while processing response from resource call`.
1. Verify the Zipkin instance is healthy and responding to API requests.

### "No data" or empty results

**Symptoms:**

- Query runs without error but returns no data
- Trace view shows "No data"
- The cascading selector shows "No traces found" or "[No traces in time range]"

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Invalid trace ID | Verify the trace ID is correct. Zipkin trace IDs are 16 or 32 character hex strings. |
| Empty trace ID | Ensure the **Trace ID** field isn't empty. The backend rejects queries with `invalid/empty traceId`. |
| Time range doesn't contain data | Expand the dashboard or Explore time range. Traces must fall within the selected time range for the cascading selector to find them. |
| Trace has expired | Zipkin may have purged old trace data based on its retention settings. Check your Zipkin storage configuration. |
| No services registered | If the cascading selector shows "No traces found" at the top level, your Zipkin instance may have no data. Verify data is being collected. |

## Upload errors

These errors occur when importing a JSON trace file.

### "JSON is not valid Zipkin format"

**Symptoms:**

- Error appears after uploading a JSON trace file
- The trace doesn't render

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Invalid JSON syntax | Validate the file with a JSON linter. Common issues include trailing commas, missing quotes, or unclosed brackets. |
| Wrong JSON structure | The file must be a JSON array of span objects (`[{...}, {...}]`), not a single object. Refer to the [Zipkin v2 span format](https://zipkin.io/zipkin-api/#/). |
| Missing required fields | Each span must include `traceId`, `id`, `name`, `timestamp`, and `duration`. |
| Wrong file type | Ensure you're uploading a `.json` file, not a different format. |

### "unsupported query type upload"

**Symptoms:**

- Error when trying to use uploaded trace data in a dashboard panel or alert

Upload queries only work in **Explore**. They can't be used in dashboard panels or alerting rules because the upload is processed in the browser, not the backend.

**Solution:**

Use the **TraceID** query type with the trace ID from your uploaded trace if you need to display it in a dashboard. This requires the trace to exist in your Zipkin instance.

## Configuration errors

These errors relate to data source configuration settings.

### "Invalid time shift. See tooltip for examples."

**Symptoms:**

- Error appears in the trace to logs or trace to metrics configuration
- The **Span start time shift** or **Span end time shift** field is highlighted

**Solutions:**

1. Use valid time unit formats: `5s`, `1m`, `3h`, `-30m`.
1. Use a negative value to shift the time to the past (for example, `-1h`).
1. The value must be a number followed by a time unit (`s`, `m`, `h`).

### Trace to logs links don't appear

**Symptoms:**

- No log links appear in the trace view
- Links appear for some spans but not others

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Tags not present in span | The tags configured in trace to logs settings must exist in the span attributes for the link to appear. Verify the span contains the expected tags. |
| Logs data source not configured | Ensure the target logs data source (Loki, Elasticsearch, Splunk, OpenSearch, FalconLogScale, Google Cloud Logging, or VictoriaMetrics Logs) is configured and working. |
| Custom query variables not resolved | If using a custom query, the link only appears when all variables resolve to non-empty values. Verify the span contains the referenced tags. |
| Wrong data source type selected | The trace to logs data source must be a supported logs data source. Other data source types don't appear in the drop-down. |

### Trace to metrics links don't appear

**Symptoms:**

- No metrics links appear in the trace view

**Solutions:**

1. Verify the target metrics data source is configured and working.
1. Ensure linked queries are defined with valid query syntax.
1. Check that the `$__tags` keyword in queries maps to tags that exist in the span.

## Template variable errors

These errors relate to using template variables with the Zipkin data source.

### Variable value not substituted in query

**Symptoms:**

- The trace ID field shows the variable syntax (for example, `${traceId}`) instead of the actual value
- Query returns no results when using a variable

**Solutions:**

1. Verify the variable is defined in **Dashboard settings** > **Variables**.
1. Check the variable name matches the syntax used in the query. Variable names are case-sensitive.
1. Ensure the variable has a value selected or entered.
1. For text box variables, verify the viewer has entered a value.

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for Zipkin-specific entries that include request and response details, such as:
   - `Failed to close response body`
   - `An error occurred while doing a resource call`
   - `An error occurred while processing response from resource call`
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried these solutions and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Consult the [Zipkin documentation](https://zipkin.io/) for service-specific guidance.
1. Contact Grafana Support if you have a paid plan. [Open a support ticket](https://grafana.com/profile/org#support) for Grafana Cloud, or [contact support](https://grafana.com/contact/) for Grafana Enterprise.
1. When reporting issues, include:
   - Grafana version
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration (redact credentials)
