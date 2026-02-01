---
aliases:
  - ../troubleshoot/
description: Troubleshoot common problems with the MySQL data source in Grafana
keywords:
  - grafana
  - mysql
  - troubleshooting
  - errors
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot MySQL data source issues
weight: 400
refs:
  configure-mysql-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/configure/
  mysql-query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/query-editor/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
---

# Troubleshoot MySQL data source issues

This document provides solutions to common issues you may encounter when configuring or using the MySQL data source in Grafana.

## Connection errors

These errors occur when Grafana cannot establish or maintain a connection to the MySQL server.

### Unable to connect to the server

**Error message:** "dial tcp: connection refused" or "Could not connect to MySQL"

**Cause:** Grafana cannot establish a network connection to the MySQL server.

**Solution:**

1. Verify that the MySQL server is running and accessible.
1. Check that the host and port are correct in the data source configuration. The default MySQL port is `3306`.
1. Ensure there are no firewall rules blocking the connection between Grafana and MySQL.
1. Verify that MySQL is configured to allow remote connections by checking the `bind-address` setting in your MySQL configuration.
1. For Grafana Cloud, ensure you have configured [Private data source connect](ref:private-data-source-connect) if your MySQL instance isn't publicly accessible.

### Connection timeout

**Error message:** "Connection timed out" or "I/O timeout"

**Cause:** The connection to MySQL timed out before receiving a response.

**Solution:**

1. Check the network latency between Grafana and MySQL.
1. Verify that MySQL isn't overloaded or experiencing performance issues.
1. Check if any network devices (load balancers, proxies) are timing out the connection.
1. Increase the `wait_timeout` setting in MySQL if connections are timing out during idle periods.

### TLS/SSL connection failures

**Error message:** "TLS handshake failed" or "x509: certificate verify failed"

**Cause:** There is a mismatch between the TLS settings in Grafana and what the MySQL server supports or requires.

**Solution:**

1. Verify that the MySQL server has a valid SSL certificate if encryption is enabled.
1. Check that the certificate is trusted by the Grafana server.
1. If using a self-signed certificate, enable **With CA Cert** and provide the root certificate under **TLS/SSL Root Certificate**.
1. To bypass certificate validation (not recommended for production), enable **Skip TLS Verification** in the data source configuration.
1. Ensure the SSL certificate hasn't expired.

### Connection reset by peer

**Error message:** "Connection reset by peer" or "EOF"

**Cause:** The MySQL server closed the connection unexpectedly.

**Solution:**

1. Check the `max_connections` setting on the MySQL server to ensure it isn't being exceeded.
1. Verify the `wait_timeout` and `interactive_timeout` settings in MySQL aren't set too low.
1. Increase the **Max lifetime** setting in Grafana's data source configuration to be lower than the MySQL `wait_timeout`.
1. Check MySQL server logs for any errors or connection-related messages.

## Authentication errors

These errors occur when there are issues with authentication credentials or permissions.

### Access denied for user

**Error message:** "Access denied for user 'username'@'host'" or "Authentication failed"

**Cause:** The authentication credentials are invalid or the user doesn't have permission to connect from the Grafana server's host.

**Solution:**

1. Verify that the username and password are correct.
1. Check that the user exists in MySQL and is enabled.
1. Ensure the user has permission to connect from the Grafana server's IP address. MySQL restricts access based on the connecting host:

   ```sql
   SELECT user, host FROM mysql.user WHERE user = 'your_user';
   ```

1. If necessary, create a user that can connect from the Grafana server:

   ```sql
   CREATE USER 'grafana'@'grafana_server_ip' IDENTIFIED BY 'password';
   ```

1. If using the `mysql_native_password` authentication plugin, ensure it's enabled on the server.

### Cannot access database

**Error message:** "Access denied for user 'username'@'host' to database 'dbname'"

**Cause:** The authenticated user doesn't have permission to access the specified database.

**Solution:**

1. Verify that the database name is correct in the data source configuration.
1. Ensure the user has the required permissions on the database:

   ```sql
   GRANT SELECT ON your_database.* TO 'grafana'@'grafana_server_ip';
   FLUSH PRIVILEGES;
   ```

1. For production environments, grant permissions only on specific tables:

   ```sql
   GRANT SELECT ON your_database.your_table TO 'grafana'@'grafana_server_ip';
   ```

### PAM authentication issues

**Error message:** "Authentication plugin 'auth_pam' cannot be loaded" or cleartext password errors

**Cause:** PAM (Pluggable Authentication Modules) authentication requires cleartext password transmission.

**Solution:**

1. Enable **Allow Cleartext Passwords** in the data source configuration if using PAM authentication.
1. Ensure TLS is enabled to protect password transmission when using cleartext passwords.
1. Verify that the PAM plugin is correctly installed and configured on the MySQL server.

## Query errors

These errors occur when there are issues with query syntax or configuration.

### Time column not found or invalid

**Error message:** "Could not find time column" or time series visualization shows no data

**Cause:** The query doesn't return a properly formatted `time` column for time series visualization.

**Solution:**

1. Ensure your query includes a column named `time` when using the **Time series** format.
1. Use the `$__time()` macro to convert your date column: `$__time(your_date_column)`.
1. Verify the time column is of a valid MySQL date/time type (`DATETIME`, `TIMESTAMP`, `DATE`) or contains Unix epoch values.
1. Ensure the result set is sorted by the time column using `ORDER BY`.

### Macro expansion errors

**Error message:** "Error parsing query" or macros appear unexpanded in the query

**Cause:** Grafana macros are being used incorrectly.

**Solution:**

1. Verify macro syntax: use `$__timeFilter(column)` not `$_timeFilter(column)`.
1. Check that the column name passed to macros exists in your table.
1. View the expanded query by clicking **Generated SQL** after running the query to debug macro expansion.
1. Ensure backticks are used for reserved words or special characters in column names: `$__timeFilter(\`time-column\`)`.

### Timezone and time shift issues

**Cause:** Time series data appears shifted or doesn't align with expected times.

**Solution:**

1. Store timestamps in UTC in your database to avoid timezone issues.
1. Time macros (`$__time`, `$__timeFilter`, etc.) always expand to UTC values.
1. Set the **Session Timezone** in the data source configuration to match your data's timezone, or use `+00:00` for UTC.
1. If your timestamps are stored in local time, convert them to UTC in your query:

   ```sql
   SELECT
     CONVERT_TZ(your_datetime_column, 'Your/Timezone', 'UTC') AS time,
     value
   FROM your_table
   ```

### Query returns too many rows

**Error message:** "Result set too large" or browser becomes unresponsive

**Cause:** The query returns more data than can be efficiently processed.

**Solution:**

1. Add time filters using `$__timeFilter(column)` to limit data to the dashboard time range.
1. Use aggregations (`AVG`, `SUM`, `COUNT`) with `GROUP BY` instead of returning raw rows.
1. Add a `LIMIT` clause to restrict results: `SELECT ... LIMIT 1000`.
1. Use the `$__timeGroup()` macro to aggregate data into time intervals.

### Syntax error in SQL statement

**Error message:** "You have an error in your SQL syntax" followed by specific error details

**Cause:** The SQL query contains invalid syntax.

**Solution:**

1. Check for missing or extra commas, parentheses, or quotes.
1. Ensure reserved words used as identifiers are enclosed in backticks: `` `table` ``, `` `select` ``.
1. Verify that template variable syntax is correct: `$variable` or `${variable}`.
1. Test the query directly in a MySQL client to isolate Grafana-specific issues.

### Unknown column in field list

**Error message:** "Unknown column 'column_name' in 'field list'"

**Cause:** The specified column doesn't exist in the table or is misspelled.

**Solution:**

1. Verify the column name is spelled correctly.
1. Check that the column exists in the specified table.
1. If the column name contains special characters or spaces, enclose it in backticks: `` `column-name` ``.
1. Ensure the correct database is selected if you're referencing columns without the full table path.

## Performance issues

These issues relate to slow queries or high resource usage.

### Slow query execution

**Cause:** Queries take a long time to execute.

**Solution:**

1. Reduce the dashboard time range to limit data volume.
1. Add indexes to columns used in `WHERE` clauses and time filters:

   ```sql
   CREATE INDEX idx_time ON your_table(time_column);
   ```

1. Use aggregations instead of returning individual rows.
1. Increase the **Min time interval** setting to reduce the number of data points.
1. Review the query execution plan using `EXPLAIN` to identify bottlenecks:

   ```sql
   EXPLAIN SELECT * FROM your_table WHERE time_column > NOW() - INTERVAL 1 HOUR;
   ```

### Connection pool exhaustion

**Error message:** "Too many connections" or "Connection pool exhausted"

**Cause:** Too many concurrent connections to the database.

**Solution:**

1. Increase the **Max open** connection limit in the data source configuration.
1. Enable **Auto (max idle)** to automatically manage idle connections.
1. Reduce the number of panels querying the same data source simultaneously.
1. Check for long-running queries that might be holding connections.
1. Increase the `max_connections` setting in MySQL if necessary:

   ```sql
   SHOW VARIABLES LIKE 'max_connections';
   SET GLOBAL max_connections = 200;
   ```

### Query timeout

**Error message:** "Query execution was interrupted" or "Lock wait timeout exceeded"

**Cause:** The query takes too long and exceeds the configured timeout.

**Solution:**

1. Optimize the query by adding appropriate indexes.
1. Reduce the amount of data being queried by narrowing the time range.
1. Use aggregations to reduce the result set size.
1. Check for table locks that might be blocking the query.

## Other common issues

The following issues don't produce specific error messages but are commonly encountered.

### Template variable queries fail

**Cause:** Variable queries return unexpected results or errors.

**Solution:**

1. Verify the variable query syntax is valid SQL that returns a single column.
1. Check that the data source connection is working.
1. Ensure the user has permission to access the tables referenced in the variable query.
1. Test the query in the query editor before using it as a variable query.

### Data appears incorrect or misaligned

**Cause:** Data formatting or type conversion issues.

**Solution:**

1. Use explicit column aliases to ensure consistent naming: `SELECT value AS metric`.
1. Verify numeric columns are actually numeric types, not strings.
1. Check for `NULL` values that might affect aggregations.
1. Use the `FILL` option in `$__timeGroup()` macro to handle missing data points.

### Special characters in database or table names

**Cause:** Queries fail when tables or databases contain reserved words or special characters.

**Solution:**

1. Enclose identifiers with special characters in backticks: `` `my-database`.`my-table` ``.
1. The query editor automatically handles this for selections, but manual queries require backticks.
1. Avoid using reserved words as identifiers when possible.

### An unexpected error happened

**Error message:** "An unexpected error happened"

**Cause:** A general error occurred that doesn't have a specific error message.

**Solution:**

1. Check the Grafana server logs for more details about the error.
1. Verify all data source configuration settings are correct.
1. Test the connection using the **Save & test** button.
1. Ensure the MySQL server is accessible and responding to queries.
1. For Grafana Cloud customers, contact support for assistance.

## Get additional help

If you continue to experience issues after following this troubleshooting guide:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Enable debug logging in Grafana to capture detailed error information.
1. Check MySQL error logs for additional details.
1. Contact Grafana Support if you're an Enterprise or Cloud customer.

When reporting issues, include:

- Grafana version
- MySQL version
- Error messages (redact sensitive information)
- Steps to reproduce
- Relevant query examples (redact sensitive data)
