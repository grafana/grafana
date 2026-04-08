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

This document provides solutions to common issues you may encounter when configuring or using the Zipkin data source. For configuration instructions, refer to [Configure Zipkin](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/configure/).

## Connection errors

These errors occur when Grafana can't reach the Zipkin instance.

### Save & test fails or times out

**Symptoms:**

- **Save & test** doesn't return "Data source is working"
- Connection timeout errors
- "Bad Gateway" or "Bad Request" errors

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Incorrect URL | Verify the URL points to your Zipkin instance. The default port is `9411` (for example, `http://localhost:9411`). |
| Zipkin instance is down | Confirm the Zipkin instance is running and accessible from the Grafana server. |
| Firewall or network rules | Ensure the Grafana server can reach the Zipkin instance over the network. Check firewall rules allow outbound traffic on the configured port. |
| TLS/SSL misconfiguration | If using HTTPS, verify the TLS certificate is valid and trusted by the Grafana server. Configure TLS settings in the **Advanced HTTP settings** section. |
| Incorrect authentication | If basic auth is enabled, verify the username and password are correct. |

For Grafana Cloud, if you're accessing a private Zipkin instance, configure [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

## Query errors

These errors occur when executing queries against the Zipkin data source.

### "No data" or empty results

**Symptoms:**

- Query runs without error but returns no data
- Trace view shows "No data"

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Invalid trace ID | Verify the trace ID is correct. Zipkin trace IDs are 16 or 32 character hex strings. |
| Time range doesn't contain data | Expand the dashboard time range. The trace must fall within the selected time range. |
| Trace has expired | Zipkin may have purged old trace data based on its retention settings. Check your Zipkin storage configuration. |

### "Failed to load spans from Zipkin"

**Symptoms:**

- Error message appears in the query editor
- The **Traces** cascading selector doesn't populate services or spans

**Solutions:**

1. Verify the Zipkin instance is running and accessible.
1. Check that the Zipkin `/api/v2/services` endpoint returns data.
1. Ensure the Grafana server can reach the Zipkin API.
1. Review the Grafana server logs for additional error details.

### "JSON is not valid Zipkin format"

**Symptoms:**

- Error appears after uploading a JSON trace file
- The trace doesn't render

**Solutions:**

1. Verify the JSON file uses the [Zipkin v2 span format](https://zipkin.io/zipkin-api/#/). The file must be a JSON array of span objects.
1. Validate the JSON syntax using a JSON linter.
1. Ensure required fields are present: `traceId`, `id`, `name`, `timestamp`, and `duration`.

## Trace to logs issues

These issues relate to the trace to logs integration.

### Trace to logs links don't appear

**Symptoms:**

- No log links appear in the trace view
- Links appear for some spans but not others

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Tags not present in span | The tags configured in trace to logs settings must exist in the span attributes for the link to appear. Verify the span contains the expected tags. |
| Logs data source not configured | Ensure the target logs data source (Loki, Elasticsearch, etc.) is configured and working. |
| Custom query variables not resolved | If using a custom query, the link only appears when all variables resolve to non-empty values. Verify the span contains the referenced tags. |

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for Zipkin-specific entries that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried these solutions and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Consult the [Zipkin documentation](https://zipkin.io/) for service-specific guidance.
1. Contact Grafana Support if you're a Cloud Pro, Cloud Advanced, or Enterprise user.
1. When reporting issues, include:
   - Grafana version
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration (redact credentials)
