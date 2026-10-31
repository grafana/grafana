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
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Parca data source issues
weight: 500
review_date: 2026-10-08
---

# Troubleshoot Parca data source issues

{{< admonition type="warning" >}}
This plugin is deprecated and will only receive critical security updates. Support will end on January 2, 2027.
{{< /admonition >}}

This page provides solutions to common issues you might encounter when installing, configuring, or using the Parca data source. For installation and configuration instructions, refer to [Configure the Parca data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/configure/).

## Installation issues

These errors occur when Grafana can't load the manually installed Parca data source. Because Grafana doesn't bundle it, you build and install it yourself. Refer to [Install the data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/configure/#install-the-data-source).

### Parca doesn't appear in the data source list

**Symptoms:**

- Searching for `Parca` under **Connections** > **Add new connection** returns no results.
- Existing Parca data sources report the `parca` plugin isn't found.

**Possible causes and solutions:**

| Cause                       | Solution                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data source isn't installed | Build and install the Parca data source. Grafana 13.2 and later don't bundle it.                                                                                                                                                   |
| Wrong plugin directory      | Confirm the files are in a `parca` directory inside the configured plugin path. Refer to the `plugins` option in [Configure Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#plugins). |
| `plugin.json` missing       | Verify the `parca` directory contains `plugin.json` at its top level. Copy the _contents_ of `dist/`, not the `dist` directory itself.                                                                                             |
| Unsigned plugin blocked     | Add `allow_loading_unsigned_plugins = parca` to the `[plugins]` section of your Grafana configuration file and restart Grafana.                                                                                                    |
| Grafana wasn't restarted    | Restart Grafana. It discovers plugins only at startup.                                                                                                                                                                             |
| File permissions            | Verify the Grafana process can read the files. On package-based installations, run `chown -R grafana:grafana` on the `parca` directory.                                                                                            |

When Grafana loads the Parca data source, it logs the following warning on startup:

```text
WARN[...] Permitting unsigned plugin. This is not recommended   pluginId=parca
```

If this warning is absent, Grafana didn't load it. Search the server log for `parca` to find the reason.

### Queries fail but the data source appears

**Symptoms:**

- The Parca data source appears in the list and you can save it, but **Save & test** or any query fails.
- The server log mentions a missing or non-executable backend binary.

**Solutions:**

1. Verify you ran both build steps. The data source needs its Go backend as well as its frontend assets, so `npm run build` alone isn't enough. Run `go run github.com/magefile/mage -v buildAll` and reinstall.
1. Verify the `parca` directory contains a `gpx_grafana-parca-datasource_*` executable for your operating system and architecture.
1. Verify the executable has the execute permission bit set and isn't blocked by `noexec` on the mounted filesystem.
1. Restart Grafana after replacing any files.

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
1. If a reverse proxy sits between Grafana and Parca, verify it forwards gRPC-Web requests without buffering or rewriting them. The Parca data source queries Parca using gRPC-Web over the Parca HTTP endpoint.

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
| Variable not defined          | Verify the variable exists in **Dashboard options** > **Variables** and has valid values.                                                 |
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
1. Review the [repository issues](https://github.com/grafana/grafana-parca-datasource/issues) for known bugs related to the Parca data source.
1. Refer to the [Parca documentation](https://www.parca.dev/docs) for service-specific guidance.
1. Report new bugs in the [grafana/grafana-parca-datasource](https://github.com/grafana/grafana-parca-datasource/issues/new) repository. The Parca data source is deprecated and only receives critical security updates until January 2, 2027.
1. When reporting issues, include:
   - Grafana version
   - Parca server version
   - Data source commit or version you built from
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration (redact credentials)
