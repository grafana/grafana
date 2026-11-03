---
aliases:
  - ../../data-sources/influxdb/troubleshooting/
description: Troubleshooting the InfluxDB data source in Grafana
keywords:
  - grafana
  - influxdb
  - troubleshooting
  - errors
  - flux
  - influxql
  - sql
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot InfluxDB data source issues
weight: 700
review_date: 2026-08-04
---

# Troubleshoot InfluxDB data source issues

This document provides solutions to common issues you may encounter when configuring or using the InfluxDB data source. Issues are organized to follow the typical setup and usage workflow. For configuration instructions, refer to [Configure the InfluxDB data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure/).

## Connection errors

The following errors occur when Grafana can't establish or maintain a connection to InfluxDB.

### "Plugin health check failed" or "An error occurred within the plugin"

**Symptoms:**

- All panels using InfluxDB return "An error occurred within the plugin"
- Adding a new InfluxDB data source fails with "Plugin health check failed"
- Connection settings appear blank in the UI

**Possible causes and solutions:**

| Cause                   | Solution                                                                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform outage         | If all InfluxDB panels fail at the same time, check the [Grafana Cloud status page](https://status.grafana.com/) for active incidents before investigating your own configuration. The issue may be a transient platform problem that resolves without customer-side action. |
| Authentication failure  | Check the Grafana server logs for auth-related errors. Verify your credentials haven't expired or been rotated.                                                                                                                                                              |
| Transient network issue | The error may self-resolve. Wait a few minutes and retry **Save & test**. If the issue persists, check network connectivity between Grafana and InfluxDB.                                                                                                                    |

### Failed to connect to InfluxDB

**Error message:** `error performing influxQL query` or `error performing flux query` or `error performing sql query`

**Cause:** Grafana can't establish a network connection to the InfluxDB server.

**Solution:**

1. Verify that the InfluxDB URL is correct in the data source configuration.
1. Check that InfluxDB is running and accessible from the Grafana server.
1. Ensure the URL includes the protocol (`http://` or `https://`).
1. Verify the port is correct (the InfluxDB default API port is `8086`).
1. Ensure there are no firewall rules blocking the connection.
1. For Grafana Cloud, ensure you have configured [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if your InfluxDB instance is not publicly accessible.

### PDC connection fails with "no such host"

**Error message:** `socks connect tcp ... -> influxdb.host:8086: dial tcp: lookup ... no such host`

**Cause:** When using [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/), the InfluxDB URL can't be resolved through the SOCKS proxy tunnel.

**Solution:**

1. Don't use `127.0.0.1` or `localhost` as the InfluxDB URL. PDC tunnels traffic over a SOCKS proxy, which can't resolve loopback addresses.
1. Use the machine's LAN IP address or a resolvable hostname instead.
1. Verify the hostname is resolvable from the network where the PDC agent is running.
1. If the error appeared suddenly without configuration changes, check the [Grafana Cloud status page](https://status.grafana.com/) for active incidents.

### PDC connection stops working after certificate renewal fails

**Symptoms:**

- A previously working PDC-connected data source stops working
- The PDC agent logs show errors renewing or signing the SSH certificate
- Queries fail with SOCKS proxy connection errors

**Cause:** The PDC agent uses a Grafana Cloud API token to periodically renew its SSH certificate. If the token is incorrect, has expired, or has been deleted, certificate renewal fails and the connection stops working when the current certificate expires.

**Solution:**

1. Check the PDC agent logs for authentication or certificate signing errors.
1. Verify the API token in the PDC agent configuration is valid. If the token has expired or been deleted, generate a new one from your PDC connection page in Grafana Cloud and update the agent configuration.
1. Restart the PDC agent after updating the token.
1. Refer to [Troubleshoot PDC issues](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/troubleshooting/) for agent error codes, log interpretation, and token management guidance.

### TLS certificate errors

**Error message:** `x509: certificate signed by unknown authority` or similar TLS verification errors

**Cause:** InfluxDB presents a TLS certificate that isn't signed by a certificate authority (CA) that the Grafana server trusts. This is common with self-signed certificates and internal corporate certificate authorities. TLS verification applies end to end, so this error also occurs when you connect through PDC.

**Solution:**

1. The InfluxDB data source supports TLS configuration for each data source instance. In the data source settings, expand **Auth and TLS/SSL Settings**, enable **CA cert**, and paste your CA certificate. Refer to [Auth and TLS/SSL settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure/#auth-and-tlsssl-settings) for details.
1. If your InfluxDB server requires client certificates, enable **TLS client auth** and provide the server name, client certificate, and client key.
1. As a last resort, you can enable **Skip TLS verify** to bypass certificate validation. Grafana doesn't recommend this for production use because it disables protection against man-in-the-middle attacks.

### Request timed out

**Error message:** `context deadline exceeded` or `request timeout` or `dial tcp <IP>:<port>: i/o timeout`

**Cause:** The connection to InfluxDB timed out before receiving a response. This is common after Grafana upgrades when infrastructure changes (such as database host migrations) happen at the same time.

**Solution:**

1. Verify network connectivity from the Grafana server to your InfluxDB endpoint. Check DNS resolution, firewall rules, and port access.
1. Confirm the InfluxDB host IP address or hostname hasn't changed. This is especially important after infrastructure migrations or Grafana upgrades.
1. Check the network latency between Grafana and InfluxDB.
1. Verify that InfluxDB is not overloaded or experiencing performance issues.
1. Increase the timeout setting in the data source configuration under **Advanced HTTP Settings**.
1. Reduce the time range or complexity of your query.

## Authentication errors

The following errors occur when there are issues with authentication credentials or permissions.

### Unauthorized (401)

**Error message:** "401 Unauthorized" or "authorization failed"

**Cause:** The authentication credentials are invalid or missing. Transient network issues can also surface as authentication errors even when your credentials are valid.

**Solution:**

1. If the error is intermittent or appeared without a configuration change, wait a few minutes and retry **Save & test** to rule out a transient network issue before rotating credentials.
1. Verify that the token or password is correct in the data source configuration.
1. For Flux and SQL, ensure the token has not expired.
1. For InfluxQL with InfluxDB 2.x, verify the token is set as an `Authorization` header with the value `Token <your-token>`.
1. For InfluxDB 1.x, verify the username and password are correct.
1. Check that the token has the required permissions to access the specified bucket or database.

### Forbidden (403)

**Error message:** "403 Forbidden" or "access denied"

**Cause:** The authenticated user or token doesn't have permission to access the requested resource.

**Solution:**

1. Verify the token has read access to the specified bucket or database.
1. Check the token's permissions in the InfluxDB UI under **API Tokens**.
1. Ensure the organization ID is correct for Flux queries.
1. For InfluxQL with InfluxDB 2.x, verify the DBRP mapping is configured correctly.

## Configuration errors

The following errors occur when the data source is not configured correctly.

### URL not configured

**Error message:** `missing URL from datasource configuration`

**Cause:** The data source URL field is empty.

**Solution:**

1. Open the data source configuration in Grafana.
1. Enter the full URL of your InfluxDB instance in the **URL** field, including the protocol and port (for example, `http://localhost:8086`).
1. Click **Save & test** to verify the connection.

### Unknown influx version

**Error message:** "unknown influx version"

**Cause:** The query language is not properly configured in the data source settings.

**Solution:**

1. Open the data source configuration in Grafana.
1. Verify that a valid query language is selected: **Flux**, **InfluxQL**, or **SQL**.
1. Match the query language to your InfluxDB version:

| InfluxDB version                         | Recommended query language | Notes                                                                                                                                                       |
| ---------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.x                                      | InfluxQL                   | Flux is available from 1.8+ but InfluxQL is the primary language.                                                                                           |
| 2.x (OSS/Cloud)                          | Flux                       | InfluxQL is also available via the v1 compatibility API, but requires [DBRP mapping](https://docs.influxdata.com/influxdb/cloud/query-data/influxql/dbrp/). |
| 3.x / Cloud Dedicated / Cloud Serverless | SQL or InfluxQL            | Flux is not supported on InfluxDB 3.x.                                                                                                                      |

Each query language uses a different API endpoint. If you select the wrong language for your InfluxDB version, health checks and queries fail.

### Invalid data source info received

**Error message:** `invalid data source info received`

**Cause:** The data source configuration is incomplete or corrupted.

**Solution:**

1. Delete and recreate the data source.
1. Ensure all required fields are populated based on your query language:
   - **Flux:** URL, Organization, Token, Default Bucket
   - **InfluxQL:** URL, Database, User, Password
   - **SQL:** URL, Database, Token

### DBRP mapping required

**Error message:** "database not found" or queries return no data with InfluxQL on InfluxDB 2.x

**Cause:** InfluxQL queries on InfluxDB 2.x require a Database and Retention Policy (DBRP) mapping.

**Solution:**

1. Create a DBRP mapping in InfluxDB using the CLI or API.
1. Refer to [Manage DBRP Mappings](https://docs.influxdata.com/influxdb/cloud/query-data/influxql/dbrp/) for guidance.
1. Verify the database name in Grafana matches the DBRP mapping.

### Browser access mode disabled

**Error message:** `Direct browser access in the InfluxDB datasource is no longer available. Switch to server access mode.`

**Cause:** The data source is configured for direct browser access, which is no longer supported.

**Solution:**

1. Open the data source configuration in Grafana.
1. Change the access mode to **Server (default)**.
1. Click **Save & test** to verify the connection.

### Content Security Policy (CSP) violation

**Symptoms:**

- CSP violation errors in the browser console referencing the InfluxDB plugin
- `net::ERR_ABORTED` on proxy requests
- The InfluxDB plugin attempts direct browser-to-InfluxDB connections

**Cause:** You're running an outdated version of Grafana. Browser access mode was removed in Grafana 9.2.0, and older versions may attempt direct browser connections that violate CSP policies. Current versions of the data source support only server (proxy) access, where the Grafana server sends all queries to InfluxDB and the browser never connects to InfluxDB directly.

**Solution:**

1. Upgrade to the latest stable Grafana release. The InfluxDB data source requires Grafana 12.3.0 or later.
1. After upgrading, verify the data source access mode is set to **Server (default)**.

## Health check errors

The following errors occur when clicking **Save & test** to validate the data source connection. Each query language uses a different health check query.

### Flux health check errors

**"error performing flux query"**

**Cause:** The health check query `buckets()` failed to execute.

**Solution:**

1. Verify the InfluxDB URL is correct and reachable.
1. Check that the token is valid and has not expired.
1. Ensure the organization ID is correct.

**"error reading buckets"**

**Cause:** The `buckets()` query executed but returned an error.

**Solution:**

1. Verify the token has permission to list buckets.
1. Check that the organization ID matches the token's organization.

**"error getting flux query buckets"**

**Cause:** The `buckets()` query executed without error but returned no data.

**Solution:**

1. Verify the token has permission to list buckets.
1. Check that the organization ID is correct.
1. Ensure InfluxDB is running and accessible.

### InfluxQL health check errors

**"error performing influxQL query"**

**Cause:** The health check query `SHOW MEASUREMENTS` failed to execute.

**Solution:**

1. Verify the InfluxDB URL is correct and reachable.
1. Check the username and password (or token for InfluxDB 2.x).
1. Verify the database name exists.

**"error reading influxDB"**

**Cause:** The `SHOW MEASUREMENTS` query executed but returned an error.

**Solution:**

1. Verify the database name is correct.
1. Check that the user has permission to run `SHOW MEASUREMENTS`.
1. For InfluxDB 2.x, verify DBRP mapping is configured.

**"error connecting InfluxDB influxQL"**

**Cause:** The health check completed but the response couldn't be processed.

**Solution:**

1. Verify the database name is correct.
1. Check that the user has permission to run `SHOW MEASUREMENTS`.
1. Ensure the database exists and contains measurements.
1. For InfluxDB 2.x, verify DBRP mapping is configured.

### SQL health check errors

**"error performing sql query"**

**Cause:** The health check query `select 1` failed to execute against the FlightSQL endpoint.

**Solution:**

1. Verify the InfluxDB URL is correct. The SQL health check connects via gRPC (FlightSQL).
1. Check the token is valid and has the required permissions.
1. If using TLS, verify the certificate configuration. Toggle **Insecure Connection** if connecting without TLS.
1. Ensure the InfluxDB 3.x instance is running and the FlightSQL endpoint is accessible.

### 0 measurements found

**Error message:** `datasource is working. 0 measurements found`

**Cause:** The connection is successful, but the database contains no measurements.

**Solution:**

1. Verify you are connecting to the correct database.
1. Check that data has been written to the database.
1. If the database is new, add some test data to verify the connection.

## Query errors

The following errors occur when there are issues with query syntax or execution.

### Query syntax error

**Error message:** "error parsing query: found THING" or "failed to parse query: found WERE, expected ; at line 1, char 38"

**Cause:** The query contains invalid syntax.

**Solution:**

1. Check your query syntax for typos or invalid keywords.
1. For InfluxQL, verify the query follows the correct syntax:

   ```sql
   SELECT <field> FROM <measurement> WHERE <condition>
   ```

1. For SQL, verify your query uses standard SQL syntax supported by InfluxDB 3.x. Common issues include using InfluxQL-specific syntax (such as `GROUP BY time()`) in SQL mode. Refer to the [InfluxDB SQL reference](https://docs.influxdata.com/influxdb/cloud-serverless/reference/sql/) for supported functions.
1. For Flux, ensure proper pipe-forward syntax and function calls.
1. Use the InfluxDB UI or CLI to test your query directly.

### Query timeout limit exceeded

**Error message:** "query-timeout limit exceeded"

**Cause:** The query took longer than the configured timeout limit in InfluxDB.

**Solution:**

1. Reduce the time range of your query.
1. Add more specific filters to limit the data scanned.
1. Increase the query timeout setting in InfluxDB if you have administrator access.
1. Optimize your query to reduce complexity.

### Too many series or data points

**Error message:** "max-series-per-database limit exceeded" or "A query returned too many data points and the results have been truncated"

**Cause:** The query is returning more data than the configured limits allow.

**Solution:**

1. Reduce the time range of your query.
1. Add filters to limit the number of series returned.
1. Increase the **Max series** setting in the data source configuration under **Advanced Database Settings**.
1. Use aggregation functions to reduce the number of data points.
1. For SQL, use `$__dateBin(time)` to aggregate data into time buckets and reduce cardinality.
1. For Flux, use `aggregateWindow()` to downsample data.

### FlightSQL errors (SQL query language)

**Error message:** Messages prefixed with `"flightsql: "` followed by a gRPC error description.

**Cause:** The SQL (FlightSQL) backend encountered an error communicating with InfluxDB 3.x.

**Possible causes and solutions:**

| Error code         | Cause                                                    | Solution                                              |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------- |
| `InvalidArgument`  | The SQL query syntax is invalid.                         | Check your SQL query for syntax errors.               |
| `PermissionDenied` | The token doesn't have access to the requested resource. | Verify the token has read access to the database.     |
| `NotFound`         | The requested table or database doesn't exist.           | Check the database name and table name in your query. |
| `Unavailable`      | The InfluxDB server is unreachable.                      | Verify InfluxDB is running and the URL is correct.    |
| `Unauthenticated`  | The token is missing, invalid, or expired.               | Update the token in the data source configuration.    |

### No time column found

**Error message:** "no time column found"

**Cause:** The query result doesn't include a time column, which is required for time-series visualization.

**Solution:**

1. Ensure your query includes a time field.
1. For Flux, verify the query includes `_time` in the output.
1. For SQL, ensure the query returns a timestamp column.
1. Check that the time field is not being filtered out or excluded.

## Annotation errors

The following errors occur when using InfluxDB annotations on dashboards.

### "Query missing in annotation definition"

**Cause:** The annotation query field is empty.

**Solution:**

1. Navigate to the dashboard you want to update and click **Edit**.
1. Click the **Dashboard options** icon to open the sidebar.
1. Expand the **Annotations** section.
1. Select the InfluxDB annotation.
1. Click **Open query editor** to open the **Annotation Query** dialog box.
1. Enter a valid query in the **InfluxQL Query** field. The query must include `WHERE $timeFilter`. For example:

   ```sql
   SELECT title, description FROM events WHERE $timeFilter ORDER BY time ASC
   ```

### "Flux requires the standard annotation query"

**Cause:** A Flux data source is using the legacy InfluxQL annotation editor instead of the standard Flux query editor.

**Solution:**

1. Delete the existing annotation query.
1. Create a new annotation query and select your Flux-configured InfluxDB data source.
1. Write a Flux query that returns data frames with time and text fields. For example:

   ```flux
   from(bucket: "events")
     |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
     |> filter(fn: (r) => r["_measurement"] == "deployments")
   ```

### Annotations don't appear on the graph

**Cause:** Annotations are configured but aren't visible on the dashboard.

**Solution:**

1. Verify the annotation query returns data by testing it in Explore.
1. Check the dashboard time range covers the time period of your annotation events.
1. Ensure the annotation toggle is enabled in the dashboard (check the annotation icon in the top menu bar).
1. For InfluxQL, confirm the query includes `WHERE $timeFilter`.
1. If your query returns multiple columns, verify the field mappings (**Text**, **Tags**, **TimeEnd**) are set correctly.

## Alerting errors

The following errors occur when using InfluxDB queries with Grafana Alerting.

### Alert rule fails with template variable errors

**Cause:** The alert query contains template variables such as `$hostname` or `$region`.

**Solution:**

Alert queries can't use template variables because Grafana evaluates alert rules on the backend without dashboard context. Replace template variables with hard-coded values:

1. Open the alert rule.
1. Replace any `$variable` references with literal values.
1. Save the alert rule.

If you need the same query in both a dashboard panel and an alert rule, maintain two separate queries: one with variables for the dashboard and one with hard-coded values for alerting.

### Alert evaluation returns "no data"

**Cause:** The alert query doesn't return time-series data that Grafana can evaluate.

**Solution:**

1. Test the query in Explore first to verify it returns data.
1. For InfluxQL, ensure the query uses an aggregation function (such as `mean`, `sum`, `count`) with `GROUP BY time($__interval)`.
1. For Flux, use `aggregateWindow()` to produce time-bucketed results.
1. For SQL, use `$__dateBin(time)` or `$__timeGroup(time)` to aggregate by time.
1. Check that the alert evaluation time range contains data. Alerts use a fixed time range, not the dashboard's time picker.
1. Verify the data source connection is working by clicking **Save & test** in the data source settings.

## Template variable errors

The following issues occur when using template variables with InfluxDB queries.

### Variable drop-down shows stale or historical values

**Cause:** Metadata queries such as `SHOW TAG VALUES` return values from the entire retention period, not just the dashboard time range. Hosts or sensors that stopped reporting long ago still appear in the drop-down.

**Solution:**

1. Add a time condition to the variable query, such as `WHERE $timeFilter` for InfluxQL or `WHERE $__timeFilter(time)` for SQL.
1. Set the variable's **Refresh** option to **On time range change**.
1. Refer to [Scope variables to the dashboard time range](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/template-variables/#scope-variables-to-the-dashboard-time-range) for examples.

### Multi-select variable breaks the query

**Cause:** When a variable has the **Multi-value** or **Include all value** option enabled, Grafana interpolates the selected values as a regular expression group, such as `(server1|server2)`. Queries that compare with `=` or that don't wrap the variable in a regular expression fail or return no data.

**Solution:**

1. For InfluxQL, use the `=~` operator and wrap the variable in a regular expression: `"hostname" =~ /^$host$/`.
1. For SQL, use the `IN` operator: `host IN ($host)`.
1. Refer to [Choose a variable syntax](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/template-variables/#choose-a-variable-syntax) for working examples.

### Variable values are escaped unexpectedly

**Cause:** Grafana escapes special characters in variable values when the variable is multi-value or used inside a regular expression. Custom variable values that intentionally contain special characters, such as paths or expressions, arrive at InfluxDB modified.

**Solution:**

Use the `raw` format option, such as `${path:raw}`, to interpolate the literal value without escaping. Refer to [Prevent unwanted value escaping](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/template-variables/#prevent-unwanted-value-escaping) for details.

### Variable drop-down contains a blank or duplicate entry

**Cause:** The variable query returns duplicate values. Grafana deduplicates results, but depending on the plugin version, duplicates can surface as a blank entry in the drop-down.

**Solution:**

1. Update the variable query to return unique values. For SQL, use `SELECT DISTINCT`. For InfluxQL, `SHOW` metadata queries already return unique values, so check for duplicates across retention policies.
1. Alternatively, use the variable's **Regex** option to filter the results.

## Other common issues

The following issues don't produce specific error messages but are commonly encountered during day-to-day use.

### "Data source was not found"

**Symptoms:**

- Dashboard panels display "data source \<UID\> was not found"
- Manually re-running queries in the panel editor works after you select the data source again

**Cause:** Dashboard panels reference an old or deleted data source UID. This happens when a data source is deleted and recreated, since the new data source gets a different UID. Dashboard schema migrations can also leave panels with invalid data source references, so verify your panels after a dashboard is migrated to a new schema version.

**Solution:**

1. Find the current UID of your InfluxDB data source. Navigate to **Connections** > **Data sources**, open the data source, and copy the UID from the page URL.
1. To find every stale reference at once, open the dashboard's JSON model from the dashboard settings and search for the UID shown in the panel error message.
1. Fix the references by editing each affected panel and selecting the correct InfluxDB data source from the drop-down again, or by replacing the stale UID in the JSON model and saving the dashboard.
1. To avoid this issue, update existing data sources instead of deleting and recreating them.

### 404 Not Found when sending Telegraf metrics to Grafana Cloud

**Error message:** "404 Not Found" when Telegraf writes to the Grafana Cloud InfluxDB-compatible endpoint.

**Cause:** The Telegraf `influxdb_v2` output plugin isn't compatible with the Grafana Cloud metrics endpoint. This commonly occurs when using PrivateLink or the standard InfluxDB-compatible write endpoint.

**Solution:**

1. Switch the Telegraf output plugin from `influxdb_v2` to `influxdb` (v1) in your Telegraf configuration.
1. Ensure the endpoint URL and credentials match those shown in your Grafana Cloud InfluxDB configuration page.
1. Restart Telegraf after making the change.

### Empty query results

**Cause:** The query returns no data.

**Solution:**

1. Verify the time range includes data in your database.
1. Check that the measurement and field names are correct. For SQL, table names in InfluxDB 3.x are case-sensitive.
1. Test the query directly in the InfluxDB UI or CLI.
1. Ensure filters are not excluding all data.
1. For SQL, verify the `$__timeFilter(time)` macro is included so the query uses the dashboard time range.
1. For InfluxQL, verify the retention policy contains data for the selected time range.

### Numeric values stored as strings display a blank panel

**Symptoms:**

- Time series panels show no data even though the query returns results
- Values appear in the table view but can't be graphed

**Cause:** InfluxDB sets a field's data type when the field is first written. If numeric values were written as strings, for example quoted in line protocol, InfluxDB returns them as strings and Grafana can't graph them. This is a data issue in InfluxDB, not in Grafana.

**Solution:**

1. As a workaround, add the [Convert field type](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#convert-field-type) transformation to the panel and convert the field to **Number**.
1. To fix the root cause, correct the data type at write time. InfluxDB can't change the type of an existing field, so you may need to write the data to a new field or measurement.
1. In older Grafana versions, the **Convert field type** transformation converted null values to zeros. Current versions preserve null values. If you see nulls displayed as zeros after conversion, upgrade Grafana.

### Panel values differ between view and edit mode

**Cause:** Grafana calculates the query interval (`$__interval`) from the time range and the maximum number of data points, which is based on the panel's width. A panel rendered in edit mode has a different width than in the dashboard view, so queries that group by `time($__interval)` can aggregate into different bucket sizes and display different values. Both results are correct. They're aggregated at different resolutions.

**Solution:**

1. To make values consistent, set a fixed **Min interval** or **Max data points** value in the panel's query options.
1. Alternatively, use an explicit interval in the query, such as `GROUP BY time(1m)` instead of `GROUP BY time($__interval)`.

### Legend or tooltip colors don't match the series

**Cause:** The query returns multiple series with the same name. This commonly happens when a query doesn't group by the tags that differentiate series, or when an alias hides the distinguishing information. Grafana assigns colors and tooltip values by series name, so duplicate names cause the legend and hover tooltip to display mismatched colors or values.

**Solution:**

1. Group by the tags that make each series unique, such as `GROUP BY "hostname"`.
1. Use alias patterns such as `$tag_hostname` in the **ALIAS** field so each series has a unique display name. Refer to [Alias patterns](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/query-editor/#alias-patterns) for details.
1. Use the panel inspector to confirm each returned series has a distinct name.

### Slow query performance

**Cause:** Queries take a long time to execute.

**Solution:**

1. Reduce the time range of your query.
1. Add more specific filters to limit the data scanned.
1. Increase the **Min time interval** setting to reduce the number of data points.
1. Check InfluxDB server performance and resource utilization.
1. For SQL, use `$__dateBin(time)` with aggregation functions to downsample data. Add `WHERE` clauses to narrow the query scope.
1. For Flux, use `aggregateWindow()` to downsample data before visualization.
1. Consider using continuous queries or tasks to pre-aggregate data.

### InfluxDB receives a high volume of queries from Grafana

**Symptoms:**

- Unexpected query load on your InfluxDB server
- You're unsure whether the traffic originates from Grafana

**Cause:** Every panel on a dashboard sends its queries to InfluxDB each time the dashboard refreshes. Query volume scales with the number of panels, the number of queries per panel, the refresh interval, and the number of people viewing the dashboard at the same time. For example, a dashboard with 20 panels refreshing every 10 seconds generates at least 120 queries per minute for each viewer.

**Solution:**

1. Increase the dashboard refresh interval or turn off auto-refresh where it isn't needed.
1. Reduce the number of panels and queries per dashboard.
1. Increase the **Min time interval** setting to reduce the resolution of each query.
1. In Grafana Enterprise and Grafana Cloud, enable [query caching](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching) so identical queries within the cache window are served from cache instead of hitting InfluxDB.
1. To confirm whether traffic originates from your Grafana Cloud instance, compare the source IP addresses against the [Grafana Cloud allowlist](https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/security-and-access/allow-list/).

### Data appears delayed or missing recent points

**Cause:** The visualization doesn't show the most recent data.

**Solution:**

1. Check the dashboard time range and refresh settings.
1. Verify the **Min time interval** is not set too high.
1. Ensure InfluxDB has finished writing the data.
1. Check for clock synchronization issues between Grafana and InfluxDB.

## Enable debug logging

{{< admonition type="caution" >}}
InfluxDB plugin versions earlier than 13.1.0 could write API tokens to Grafana server logs in plain text at default log levels. Before troubleshooting with logs, upgrade to plugin version 13.1.0 or later. Treat log files as sensitive, and rotate any tokens that may have been exposed.
{{< /admonition >}}

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for InfluxDB-specific entries that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions in this guide and still encounter issues:

1. Check the [InfluxDB documentation](https://docs.influxdata.com/) for API-specific guidance.
1. Review the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review [InfluxDB data source issues on GitHub](https://github.com/grafana/grafana-influxdb-datasource/issues) for known bugs.
1. Contact Grafana Support if you're an Enterprise, Cloud Pro, or Cloud Contracted user.
1. When reporting issues, include:
   - Grafana version
   - InfluxDB data source plugin version, found on the **Administration > Plugins** page
   - InfluxDB version and product (OSS, Cloud, Enterprise)
   - Query language (Flux, InfluxQL, or SQL)
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration such as data source settings, HTTP method, and TLS settings (redact tokens, passwords, and other credentials)
