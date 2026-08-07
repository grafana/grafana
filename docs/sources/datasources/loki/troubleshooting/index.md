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

{{< admonition type="note" >}}
This guide covers the Loki data source in Grafana, such as connecting to Loki, running queries, and configuring features. It doesn't cover troubleshooting the Loki service itself. For help with a Loki deployment, including ingestion and query performance, refer to [Manage and debug errors](https://grafana.com/docs/loki/latest/operations/troubleshooting/) in the Loki documentation.
{{< /admonition >}}

## Connection errors

These errors occur when Grafana can't reach your Loki server.

### Save & test fails

**Symptoms:**

- The data source test fails or times out.
- Queries fail with network errors.

**Possible causes and solutions:**

| Cause                          | Solution                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incorrect URL or port          | Verify the **URL** setting. Loki listens on port `3100` by default, for example `http://localhost:3100`.                                                                                                                                |
| API path in the URL            | Enter only the base Loki URL. Don't append API paths such as `/loki/api/v1/push`, which sends logs to Loki rather than querying it.                                                                                                     |
| Localhost URL on Grafana Cloud | On Grafana Cloud, a `localhost` or private address points to Grafana's servers, not your network. Use [PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) to reach a self-hosted Loki. |
| Missing tenant header          | For a multi-tenant Loki, one with `auth_enabled: true`, add the `X-Scope-OrgID` custom HTTP header with your tenant ID.                                                                                                                 |
| Network or firewall block      | Confirm the Grafana server can reach the Loki server, and that firewall rules allow the connection.                                                                                                                                     |
| Authentication failure         | Verify the credentials, tokens, or TLS certificates in the data source configuration. For Grafana Cloud Loki, confirm the access policy token includes the `logs:read` scope.                                                           |
| TLS verification failure       | If Loki uses a self-signed certificate, add the CA certificate with **With CA cert**, or enable **Skip TLS verify** for testing.                                                                                                        |

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

## Performance issues

These issues relate to slow queries or rate limits.

### Queries are slow or get rate limited

**Solutions:**

1. Narrow the time range and add label filters so queries scan less data.
1. Enable query caching, available in Grafana Enterprise and Grafana Cloud.
1. Review the query, ingestion, and rate limits on your Loki deployment.

## Template variable errors

These errors occur when using template variables with the data source.

### Variables return no values

**Solutions:**

1. Confirm the data source connection works by running **Save & test**.
1. Verify the label or stream selector in the variable query returns values in the query editor.
1. For cascading variables, confirm parent variables have valid selections.

## Derived field and log-to-trace link issues

These issues affect [derived fields](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/#derived-fields), including the links from logs to traces.

### The derived field or trace link doesn't appear

- Confirm the regular expression matches your log line format. A pattern that doesn't match produces no value and no link. Use **Show example log message** in the data source configuration to test the pattern against a real log line.
- For a **Label** type derived field, confirm a label key matches the pattern. The match runs against label keys, not values.
- Check that the field value is captured. For a **Regex in log line** type, Grafana uses the first capture group, so the expression must include one.

### The trace link opens but shows no trace

- The derived field only builds a link to the target data source using the extracted value; it doesn't create the trace. Confirm the trace is ingested into the target data source, such as Tempo, and that the extracted ID matches the trace ID stored there.
- Verify the extracted value is the correct ID. An overly permissive regular expression can capture the wrong part of the log line. Anchor the pattern and make it specific, for example match `traceID=(\w+)` rather than a broad `(\w+)`.

### Can't edit derived fields on a provisioned data source

Data sources created through provisioning are read-only in the UI, so you can't change their derived fields from the data source configuration page.

- For self-managed Grafana, edit the derived field configuration in the provisioning YAML file and restart Grafana, or reload provisioning.
- For Grafana Cloud, open a support ticket from the Grafana Cloud Portal to request changes to a provisioned data source.

### A single link needs values from more than one field

A derived field produces a single value per log line, so you can't combine multiple labels or capture groups into one field or link. Create a separate derived field for each value you need to surface.

## Live tailing issues

These issues affect real-time log tailing in Explore.

### Live tailing doesn't stream logs

Live tailing relies on WebSocket connections between the browser and Grafana, and between Grafana and Loki. Reverse proxies often block these connections.

**Solutions:**

1. Confirm your reverse proxy forwards WebSocket connections for the tail endpoint. Refer to the proxy examples in the [Loki query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/query-editor/#tail-live-logs).
1. Verify that intermediate load balancers and firewalls allow WebSocket upgrades.
1. Confirm Loki itself is reachable and that the tail endpoint isn't blocked.

## Label-based access control (LBAC) issues

Label-based access control (LBAC) filters the logs a team can query based on labels. It's available on Grafana Cloud and Grafana Enterprise, where it requires Grafana Enterprise Logs (GEL). If you can't enable LBAC, or teams see more logs than expected, check the following.

### Can't enable LBAC on a provisioned data source

{{< admonition type="note" >}}
You can't enable LBAC on a provisioned or auto-provisioned Loki data source. Provisioning of LBAC data sources isn't supported.
{{< /admonition >}}

To use LBAC, create a new Loki data source manually and configure it with basic authentication, using your Cloud Access Policy (CAP) token as the password. Point it at the same Loki endpoint as the provisioned data source, then define LBAC rules on the new data source's **Permissions** tab. For the full procedure, refer to [Configure LBAC for data sources for Loki](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-loki/).

### Teams can still query all logs

- LBAC applies only when a team has at least one rule. If a team has no LBAC rules, its members can query all logs. Confirm each team has the rules you intend.
- Grafana permissions are additive. A user's basic role, such as Viewer, can grant access to the data source independently of team-scoped rules. Remove role and team permissions that aren't required so that only the intended teams have **Query** permission on the LBAC data source.
- Remove any label selectors from the Cloud Access Policy used by the data source. CAP label selectors override LBAC rules.

For details and limitations, refer to [LBAC for data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/).

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
