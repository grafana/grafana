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
title: Troubleshoot issues with the InfluxDB data source
weight: 600
---

# Troubleshoot issues with the InfluxDB data source

This document provides troubleshooting information for common errors you may encounter when using the InfluxDB data source in Grafana.

## Connection errors

The following errors occur when Grafana cannot establish or maintain a connection to InfluxDB.

### Failed to connect to InfluxDB

**Error message:** "error performing influxQL query" or "error performing flux query" or "error performing sql query"

**Cause:** Grafana cannot establish a network connection to the InfluxDB server.

**Solution:**

1. Verify that the InfluxDB URL is correct in the data source configuration.
1. Check that InfluxDB is running and accessible from the Grafana server.
1. Ensure the URL includes the protocol (`http://` or `https://`).
1. Verify the port is correct (InfluxDB's default API port is `8086`).
1. Ensure there are no firewall rules blocking the connection.
1. For Grafana Cloud, ensure you have configured [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if your InfluxDB instance is not publicly accessible.

### Request timed out

**Error message:** "context deadline exceeded" or "request timeout"

**Cause:** The connection to InfluxDB timed out before receiving a response.

**Solution:**

1. Check the network latency between Grafana and InfluxDB.
1. Verify that InfluxDB is not overloaded or experiencing performance issues.
1. Increase the timeout setting in the data source configuration under **Advanced HTTP Settings**.
1. Reduce the time range or complexity of your query.

## Authentication errors

The following errors occur when there are issues with authentication credentials or permissions.

### Unauthorized (401)

**Error message:** "401 Unauthorized" or "authorization failed"

**Cause:** The authentication credentials are invalid or missing.

**Solution:**

1. Verify that the token or password is correct in the data source configuration.
1. For Flux and SQL, ensure the token has not expired.
1. For InfluxQL with InfluxDB 2.x, verify the token is set as an `Authorization` header with the value `Token <your-token>`.
1. For InfluxDB 1.x, verify the username and password are correct.
1. Check that the token has the required permissions to access the specified bucket or database.

### Forbidden (403)

**Error message:** "403 Forbidden" or "access denied"

**Cause:** The authenticated user or token does not have permission to access the requested resource.

**Solution:**

1. Verify the token has read access to the specified bucket or database.
1. Check the token's permissions in the InfluxDB UI under **API Tokens**.
1. Ensure the organization ID is correct for Flux queries.
1. For InfluxQL with InfluxDB 2.x, verify the DBRP mapping is configured correctly.

## Configuration errors

The following errors occur when the data source is not configured correctly.

### Unknown influx version

**Error message:** "unknown influx version"

**Cause:** The query language is not properly configured in the data source settings.

**Solution:**

1. Open the data source configuration in Grafana.
1. Verify that a valid query language is selected: **Flux**, **InfluxQL**, or **SQL**.
1. Ensure the selected query language matches your InfluxDB version:
   - Flux: InfluxDB 1.8+ and 2.x
   - InfluxQL: InfluxDB 1.x and 2.x (with DBRP mapping)
   - SQL: InfluxDB 3.x only

### Invalid datasource info received

**Error message:** "invalid datasource info received"

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

1. For Flux, ensure proper pipe-forward syntax and function calls.
1. Use the InfluxDB UI or CLI to test your query directly.

### Query timeout limit exceeded

**Error message:** "query-timeout limit exceeded"

**Cause:** The query took longer than the configured timeout limit in InfluxDB.

**Solution:**

1. Reduce the time range of your query.
1. Add more specific filters to limit the data scanned.
1. Increase the query timeout setting in InfluxDB if you have admin access.
1. Optimize your query to reduce complexity.

### Too many series or datapoints

**Error message:** "max-series-per-database limit exceeded" or "A query returned too many datapoints and the results have been truncated"

**Cause:** The query is returning more data than the configured limits allow.

**Solution:**

1. Reduce the time range of your query.
1. Add filters to limit the number of series returned.
1. Increase the **Max series** setting in the data source configuration under **Advanced Database Settings**.
1. Use aggregation functions to reduce the number of datapoints.
1. For Flux, use `aggregateWindow()` to downsample data.

### No time column found

**Error message:** "no time column found"

**Cause:** The query result does not include a time column, which is required for time series visualization.

**Solution:**

1. Ensure your query includes a time field.
1. For Flux, verify the query includes `_time` in the output.
1. For SQL, ensure the query returns a timestamp column.
1. Check that the time field is not being filtered out or excluded.

## Health check errors

The following errors occur when testing the data source connection.

### Error getting flux query buckets

**Error message:** "error getting flux query buckets"

**Cause:** The health check query `buckets()` failed to return results.

**Solution:**

1. Verify the token has permission to list buckets.
1. Check that the organization ID is correct.
1. Ensure InfluxDB is running and accessible.

### Error connecting influxDB influxQL

**Error message:** "error connecting influxDB influxQL"

**Cause:** The health check query `SHOW MEASUREMENTS` failed.

**Solution:**

1. Verify the database name is correct.
1. Check that the user has permission to run `SHOW MEASUREMENTS`.
1. Ensure the database exists and contains measurements.
1. For InfluxDB 2.x, verify DBRP mapping is configured.

### 0 measurements found

**Error message:** "datasource is working. 0 measurements found"

**Cause:** The connection is successful, but the database contains no measurements.

**Solution:**

1. Verify you are connecting to the correct database.
1. Check that data has been written to the database.
1. If the database is new, add some test data to verify the connection.

## Other common issues

The following issues don't produce specific error messages but are commonly encountered.

### Empty query results

**Cause:** The query returns no data.

**Solution:**

1. Verify the time range includes data in your database.
1. Check that the measurement and field names are correct.
1. Test the query directly in the InfluxDB UI or CLI.
1. Ensure filters are not excluding all data.
1. For InfluxQL, verify the retention policy contains data for the selected time range.

### Slow query performance

**Cause:** Queries take a long time to execute.

**Solution:**

1. Reduce the time range of your query.
1. Add more specific filters to limit the data scanned.
1. Increase the **Min time interval** setting to reduce the number of data points.
1. Check InfluxDB server performance and resource utilization.
1. For Flux, use `aggregateWindow()` to downsample data before visualization.
1. Consider using continuous queries or tasks to pre-aggregate data.

### Data appears delayed or missing recent points

**Cause:** The visualization doesn't show the most recent data.

**Solution:**

1. Check the dashboard time range and refresh settings.
1. Verify the **Min time interval** is not set too high.
1. Ensure InfluxDB has finished writing the data.
1. Check for clock synchronization issues between Grafana and InfluxDB.

## Get additional help

If you continue to experience issues after following this troubleshooting guide:

1. Check the [InfluxDB documentation](https://docs.influxdata.com/) for API-specific guidance.
1. Review the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Contact Grafana Support if you're an Enterprise, Cloud Pro or Cloud Contracted user.
1. When reporting issues, include:
   - Grafana version
   - InfluxDB version and product (OSS, Cloud, Enterprise)
   - Query language (Flux, InfluxQL, or SQL)
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration such as data source settings, HTTP method, and TLS settings (redact tokens, passwords, and other credentials)
