---
description: Troubleshoot common problems with the Microsoft SQL Server data source in Grafana
keywords:
  - grafana
  - MSSQL
  - Microsoft
  - SQL
  - troubleshooting
  - errors
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot the Microsoft SQL Server data source
weight: 400
refs:
  configure-mssql-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure/
  mssql-query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/query-editor/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
---

# Troubleshoot Microsoft SQL Server data source issues

This document provides solutions to common issues you may encounter when configuring or using the Microsoft SQL Server (MSSQL) data source in Grafana.

## Connection errors

These errors occur when Grafana cannot establish or maintain a connection to the Microsoft SQL Server.

### Unable to connect to the server

**Error message:** "Unable to open tcp connection" or "dial tcp: connection refused"

**Cause:** Grafana cannot establish a network connection to the SQL Server.

**Solution:**

1. Verify that the SQL Server is running and accessible.
1. Check that the host and port are correct in the data source configuration. The default SQL Server port is `1433`.
1. Ensure there are no firewall rules blocking the connection between Grafana and SQL Server.
1. Verify that SQL Server is configured to allow remote connections.
1. For Grafana Cloud, ensure you have configured [Private data source connect](ref:private-data-source-connect) if your SQL Server instance is not publicly accessible.

### Connection timeout

**Error message:** "Connection timed out" or "I/O timeout"

**Cause:** The connection to SQL Server timed out before receiving a response.

**Solution:**

1. Check the network latency between Grafana and SQL Server.
1. Verify that SQL Server is not overloaded or experiencing performance issues.
1. Increase the **Connection timeout** setting in the data source configuration under **Additional settings**.
1. Check if any network devices (load balancers, proxies) are timing out the connection.

### Encryption-related connection failures

**Error message:** "TLS handshake failed" or "certificate verify failed"

**Cause:** There is a mismatch between the encryption settings in Grafana and what the SQL Server supports or requires.

**Solution:**

1. For older versions of SQL Server (2008, 2008R2), set the **Encrypt** option to **Disable** or **False** in the data source configuration.
1. Verify that the SQL Server has a valid SSL certificate if encryption is enabled.
1. Check that the certificate is trusted by the Grafana server.
1. Ensure you're using the latest available service pack for your SQL Server version for optimal compatibility.

### Named instance connection issues

**Error message:** "Cannot connect to named instance" or connection fails when using instance name

**Cause:** Grafana cannot resolve the SQL Server named instance.

**Solution:**

1. Use the format `hostname\instancename` or `hostname\instancename,port` in the **Host** field.
1. Verify that the SQL Server Browser service is running on the SQL Server machine.
1. If the Browser service is unavailable, specify the port number directly: `hostname,port`.
1. Check that UDP port 1434 is open if using the SQL Server Browser service.

## Authentication errors

These errors occur when there are issues with authentication credentials or permissions.

### Login failed for user

**Error message:** "Login failed for user 'username'" or "Authentication failed"

**Cause:** The authentication credentials are invalid or the user doesn't have permission to access the database.

**Solution:**

1. Verify that the username and password are correct.
1. Check that the user exists in SQL Server and is enabled.
1. Ensure the user has access to the specified database.
1. For Windows Authentication, verify that the credentials are in the correct format (`DOMAIN\User`).
1. Check that the SQL Server authentication mode allows the type of login you're using (SQL Server Authentication, Windows Authentication, or Mixed Mode).

### Access denied to database

**Error message:** "Cannot open database 'dbname' requested by the login"

**Cause:** The authenticated user doesn't have permission to access the specified database.

**Solution:**

1. Verify that the database name is correct in the data source configuration.
1. Ensure the user is mapped to the database with appropriate permissions.
1. Grant at least `SELECT` permission on the required tables:

   ```sql
   USE [your_database]
   GRANT SELECT ON dbo.YourTable TO [your_user]
   ```

1. Check that the user doesn't have any conflicting permissions from the public role.

### Windows Authentication (Kerberos) issues

**Error message:** "Kerberos authentication failed" or "Cannot initialize Kerberos"

**Cause:** Kerberos configuration is incorrect or incomplete.

**Solution:**

1. Verify that the Kerberos configuration file (`krb5.conf`) path is correct in the data source settings.
1. For keytab authentication, ensure the keytab file exists and is readable by Grafana.
1. Check that the realm and KDC settings are correct in the Kerberos configuration.
1. Verify DNS is correctly resolving the KDC servers.
1. Ensure the service principal name (SPN) is registered for the SQL Server instance.

{{< admonition type="note" >}}
Kerberos authentication is not supported in Grafana Cloud.
{{< /admonition >}}

### Azure Entra ID authentication errors

**Error message:** "AADSTS error codes" or "Azure AD authentication failed"

**Cause:** Azure Entra ID (formerly Azure AD) authentication is misconfigured.

**Solution:**

1. For **App Registration** authentication:
   - Verify the tenant ID, client ID, and client secret are correct.
   - Ensure the app registration has been added as a user in the Azure SQL database.
   - Check that the client secret hasn't expired.

1. For **Managed Identity** authentication:
   - Verify `managed_identity_enabled = true` is set in the Grafana server configuration.
   - Ensure the managed identity has been added to the Azure SQL database.
   - Confirm the Azure resource hosting Grafana has managed identity enabled.

1. For **Current User** authentication:
   - Ensure `user_identity_enabled = true` is set in the Grafana server configuration.
   - Verify the app registration is configured to issue both Access Tokens and ID Tokens.
   - Check that the required API permissions are configured (`user_impersonation` for Azure SQL).

For detailed Azure authentication configuration, refer to [Configure the Microsoft SQL Server data source](ref:configure-mssql-data-source).

## Query errors

These errors occur when there are issues with query syntax or configuration.

### Time column not found or invalid

**Error message:** "Could not find time column" or time series visualization shows no data

**Cause:** The query doesn't return a properly formatted `time` column for time series visualization.

**Solution:**

1. Ensure your query includes a column named `time` when using the **Time series** format.
1. Use the `$__time()` macro to rename your date column: `$__time(your_date_column)`.
1. Verify the time column is of a valid SQL date/time type (`datetime`, `datetime2`, `date`) or contains Unix epoch values.
1. Ensure the result set is sorted by the time column using `ORDER BY`.

### Macro expansion errors

**Error message:** "Error parsing query" or macros appear unexpanded in the query

**Cause:** Grafana macros are being used incorrectly.

**Solution:**

1. Verify macro syntax: use `$__timeFilter(column)` not `$_timeFilter(column)`.
1. Macros don't work inside stored procedures—use explicit date parameters instead.
1. Check that the column name passed to macros exists in your table.
1. View the expanded query by clicking **Generated SQL** after running the query to debug macro expansion.

### Timezone and time shift issues

**Cause:** Time series data appears shifted or doesn't align with expected times.

**Solution:**

1. Store timestamps in UTC in your database to avoid timezone issues.
1. Time macros (`$__time`, `$__timeFilter`, etc.) always expand to UTC values.
1. If your timestamps are stored in local time, convert them to UTC in your query:

   ```sql
   SELECT
     your_datetime_column AT TIME ZONE 'Your Local Timezone' AT TIME ZONE 'UTC' AS time,
     value
   FROM your_table
   ```

1. Don't pass timezone parameters to time macros—they're not supported.

### Query returns too many rows

**Error message:** "Result set too large" or browser becomes unresponsive

**Cause:** The query returns more data than can be efficiently processed.

**Solution:**

1. Add time filters using `$__timeFilter(column)` to limit data to the dashboard time range.
1. Use aggregations (`AVG`, `SUM`, `COUNT`) with `GROUP BY` instead of returning raw rows.
1. Add a `TOP` clause to limit results: `SELECT TOP 1000 ...`.
1. Use the `$__timeGroup()` macro to aggregate data into time intervals.

### Stored procedure returns no data

**Cause:** Stored procedure output isn't being captured correctly.

**Solution:**

1. Ensure the stored procedure uses `SELECT` statements, not just variable assignments.
1. Remove `SET NOCOUNT ON` if present, or ensure it's followed by a `SELECT` statement.
1. Verify the stored procedure parameters are being passed correctly.
1. Test the stored procedure directly in SQL Server Management Studio with the same parameters.

For more information on using stored procedures, refer to the [query editor documentation](ref:mssql-query-editor).

## Performance issues

These issues relate to slow queries or high resource usage.

### Slow query execution

**Cause:** Queries take a long time to execute.

**Solution:**

1. Reduce the dashboard time range to limit data volume.
1. Add indexes to columns used in `WHERE` clauses and time filters.
1. Use aggregations instead of returning individual rows.
1. Increase the **Min time interval** setting to reduce the number of data points.
1. Review the query execution plan in SQL Server Management Studio to identify bottlenecks.

### Connection pool exhaustion

**Error message:** "Too many connections" or "Connection pool exhausted"

**Cause:** Too many concurrent connections to the database.

**Solution:**

1. Increase the **Max open** connection limit in the data source configuration.
1. Enable **Auto max idle** to automatically manage idle connections.
1. Reduce the number of panels querying the same data source simultaneously.
1. Check for long-running queries that might be holding connections.

## Other common issues

The following issues don't produce specific error messages but are commonly encountered.

### System databases appear in queries

**Cause:** Queries accidentally access system databases.

**Solution:**

1. The query editor automatically excludes `tempdb`, `model`, `msdb`, and `master` from the database dropdown.
1. Always specify the database in your data source configuration to restrict access.
1. Ensure the database user only has permissions on the intended database.

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

## Get additional help

If you continue to experience issues after following this troubleshooting guide:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Enable debug logging in Grafana to capture detailed error information.
1. Check SQL Server logs for additional error details.
1. Contact Grafana Support if you're an Enterprise or Cloud customer.

When reporting issues, include:

- Grafana version
- SQL Server version
- Error messages (redact sensitive information)
- Steps to reproduce
- Relevant query examples (redact sensitive data)
