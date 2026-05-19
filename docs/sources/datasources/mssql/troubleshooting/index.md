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
review_date: 2026-05-19
title: Troubleshoot Microsoft SQL Server data source issues
weight: 400
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
1. For Grafana Cloud, ensure you have configured [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if your SQL Server instance is not publicly accessible.

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
1. If Encrypt is **True**, verify that the SQL Server has a valid TLS certificate.
1. Check that the certificate is trusted by the Grafana server (either in the system CA bundle or specified in **TLS/SSL Root Certificate**).
1. If the certificate's hostname doesn't match the configured **Host** value (for example, when using a load balancer or PDC), set **Hostname in server certificate** to match the certificate's CN or SAN.
1. As a temporary workaround for testing, enable **Skip TLS Verify** (not recommended for production).
1. Ensure you're using the latest available service pack for your SQL Server version for optimal compatibility.

### TLS handshake failures with FIPS-enabled Grafana

**Error message:** "TLS handshake failed" or "no cipher suite supported by both client and server"

**Cause:** Grafana builds using BoringCrypto (FIPS-compliant builds) enforce FIPS 140-3 cipher requirements. SQL Server instances that only support older cipher suites (TLS 1.0, RC4, or 3DES) are incompatible with these builds.

**Solution:**

1. Upgrade the SQL Server instance to support TLS 1.2 with FIPS-approved cipher suites (AES-based).
1. On the SQL Server host, verify TLS 1.2 is enabled in the Windows registry or SQL Server Network Configuration.
1. If you cannot upgrade SQL Server, use a non-FIPS Grafana build.
1. Verify which TLS versions your SQL Server supports by checking the SQL Server error log for "TLS handshake" entries.

### TLS certificate errors through PDC

**Error message:** "certificate verify failed" or "x509: certificate signed by unknown authority" when connecting through Private data source connect

**Cause:** The SQL Server's TLS certificate must be verifiable from the PDC agent's perspective, not from Grafana Cloud. If the SQL Server uses a private CA certificate, the PDC agent host must trust that CA.

**Solution:**

1. Install the private CA certificate on the PDC agent host's system trust store.
1. Alternatively, specify the CA certificate path in the data source's **TLS/SSL Root Certificate** field (the path must be accessible from the PDC agent, not from Grafana Cloud).
1. If the certificate's hostname doesn't match what the PDC agent sees, set **Hostname in server certificate** to the correct value.
1. Verify the certificate is valid (not expired) from the PDC agent host: `openssl s_client -connect <SQL_SERVER_HOST>:1433 -starttls mssql`.

### Named instance connection issues

**Error message:** "Cannot connect to named instance" or connection fails when using instance name

**Cause:** Grafana cannot resolve the SQL Server named instance.

**Solution:**

1. Use the format `hostname\instancename` or `hostname\instancename,port` in the **Host** field.
1. Verify that the SQL Server Browser service is running on the SQL Server machine.
1. If the Browser service is unavailable, specify the port number directly: `hostname,port`.
1. Check that UDP port 1434 is open if using the SQL Server Browser service.

## Private data source connect (PDC) errors

These errors occur when using Grafana Cloud with Private data source connect to reach an on-premises or private-network SQL Server.

### "No such host" when connecting through PDC

**Error message:** "dial tcp: lookup sqlserver.internal.example.com: no such host"

**Cause:** The PDC agent cannot resolve the SQL Server hostname from its network. This commonly occurs when:

- The hostname in the data source configuration is a public DNS name that doesn't resolve inside the private network.
- The PDC agent host doesn't have access to the internal DNS server.
- A cluster or Availability Group Listener DNS entry is misconfigured.

**Solution:**

1. In the data source **Host** field, use the hostname as resolvable from the PDC agent's network (for example, the internal FQDN or IP address, not a public DNS name).
1. Verify the PDC agent host can resolve the hostname: run `nslookup <SQL_SERVER_HOST>` from the agent machine.
1. If using a cluster or Availability Group Listener, confirm the listener DNS record exists and resolves to the correct IP from the agent's network.
1. Check that the PDC agent host has the correct DNS servers configured.

### PDC connection breaks after maintenance or IP changes

**Cause:** The PDC SSH tunnel endpoint IP changed after infrastructure maintenance, breaking the established connection.

**Solution:**

1. Restart the PDC agent service to re-establish the SSH tunnel with the updated endpoint.
1. Verify the PDC agent status shows a healthy connection in **Connections** > **Private data source connect** in your Grafana Cloud stack.
1. If your network uses IP-based firewall rules for outbound traffic, update the allowlist. PDC endpoint IP addresses can change during maintenance windows.
1. Consider using DNS-based allowlisting instead of IP-based rules where possible to avoid future disruptions.

### Credentials not persisting with PDC enabled

**Cause:** A known issue can cause the data source username to not persist when PDC is enabled.

**Solution:**

1. After enabling PDC, save the data source configuration first, then re-enter the username and password and save again.
1. Click **Save & test** to verify the credentials are stored and the connection succeeds.
1. If the issue persists, try disabling PDC, saving credentials, then re-enabling PDC.

### Cannot connect to private SQL Server from Grafana Cloud

**Cause:** Attempting to connect to an on-premises or private-network SQL Server from Grafana Cloud without PDC configured.

**Solution:**

1. Grafana Cloud requires [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) for any SQL Server that isn't publicly accessible.
1. Firewall allowlisting alone doesn't work because Grafana Cloud data source connections don't use static IP addresses.
1. Install and configure a PDC agent on a host in your private network that can reach the SQL Server on port 1433.
1. Ensure the PDC agent host allows outbound connections on port 22 to the Grafana Cloud PDC endpoint.

For setup instructions, refer to [Connect to on-premises SQL Server from Grafana Cloud](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure/#connect-to-on-premises-sql-server-from-grafana-cloud).

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

### Login failed for user '' (empty username)

**Error message:** "Login failed for user ''"—the saved username appears blank when Grafana connects to SQL Server.

**Cause:** A known issue on certain Grafana release channels caused the SQL Server Authentication username to appear saved in the UI but send an empty string to the server during connection. This was identified on the "fast" release channel.

**Solution:**

1. Switch to the "steady" release channel if you're on "fast" and encounter this issue.
1. After upgrading or switching channels, open the data source configuration, re-enter the username and password, and click **Save & test** to confirm the credentials are stored correctly.
1. If the issue persists after re-saving, clear your browser cache and try again.

### Connection fails when password contains special characters

**Error message:** "Login failed for user" or "Connection string parse error" when credentials contain semicolons (`;`) or closing braces (`}`)

**Cause:** In Grafana versions prior to v13.0, semicolons and closing braces in usernames or passwords were not properly escaped in the MSSQL connection string, causing authentication failures.

**Solution:**

1. Upgrade to Grafana v13.0 or later, which correctly handles these special characters.
1. If you cannot upgrade, change the SQL Server password to avoid `;` and `}` characters.

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

1. Verify that the Kerberos configuration file (`krb5.conf`) path is correct in the data source settings. The default path is `/etc/krb5.conf`.
1. For keytab authentication, ensure the keytab file exists and is readable by the Grafana service account.
1. Check that the realm and KDC settings are correct in the Kerberos configuration.
1. Verify DNS is correctly resolving the KDC servers.
1. Ensure the service principal name (SPN) is registered for the SQL Server instance.

{{< admonition type="note" >}}
Kerberos authentication is not supported in Grafana Cloud. Use SQL Server Authentication or Azure Entra ID instead.
{{< /admonition >}}

<!-- vale Grafana.Spelling = NO -->

### KDC_ERR_C_PRINCIPAL_UNKNOWN with Availability Group Listeners

**Error message:** "KDC_ERR_C_PRINCIPAL_UNKNOWN" when connecting through a SQL Server Availability Group Listener

**Cause:** The SPN registered for the SQL Server instance doesn't match the Availability Group Listener's DNS name. Kerberos authentication requires an SPN that matches the hostname the client connects to.

**Solution:**

1. Register an SPN for the Availability Group Listener DNS name:

   ```text
   setspn -S MSSQLSvc/<LISTENER_FQDN>:1433 <DOMAIN>\<SERVICE_ACCOUNT>
   setspn -S MSSQLSvc/<LISTENER_FQDN> <DOMAIN>\<SERVICE_ACCOUNT>
   ```

1. Verify the SPN is correctly registered: `setspn -L <DOMAIN>\<SERVICE_ACCOUNT>`.
1. Ensure `krb5.conf` includes the correct realm mapping for the listener's domain.
1. If using multiple realms, add cross-realm trust entries to `krb5.conf`.

### Untrusted domain errors with Windows Authentication

**Error message:** "The login is from an untrusted domain and cannot be used with Windows authentication"

**Cause:** The Grafana server's domain isn't trusted by the SQL Server's domain, or the Kerberos realm configuration doesn't map correctly between domains.

**Solution:**

1. Verify that a trust relationship exists between the Grafana server's domain and the SQL Server's domain.
1. Check that `krb5.conf` includes realm mappings for both domains:

   ```ini
   [realms]
   DOMAIN_A.COM = {
     kdc = kdc1.domain_a.com
   }
   DOMAIN_B.COM = {
     kdc = kdc1.domain_b.com
   }

   [domain_realm]
   .domain_a.com = DOMAIN_A.COM
   .domain_b.com = DOMAIN_B.COM
   ```

1. Ensure the SQL Server service account has delegation permissions if cross-domain access is needed.
1. As an alternative, use SQL Server Authentication or Azure Entra ID (App Registration), which don't require domain trust.

<!-- vale Grafana.Spelling = YES -->

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

For detailed Azure authentication configuration, refer to [Configure the Microsoft SQL Server data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure/).

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

For more information on using stored procedures, refer to the [query editor documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/query-editor/).

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

**Error message:** "Too many connections", "Connection pool exhausted", or "failed to connect to server"

**Cause:** Too many concurrent connections to the database. This commonly manifests as intermittent alert failures while dashboards continue to work, because alert evaluations and dashboard queries compete for connections from the same pool.

**Solution:**

1. Increase the **Max open** connection limit in the data source configuration. A value of `50` to `100` handles most deployments with concurrent dashboards and alerts.
1. Enable **Auto max idle** to automatically manage idle connections.
1. Set **Max lifetime** to `14400` (4 hours) to ensure stale connections are recycled.
1. Reduce the number of panels querying the same data source simultaneously, or split heavy dashboards into multiple pages.
1. Check for long-running queries that might be holding connections open (review SQL Server's `sys.dm_exec_sessions`).
1. If alerts fail intermittently but dashboards work, this is a strong indicator of pool exhaustion under concurrent load.

### Slow dashboard load with read-only replicas

**Symptoms:** Dashboards take 5 to 6 minutes to load initially, or queries are significantly slower than expected.

**Cause:** The data source is configured with `ApplicationIntent=ReadOnly` in the **Host** field, which routes all queries to a read-only secondary replica. If the replica is undersized, under-indexed, or experiencing replication lag, queries run much slower than on the primary.

**Solution:**

1. Remove `ApplicationIntent=ReadOnly` from the Host field to route queries back to the primary instance.
1. If you need to use a read-only replica, ensure it has the same indexes and resources as the primary.
1. Check the replica's replication lag and resource utilization (CPU, I/O) during slow periods.
1. Consider creating a separate data source for replica queries and using it only for specific dashboards that don't require low latency.

## Other common issues

The following issues don't produce specific error messages but are commonly encountered.

### Configuration form not displaying

**Symptoms:** The data source settings page shows only **Delete** and **Back** buttons with no configuration fields.

**Cause:** The logged-in user has insufficient permissions to configure data sources. Only users with the `Organization administrator` role (or a custom RBAC role with `datasources:write` permissions) can access the data source configuration form.

**Solution:**

1. Ask an organization administrator to grant you the `Organization administrator` role, or assign you a custom RBAC role with data source write permissions.
1. Alternatively, ask an administrator to configure the data source on your behalf or use [provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/) to define the data source in YAML.

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
1. Contact [Grafana Support](https://grafana.com/contact/) if you're an Enterprise or Cloud customer.

When reporting issues, include:

- Grafana version
- SQL Server version
- Error messages (redact sensitive information)
- Steps to reproduce
- Relevant query examples (redact sensitive data)
