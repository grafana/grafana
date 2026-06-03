---
description: Troubleshooting guide for the Jaeger data source in Grafana
keywords:
  - grafana
  - jaeger
  - troubleshooting
  - errors
  - connection
  - authentication
  - query
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Jaeger data source issues
weight: 500
review_date: 2026-03-03
---

# Troubleshoot Jaeger data source issues

This document provides solutions to common issues you may encounter when configuring or using the Jaeger data source. For configuration instructions, refer to [Configure the Jaeger data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/configure/).

## Connection errors

These errors occur when Grafana can't reach the Jaeger instance.

### "Connection refused" or timeout errors

**Symptoms:**

- **Save & test** fails with a connection error
- Queries fail with network errors
- Service and operation drop-downs don't load

**Possible causes and solutions:**

| Cause                    | Solution                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jaeger isn't running     | Verify Jaeger is running and accessible at the configured URL.                                                                                                                                |
| Incorrect URL            | Check the **URL** setting in the data source configuration. The default Jaeger query endpoint is `http://localhost:16686`.                                                                    |
| Firewall blocking access | Ensure firewall rules allow traffic from the Grafana server to the Jaeger endpoint.                                                                                                           |
| Network segmentation     | For Grafana Cloud accessing private Jaeger instances, configure [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/). |

### "request failed: 404 Not Found"

**Symptoms:**

- **Save & test** returns a 404 error
- Queries fail with "request failed" messages

**Solutions:**

1. Verify the Jaeger URL doesn't include a trailing path such as `/api`. The correct URL is the base endpoint, for example `http://localhost:16686`.
1. Confirm the Jaeger query service is running and listening on the expected port.
1. If using a reverse proxy, verify the proxy forwards requests to the correct Jaeger endpoint.

### TLS errors

**Symptoms:**

- Certificate validation errors during **Save & test**
- Errors mentioning `x509` or certificate verification

**Solutions:**

1. Verify your TLS certificates are valid and not expired.
1. Ensure the CA certificate is configured in the data source **Additional settings** if using a private CA.
1. For testing, you can temporarily toggle on **Skip TLS verify** in the data source settings. Don't use this in production.
1. Verify the **Server name** setting matches the certificate's Common Name or Subject Alternative Name.

### Timeout errors

**Symptoms:**

- Queries take a long time then fail
- Errors mention timeout

**Solutions:**

1. Increase the timeout value in **Additional settings** > **Timeout**.
1. Verify network latency between Grafana and Jaeger is acceptable.
1. Check that the Jaeger query service isn't overloaded.

## Authentication errors

These errors occur when credentials are invalid or missing.

### "401 Unauthorized" or "403 Forbidden"

**Symptoms:**

- **Save & test** fails with authorization errors
- Queries return access denied messages
- Services and operations don't load in drop-downs

**Possible causes and solutions:**

| Cause                    | Solution                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Invalid credentials      | Verify the **User** and **Password** values in the data source configuration.                    |
| Missing authentication   | If Jaeger requires authentication, toggle on the appropriate auth method.                        |
| Incorrect custom headers | Verify custom header names and values in **Additional settings**.                                |
| OAuth forwarding issues  | If using **Forward OAuth identity**, verify the upstream OAuth provider is configured correctly. |

## Query errors

These errors occur when executing queries against Jaeger.

### "traceID is empty"

**Symptoms:**

- The query fails with "traceID is empty" when using the TraceID query type

**Solutions:**

1. Enter a valid trace ID in the **Trace ID** field.
1. Verify the trace ID is a valid hexadecimal string.
1. If using a template variable, verify the variable resolves to a non-empty value.

### No data in search results

**Symptoms:**

- Search query returns no traces
- The trace list is empty

**Possible causes and solutions:**

| Cause                              | Solution                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Time range doesn't contain data    | Expand the dashboard or Explore time range. Verify traces exist in Jaeger for the selected period.             |
| Service or operation doesn't exist | Verify the selected service and operation names match what's in Jaeger.                                        |
| Tags syntax error                  | Ensure tags use [`logfmt`](https://brandur.org/logfmt) format: `error=true db.statement="select * from User"`. |
| Duration format error              | Use supported duration formats: `1.2s`, `100ms`, `500us`.                                                      |
| Limit set too low                  | Increase the **Limit** value or leave it empty for the default.                                                |

### "The JSON file uploaded is not in a valid Jaeger format"

**Symptoms:**

- Importing a trace file fails with a format error

**Solutions:**

1. Verify the JSON file follows the Jaeger trace format with a `data` array at the root level.
1. Ensure the file contains at least one trace object in the `data` array.
1. Validate the JSON syntax using a JSON linter.

Expected format:

```json
{
  "data": [
    {
      "traceID": "<TRACE_ID>",
      "spans": [...],
      "processes": {...}
    }
  ]
}
```

## Dependency graph errors

These errors relate to the dependency graph query type.

### Empty dependency graph

**Symptoms:**

- The dependency graph query returns no nodes or edges
- The Node Graph panel is empty

**Possible causes and solutions:**

| Cause                  | Solution                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No dependency data     | Verify Jaeger is collecting and processing service dependency information.                                                                                             |
| Time range too narrow  | Expand the dashboard time range. Dependencies are calculated over the selected period.                                                                                 |
| Jaeger storage backend | Some Jaeger storage backends may not support dependency queries. Refer to the [Jaeger documentation](https://www.jaegertracing.io/docs/) for storage-specific details. |

## gRPC endpoint errors

These errors occur when using the gRPC query endpoint.

### gRPC queries fail

**Symptoms:**

- Queries don't use the gRPC endpoint
- Search, service, and operation queries still use the REST API

**Solutions:**

1. Verify the `jaegerEnableGrpcEndpoint` feature flag is enabled in Grafana. This feature is in public preview.
1. Grafana Cloud customers should contact support to request access.
1. Note that search and dependency graph queries currently use the REST endpoint even when the feature flag is enabled. Only service search, operation search, and trace ID queries use gRPC.

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Reproduce the issue.
1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for Jaeger-specific entries that include request URLs, response status codes, and error details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions in this document and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs related to the Jaeger data source.
1. Refer to the [Jaeger documentation](https://www.jaegertracing.io/docs/) for service-specific guidance.
1. Contact Grafana Support if you're an Enterprise, Cloud Pro, or Cloud Advanced user.
1. When reporting issues, include:
   - Grafana version
   - Jaeger version
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant data source configuration (redact credentials)
