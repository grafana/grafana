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

When the connection succeeds, the health check displays **"Data source is working"**. The health check queries the available profile types from the Parca server, so any connectivity or authentication issue causes it to fail.

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

### "Invalid report type" or "try updating Parca to v0.19+"

**Symptoms:**

- Queries fail with an error containing "invalid report type."
- The error message suggests updating Parca to v0.19+.
- Flame graph data doesn't load.

**Solutions:**

1. Upgrade your Parca server to v0.19 or later. This error occurs because older versions of Parca don't support the flame graph Arrow format that Grafana requires.

### `Unknown report type returned from query. update parca`

**Symptoms:**

- Profile queries fail with this exact error message.
- Metric queries may still succeed.

**Solutions:**

1. Upgrade your Parca server. This error occurs when the Parca server returns a response format that Grafana doesn't recognize. Updating to the latest Parca version resolves the issue.

### "No data" or empty results

**Symptoms:**

- Query runs without error but returns no data.
- Flame graph or metrics panel shows "No data."

**Possible causes and solutions:**

| Cause                           | Solution                                                                                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No profile type selected        | Select a profile type from the drop-down menu. This field is required -- queries silently return empty data without it.                                                                                                                 |
| Time range doesn't contain data | Expand the dashboard time range or verify that profiling data exists for the selected period.                                                                                                                                           |
| Label selector too restrictive  | Remove or broaden label filters to verify that matching profiles exist.                                                                                                                                                                 |
| Label selector syntax error     | Verify the label selector uses valid syntax (for example, `{job="my-service"}`). Refer to the [query editor documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/query-editor/) for supported operators. |
| Parca isn't scraping targets    | Check your Parca configuration to verify that targets are being scraped and profiles collected.                                                                                                                                         |

## Query editor issues

These issues relate to the query editor interface.

### Profile type drop-down is empty

**Symptoms:**

- The profile type selector shows no options.
- The button text reads **Select a profile type** with nothing to choose.

**Possible causes and solutions:**

| Cause                      | Solution                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Connection to Parca failed | Verify the data source connection using **Save & test** in the data source settings.             |
| Parca has no scraped data  | Verify that Parca is scraping targets and has collected profile data.                            |
| Network or auth error      | Check the browser developer console for failed requests to the `profileTypes` resource endpoint. |

### "Both" query type is missing

**Symptoms:**

- Only **Metric** and **Profile** appear in the query type options.
- The **Both** option isn't available.

**Solution:**

This is expected behavior. The **Both** query type is only available in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/). Dashboard panels support only one visualization type, so Grafana limits the options to **Metric** or **Profile**. If a query set to **Both** in Explore is used in a dashboard, Grafana automatically changes it to **Profile**.

### Autocomplete suggestions don't appear

**Symptoms:**

- No label name or value suggestions appear when typing in the label selector.
- Autocomplete works for some labels but not others.

**Possible causes and solutions:**

| Cause                          | Solution                                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Label names haven't loaded     | Wait a moment after opening the query editor. Autocomplete loads label names from Parca on initialization.                                                            |
| Connection to Parca failed     | Verify the data source connection. Autocomplete queries the `labelNames` and `labelValues` resource endpoints.                                                        |
| Cursor position not recognized | Place your cursor inside curly braces `{}` and after an `=` sign for value suggestions. Autocomplete triggers on specific characters: `{`, `,`, `=`, `~`, `"`, space. |

## Template variable issues

These issues relate to using template variables with the Parca data source.

### Variables don't resolve in queries

**Symptoms:**

- Variable syntax like `$variable` appears literally in query results instead of being replaced.
- Queries return no data when using variables.

**Possible causes and solutions:**

| Cause                         | Solution                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Variable used in profile type | Template variables are only supported in the **label selector** field. The profile type drop-down doesn't support variable interpolation. |
| Variable not defined          | Verify the variable exists in **Dashboard settings** > **Variables** and has valid values.                                                |
| Wrong variable syntax         | Use `$variablename` or `${variablename}`. Verify there are no typos in the variable name.                                                 |

### Can't use Parca to populate variable options

**Symptoms:**

- When creating a query-type variable with the Parca data source, no values are returned.

**Solution:**

Parca doesn't support query-type variables. You can't use the Parca data source to dynamically populate variable drop-downs. Use **Custom** variables with manually defined values, **Text box** variables for free-form input, or a different data source for query-type variables. Refer to [Parca template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/template-variables/) for supported variable types and examples.

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for Parca-specific entries that include request and response details. Common log messages include:
   - `"Failed to get profile types"` -- profile type loading failed.
   - `"Failed to get label names"` -- label autocomplete data failed to load.
   - `"Failed to process query"` -- a query to Parca returned an error.
   - `"Failed to unmarshall query"` -- the query JSON couldn't be parsed.
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
