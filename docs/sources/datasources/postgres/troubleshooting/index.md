---
aliases:
  - ../../data-sources/postgres/troubleshooting/
description: Troubleshooting the PostgreSQL data source in Grafana
keywords:
  - grafana
  - postgresql
  - troubleshooting
  - errors
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot PostgreSQL data source issues
weight: 600
---

# Troubleshoot PostgreSQL data source issues

This document provides troubleshooting information for common errors you may encounter when using the PostgreSQL data source in Grafana.

## Connection errors

The following errors occur when Grafana cannot establish or maintain a connection to PostgreSQL.

### Failed to connect to PostgreSQL

**Error message:** `failed to connect to ... : connect: connection refused` or `dial tcp: connect: connection refused`

**Cause:** Grafana cannot establish a network connection to the PostgreSQL server.

**Solution:**

1. Verify that the Host URL is correct in the data source configuration.
1. Check that PostgreSQL is running and accessible from the Grafana server.
1. Verify the port is correct (the PostgreSQL default port is `5432`).
1. Ensure there are no firewall rules blocking the connection.
1. Check that PostgreSQL is configured to accept connections from the Grafana server in `pg_hba.conf`.
1. For Grafana Cloud, ensure you have configured [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if your PostgreSQL instance is not publicly accessible.

### Request timed out

**Error message:** "context deadline exceeded" or "i/o timeout"

**Cause:** The connection to PostgreSQL timed out before receiving a response.

**Solution:**

1. Check the network latency between Grafana and PostgreSQL.
1. Verify that PostgreSQL is not overloaded or experiencing performance issues.
1. Increase the **Max lifetime** setting in the data source configuration under **Connection limits**.
1. Reduce the time range or complexity of your query.
1. Check if any network devices (load balancers, proxies) are timing out the connection.

### Host not found

**Error message:** `failed to connect to ... : hostname resolving error` or `lookup hostname: no such host`

**Cause:** The hostname specified in the data source configuration cannot be resolved.

**Solution:**

1. Verify the hostname is spelled correctly.
1. Check that DNS resolution is working on the Grafana server.
1. Try using an IP address instead of a hostname.
1. Ensure the PostgreSQL server is accessible from the Grafana server's network.

## Authentication errors

The following errors occur when there are issues with authentication credentials or permissions.

### Password authentication failed

**Error message:** `failed to connect to ... : server error: FATAL: password authentication failed for user "username" (SQLSTATE 28P01)`

**Cause:** The username or password is incorrect.

**Solution:**

1. Verify that the username and password are correct in the data source configuration.
1. Check that the user exists in PostgreSQL.
1. Verify the password has not expired.
1. If no password is specified, ensure a [PostgreSQL password file](https://www.postgresql.org/docs/current/static/libpq-pgpass.html) is configured.

### Permission denied

**Error message:** `ERROR: permission denied for table table_name (SQLSTATE 42501)` or `ERROR: permission denied for schema schema_name (SQLSTATE 42501)`

**Cause:** The database user does not have permission to access the requested table or schema.

**Solution:**

1. Verify the user has `SELECT` permissions on the required tables.
1. Grant the necessary permissions:

   ```sql
   GRANT USAGE ON SCHEMA schema_name TO grafanareader;
   GRANT SELECT ON schema_name.table_name TO grafanareader;
   ```

1. Check that the user has access to the correct database.
1. Verify the search path includes the schema containing your tables.

### No pg_hba.conf entry

**Error message:** `failed to connect to ... : server error: FATAL: no pg_hba.conf entry for host "ip_address", user "username", database "database_name" (SQLSTATE 28000)`

**Cause:** PostgreSQL is not configured to accept connections from the Grafana server.

**Solution:**

1. Edit the `pg_hba.conf` file on the PostgreSQL server.
1. Add an entry to allow connections from the Grafana server:

   ```text
   host    database_name    username    grafana_ip/32    md5
   ```

1. Reload PostgreSQL configuration: `SELECT pg_reload_conf();`
1. If using SSL, ensure the correct authentication method is specified (for example, `hostssl` instead of `host`).

## TLS and certificate errors

The following errors occur when there are issues with TLS configuration.

### Certificate verification failed

**Error message:** "x509: certificate signed by unknown authority" or "certificate verify failed"

**Cause:** Grafana cannot verify the TLS certificate presented by PostgreSQL.

**Solution:**

1. Set the **TLS/SSL Mode** to the appropriate level (`require`, `verify-ca`, or `verify-full`).
1. If using a self-signed certificate, add the CA certificate in **TLS/SSL Auth Details**.
1. Verify the certificate chain is complete and valid.
1. Ensure the certificate has not expired.
1. For testing only, set **TLS/SSL Mode** to `disable` (not recommended for production).

### SSL not supported

**Error message:** `failed to connect to ... : server refused TLS connection` or `server does not support SSL`

**Cause:** The PostgreSQL server is not configured for SSL connections, but the data source requires SSL.

**Solution:**

1. Set **TLS/SSL Mode** to `disable` if SSL is not required.
1. Alternatively, enable SSL on the PostgreSQL server by configuring `ssl = on` in `postgresql.conf`.
1. Ensure the server has valid SSL certificates configured.

### Client certificate error

**Error message:** "TLS: failed to find any PEM data in certificate input" or "could not load client certificate"

**Cause:** The client certificate or key is invalid or incorrectly formatted.

**Solution:**

1. Verify the certificate and key are in PEM format.
1. Ensure the certificate file path is correct and readable by the Grafana process.
1. Check that the certificate and key match (belong to the same key pair).
1. If using certificate content, ensure you've pasted the complete certificate including headers.

## Database errors

The following errors occur when there are issues with the database configuration.

### Database does not exist

**Error message:** `failed to connect to ... : server error: FATAL: database "database_name" does not exist (SQLSTATE 3D000)`

**Cause:** The specified database name is incorrect or the database doesn't exist.

**Solution:**

1. Verify the database name in the data source configuration.
1. Check that the database exists: `\l` in psql or `SELECT datname FROM pg_database;`
1. Ensure the database name is case-sensitive and matches exactly.
1. Verify the user has permission to connect to the database.

### Relation does not exist

**Error message:** `ERROR: relation "table_name" does not exist (SQLSTATE 42P01)`

**Cause:** The specified table or view does not exist, or the user cannot access it.

**Solution:**

1. Verify the table name is correct and exists in the database.
1. Check the schema name if the table is not in the public schema.
1. Use fully qualified names: `schema_name.table_name`.
1. Verify the user has `SELECT` permission on the table.
1. Check the search path: `SHOW search_path;`

## Query errors

The following errors occur when there are issues with SQL syntax or query execution.

### Query syntax error

**Error message:** `ERROR: syntax error at or near "keyword" (SQLSTATE 42601)`

**Cause:** The SQL query contains invalid syntax.

**Solution:**

1. Check your query syntax for typos or invalid keywords.
1. Verify column and table names are correctly quoted if they contain special characters or are reserved words.
1. Use double quotes for identifiers: `"column_name"`.
1. Test the query directly in a PostgreSQL client (psql, pgAdmin).

### Column does not exist

**Error message:** `ERROR: column "column_name" does not exist (SQLSTATE 42703)`

**Cause:** The specified column name is incorrect or doesn't exist in the table.

**Solution:**

1. Verify the column name is spelled correctly.
1. Check that column names are case-sensitive in PostgreSQL when quoted.
1. Use the correct quoting for column names: `"Column_Name"` for case-sensitive names.
1. Verify the column exists in the table: `\d table_name` in psql.

### No time column found

**Error message:** "no time column found" or time series visualization shows no data

**Cause:** The query result does not include a properly formatted time column.

**Solution:**

1. Ensure your query includes a column named `time` that returns a timestamp or epoch value.
1. Use an alias to rename your time column: `SELECT created_at AS time`.
1. Ensure the time column is of type `timestamp`, `timestamptz`, or a numeric epoch value.
1. Order results by the time column: `ORDER BY time ASC`.

### Macro expansion error

**Error message:** "macro '$\_\_timeFilter' not found" or incorrect query results with macros

**Cause:** Grafana macros are not being properly expanded.

**Solution:**

1. Verify the macro syntax is correct, for example `$__timeFilter(time_column)`.
1. Ensure the column name passed to the macro exists in your table.
1. Use the **Preview** toggle in Builder mode to see the expanded query.
1. For time-based macros, ensure the column contains timestamp data.

## Performance issues

The following issues relate to slow query execution or resource constraints.

### Query timeout

**Error message:** "canceling statement due to statement timeout" or "query timeout"

**Cause:** The query took longer than the configured timeout.

**Solution:**

1. Reduce the time range of your query.
1. Add indexes to columns used in WHERE clauses and joins.
1. Use the `$__timeFilter` macro to limit data to the dashboard time range.
1. Increase the statement timeout in PostgreSQL if you have admin access.
1. Optimize your query to reduce complexity.

### Too many connections

**Error message:** `failed to connect to ... : server error: FATAL: too many connections for role "username" (SQLSTATE 53300)` or `connection pool exhausted`

**Cause:** The maximum number of connections to PostgreSQL has been reached.

**Solution:**

1. Reduce the **Max open** connections setting in the data source configuration.
1. Increase `max_connections` in PostgreSQL's `postgresql.conf` if you have admin access.
1. Check for connection leaks in other applications connecting to the same database.
1. Enable **Auto max idle** to automatically manage idle connections.

### Slow query performance

**Cause:** Queries take a long time to execute.

**Solution:**

1. Reduce the time range of your query.
1. Add appropriate indexes to your tables.
1. Use the `$__timeFilter` macro to limit the data scanned.
1. Increase the **Min time interval** setting to reduce the number of data points.
1. Use `EXPLAIN ANALYZE` in PostgreSQL to identify query bottlenecks.
1. Consider using materialized views for complex aggregations.

## Provisioning errors

The following errors occur when provisioning the data source via YAML.

### Invalid provisioning configuration

**Error message:** "metric request error" or data source test fails after provisioning

**Cause:** The provisioning YAML file contains incorrect configuration.

**Solution:**

1. Ensure parameter names match the expected format exactly.
1. Verify the database name is **not** included in the URL.
1. Use the correct format for the URL: `hostname:port`.
1. Check that string values are properly quoted in the YAML file.
1. Refer to the [provisioning example](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/configure/#provision-the-data-source) for the correct format.

Example correct configuration:

```yaml
datasources:
  - name: Postgres
    type: postgres
    url: localhost:5432
    user: grafana
    secureJsonData:
      password: 'Password!'
    jsonData:
      database: grafana
      sslmode: 'disable'
```

## Other common issues

The following issues don't produce specific error messages but are commonly encountered.

### Empty query results

**Cause:** The query returns no data.

**Solution:**

1. Verify the time range includes data in your database.
1. Check that table and column names are correct.
1. Test the query directly in PostgreSQL.
1. Ensure filters are not excluding all data.
1. Verify the `$__timeFilter` macro is using the correct time column.

### TimescaleDB functions not available

**Cause:** TimescaleDB-specific functions like `time_bucket` are not available in the query builder.

**Solution:**

1. Enable the **TimescaleDB** toggle in the data source configuration under **PostgreSQL Options**.
1. Verify TimescaleDB is installed and enabled in your PostgreSQL database.
1. Check that the `timescaledb` extension is created: `CREATE EXTENSION IF NOT EXISTS timescaledb;`

### Data appears delayed or missing recent points

**Cause:** The visualization doesn't show the most recent data.

**Solution:**

1. Check the dashboard time range and refresh settings.
1. Verify the **Min time interval** is not set too high.
1. Ensure data has been committed to the database (not in an uncommitted transaction).
1. Check for clock synchronization issues between Grafana and PostgreSQL.

## Get additional help

If you continue to experience issues after following this troubleshooting guide:

1. Check the [PostgreSQL documentation](https://www.postgresql.org/docs/) for database-specific guidance.
1. Review the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Contact Grafana Support if you are a Cloud Pro, Cloud Contracted, or Enterprise user.
1. When reporting issues, include:
   - Grafana version
   - PostgreSQL version
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration such as data source settings, TLS mode, and connection limits (redact passwords and other credentials)
