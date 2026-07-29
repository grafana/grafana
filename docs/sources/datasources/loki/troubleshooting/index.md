---
aliases:
  - ../../data-sources/loki/troubleshooting/
description: Troubleshooting guide for the Loki data source in Grafana
keywords:
  - grafana
  - loki
  - logging
  - troubleshooting
  - errors
  - query
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Loki data source issues
weight: 600
review_date: 2026-07-29
---

# Troubleshoot Loki data source issues

This document provides solutions to common issues you might encounter when configuring or using the Loki data source. For configuration instructions, refer to [Configure the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/).

## Connection errors

These errors occur when Grafana can't reach your Loki server.

### Save & test fails

**Symptoms:**

- The data source test fails or times out.
- Queries fail with network errors.

**Possible causes and solutions:**

| Cause                     | Solution                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Incorrect URL or port     | Verify the **URL** setting. Loki listens on port `3100` by default, for example `http://localhost:3100`.                         |
| Network or firewall block | Confirm the Grafana server can reach the Loki server, and that firewall rules allow the connection.                              |
| Authentication failure    | Verify the credentials, tokens, or TLS certificates in the data source configuration.                                            |
| TLS verification failure  | If Loki uses a self-signed certificate, add the CA certificate with **With CA cert**, or enable **Skip TLS verify** for testing. |

For Grafana Cloud users accessing a Loki server in a private network, configure [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

## Query errors

These errors occur when running queries against Loki.

### No data or empty results

**Symptoms:**

- A query runs without error but returns no data.
- Panels show a "No data" message.

**Possible causes and solutions:**

| Cause                             | Solution                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| Time range doesn't contain logs   | Expand the dashboard time range or confirm logs exist in Loki for that period.            |
| Label selector matches no streams | Verify your stream selector labels and values with the label browser in the query editor. |
| Logs exceed retention             | Confirm the logs you expect are within Loki's configured retention period.                |

### Query timeout or "too many outstanding requests"

**Symptoms:**

- A query runs for a long time and then fails.
- Errors mention timeouts, query limits, or too many outstanding requests.

**Solutions:**

1. Narrow the time range to reduce the volume of data scanned.
1. Add label filters or a line filter to reduce the result set.
1. Lower the **Maximum lines** setting on the data source or the line limit on the query.
1. Review the query and rate limits configured on your Loki deployment.

### "maximum of series reached for a single query"

**Symptoms:**

- A metric query fails with an error about the maximum number of series.

**Solutions:**

1. Add label matchers to reduce the number of streams the query touches.
1. Aggregate with `sum by (...)` to reduce cardinality.
1. Avoid high-cardinality labels in aggregations.

## Template variable errors

These errors occur when using template variables with the data source.

### Variables return no values

**Solutions:**

1. Confirm the data source connection works by running **Save & test**.
1. Verify the label or stream selector in the variable query returns values in the query editor.
1. For cascading variables, confirm parent variables have valid selections.

## Live tailing issues

These issues affect real-time log tailing in Explore.

### Live tailing doesn't stream logs

Live tailing relies on WebSocket connections between the browser and Grafana, and between Grafana and Loki. Reverse proxies often block these connections.

**Solutions:**

1. Confirm your reverse proxy forwards WebSocket connections for the tail endpoint. Refer to the proxy examples in the [Loki query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/query-editor/#tail-live-logs).
1. Verify that intermediate load balancers and firewalls allow WebSocket upgrades.
1. Confirm Loki itself is reachable and that the tail endpoint isn't blocked.

## Performance issues

These issues relate to slow queries or rate limits.

### Queries are slow or get rate limited

**Solutions:**

1. Narrow the time range and add label filters so queries scan less data.
1. Enable query caching, available in Grafana Enterprise and Grafana Cloud.
1. Review the query, ingestion, and rate limits on your Loki deployment.

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log`, or in your configured log location.
1. Look for Loki-specific entries that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried these solutions and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Loki data source GitHub issues](https://github.com/grafana/grafana-loki-datasource/issues) for known bugs.
1. Consult the [Loki documentation](https://grafana.com/docs/loki/latest/) for service-specific guidance.
1. When reporting issues, include:
   - Grafana and Loki versions
   - Error messages, with sensitive information redacted
   - Steps to reproduce
   - Relevant configuration, with credentials redacted
