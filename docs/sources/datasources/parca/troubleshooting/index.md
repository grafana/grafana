---
description: Troubleshooting guide for the Parca data source in Grafana.
keywords:
  - grafana
  - parca
  - troubleshooting
  - errors
  - profiling
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Parca data source issues
weight: 500
review_date: 2026-04-10
---

# Troubleshoot Parca data source issues

This page provides solutions to common issues you might encounter when configuring or using the Parca data source. For configuration instructions, refer to [Configure the Parca data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/configure/).

## Connection errors

These errors occur when Grafana can't reach the Parca instance.

### "Save & test" fails

**Symptoms:**

- Data source test times out or returns an error.
- Unable to connect to the Parca server.

**Possible causes and solutions:**

| Cause                | Solution                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Incorrect URL        | Verify the URL points to your Parca HTTP endpoint (for example, `http://localhost:7070`). Grafana connects using gRPC-Web. |
| Parca isn't running  | Verify that your Parca instance is running and accessible from the Grafana server.                                         |
| Firewall blocking    | Check that firewall rules allow outbound traffic from Grafana to the Parca server on the configured port.                  |
| TLS misconfiguration | If using HTTPS, verify that TLS certificates are correctly configured on both Grafana and Parca.                           |

### Connection refused or timeout errors

**Symptoms:**

- Queries fail with network errors.
- Intermittent connection issues.

**Solutions:**

1. Verify network connectivity from the Grafana server to the Parca endpoint.
1. Check that the Parca server is healthy and responding to requests.
1. For Grafana Cloud, configure [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if accessing a private Parca instance.

## Query errors

These errors occur when running queries against the Parca data source.

### "Invalid report type"

**Symptoms:**

- Queries fail with an "invalid report type" error message.
- Flame graph data doesn't load.

**Solutions:**

1. Upgrade your Parca server to v0.19 or later. This error occurs because older versions of Parca don't support the flame graph Arrow format that Grafana requires.

### "No data" or empty results

**Symptoms:**

- Query runs without error but returns no data.
- Flame graph or metrics panel shows "No data."

**Possible causes and solutions:**

| Cause                           | Solution                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| No profile type selected        | Select a profile type from the drop-down menu. This field is required for queries to run.       |
| Time range doesn't contain data | Expand the dashboard time range or verify that profiling data exists for the selected period.    |
| Label selector too restrictive  | Remove or broaden label filters to verify that matching profiles exist.                         |
| Parca isn't scraping targets    | Check your Parca configuration to verify that targets are being scraped and profiles collected.  |

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for Parca-specific entries that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions on this page and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs related to the Parca data source.
1. Consult the [Parca documentation](https://www.parca.dev/docs) for service-specific guidance.
1. Contact Grafana Support if you're an Enterprise, Cloud Pro, or Cloud Contracted user.
1. When reporting issues, include:
   - Grafana version
   - Parca server version
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration (redact credentials)
