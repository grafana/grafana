---
aliases:
  - ../../data-sources/mssql/
description: This document provides instructions for configuring the MSSQL data source.
keywords:
  - grafana
  - MSSQL
  - Microsoft
  - SQL
  - guide
  - Azure SQL Database
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
review_date: 2026-05-19
title: Configure the Microsoft SQL Server data source
weight: 200
---

# Configure the Microsoft SQL Server data source

This document provides instructions for configuring the Microsoft SQL Server data source and explains available configuration options. For general information on adding and managing data sources, refer to [Grafana data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/) and [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

{{< admonition type="note" >}}
This page documents the **Microsoft SQL Server data source**, which lets you query an existing SQL Server database and visualize the results in Grafana. This is different from the [Microsoft SQL Server integration](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-mssql/) (available in Grafana Cloud), which uses Grafana Alloy to collect performance metrics _about_ your SQL Server instance (CPU, memory, connections, and similar). If you want to monitor the health of SQL Server itself, refer to the integration documentation instead.
{{< /admonition >}}

## Before you begin

Before configuring the Microsoft SQL Server data source, ensure you have the following:

- **Grafana permissions:** You must have the `Organization administrator` role to add and configure data sources. Users with the `Editor` or `Viewer` role cannot access the data source configuration form unless granted additional permissions through [RBAC](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/). Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- **A running SQL Server instance:** Microsoft SQL Server 2012 or newer, Azure SQL Database, or Azure SQL Managed Instance.

- **Network access:** Grafana must be able to reach your SQL Server. The default port is `1433`.

- **Authentication credentials:** Depending on your authentication method, you need one of:
  - SQL Server login credentials (username and password).
  - Windows/Kerberos credentials and configuration (not supported in Grafana Cloud).
  - Azure Entra ID app registration or managed identity.

- **Security certificates:** If using encrypted connections, gather any necessary TLS/SSL certificates.

{{< admonition type="note" >}}
Grafana ships with a built-in Microsoft SQL Server data source plugin. No additional installation is required.
{{< /admonition >}}

{{< admonition type="tip" >}}
**Grafana Cloud users:** If your SQL Server is in a private network, you can configure [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) to establish connectivity.
{{< /admonition >}}

## Add the MSSQL data source

To add the MSSQL data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**
1. Type `Microsoft SQL Server` in the search bar.
1. Select **Microsoft SQL Server** under data source.
1. Click **Add new data source** in the upper right.

Grafana takes you to the **Settings** tab, where you will set up your Microsoft SQL Server configuration.

## Configure the data source in the UI

Following are configuration options for the Microsoft SQL Server data source.

{{< admonition type="warning" >}}
Kerberos is not supported in Grafana Cloud.
{{< /admonition >}}

| **Setting** | **Description**                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**    | The data source name. Sets the name you use to refer to the data source in panels and queries. Examples: `MSSQL-1`, `MSSQL_Sales1`.        |
| **Default** | Toggle to select as the default name in dashboard panels. When you go to a dashboard panel, this will be the default selected data source. |

**Connection:**

| Setting      | Description                                                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Host**     | Sets the IP address or hostname (and optional port) of your MSSQL instance. The default port is `0`, which uses the driver's default. You can include additional connection properties (for example, `ApplicationIntent`) by separating them with semicolons (`;`). |
| **Database** | Sets the name of the MSSQL database to connect to.                                                                                                                                                                                                                |

{{< admonition type="caution" >}}
If you add `ApplicationIntent=ReadOnly` to the Host field to route queries to a read-only replica, be aware that read-only replicas may be significantly slower than the primary. This can cause dashboard load times of several minutes. Only use `ApplicationIntent=ReadOnly` if your replica is sized for the query workload and you've tested performance.
{{< /admonition >}}

**TLS/SSL encryption:**

The **Encrypt** setting determines whether and to what extent a secure TLS/SSL connection is negotiated with the server.

| Encrypt setting | Description                                                                                      | When to use |
| --------------- | ------------------------------------------------------------------------------------------------ | --- |
| **Disable**     | Data sent between the client and server is **not encrypted**.                                     | Legacy environments where encryption isn't supported or required. Not recommended for production. |
| **False**       | The default setting. Only the login packet is encrypted; **all other data is sent unencrypted**. | Development environments or when SQL Server doesn't have a valid certificate. |
| **True**        | **All data** sent between the client and server is **encrypted**.                                | Production environments. Required for Azure SQL Database. |

When **Encrypt** is set to **True**, the following additional TLS options are available:

| Setting | Description | Default |
| --- | --- | --- |
| **Skip TLS Verify** | If enabled, the server's certificate chain and hostname aren't validated. Equivalent to `trustServerCertificate=true` in the connection string. | Disabled |
| **TLS/SSL Root Certificate** | Path to a PEM-encoded CA certificate file used to verify the server's certificate. Required when the SQL Server uses a certificate signed by a private CA. | System CA bundle |
| **Hostname in server certificate** | The expected hostname in the server's TLS certificate. Use this when the certificate's Common Name (CN) or Subject Alternative Name (SAN) doesn't match the configured hostname (for example, when connecting through a load balancer or PDC). | Value from **Host** field |

**Choosing the right encryption configuration:**

| Scenario | Encrypt | Skip TLS Verify | Root Certificate | Notes |
| --- | --- | --- | --- | --- |
| Azure SQL Database | True | No | Not needed | Azure SQL always requires encryption and uses a publicly trusted certificate. |
| SQL Server with public CA certificate | True | No | Not needed | Certificate is already in the system trust store. |
| SQL Server with private/self-signed certificate | True | No | Path to CA cert | Upload or reference the CA certificate that signed the SQL Server certificate. |
| SQL Server with unverified certificate (testing only) | True | Yes | Not needed | Skips certificate validation entirely. Don't use in production. |
| SQL Server 2008/2008R2 without valid certificate | Disable or False | N/A | N/A | Older versions may not support TLS negotiation. |
| Grafana Cloud with PDC | True | No | Not needed (usually) | PDC tunnels are encrypted at the SSH layer; the TLS certificate must still be valid from the PDC agent's perspective. |

{{< admonition type="note" >}}
If you're using an older version of Microsoft SQL Server like 2008 or 2008R2, you may need to set Encrypt to **Disable** or **False** to connect.
{{< /admonition >}}

{{< admonition type="caution" >}}
Grafana builds using BoringCrypto (FIPS-compliant builds) enforce FIPS 140-3 cipher requirements. If your SQL Server only supports older cipher suites (for example, TLS 1.0 or RC4-based ciphers), connections from a FIPS-enabled Grafana instance fail with a TLS handshake error. Upgrade your SQL Server TLS configuration to support TLS 1.2 with FIPS-approved cipher suites.
{{< /admonition >}}

**Authentication:**

| Authentication Type                                   | Description                                                                                                                     | Credentials / Fields                                                                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SQL Server Authentication**                         | Default method to connect to MSSQL. Use a SQL Server or Windows login in `DOMAIN\User` format.                                  | - **Username**: SQL Server username<br>- **Password**: SQL Server password                                                                                                                |
| **Windows Authentication**<br>(Integrated Security)   | Uses the logged-in Windows user's credentials via single sign-on. Available only when SQL Server allows Windows Authentication. | No input required; uses the logged-in Windows user's credentials                                                                                                                          |
| **Windows AD**<br>(Username/Password)                 | Authenticates a domain user with their Active Directory username and password.                                                  | - **Username**: `user@example.com`<br>- **Password**: Active Directory password                                                                                                           |
| **Windows AD**<br>(Keytab)                            | Authenticates a domain user using a keytab file.                                                                                | - **Username**: `user@example.com`<br>- **Keytab file path**: Path to your keytab file                                                                                                    |
| **Windows AD**<br>(Credential Cache)                  | Uses a Kerberos credential cache already loaded in memory (e.g., from a prior `kinit` command). No file needed.                 | - **Credential cache path**: Path to in-memory credential (e.g., `/tmp/krb5cc_1000`)                                                                                                      |
| **Windows AD**<br>(Credential Cache File)             | Authenticates a domain user using a credential cache file (`.ccache`).                                                          | - **Username**: `user@example.com`<br>- **Credential cache file path**: e.g., `/home/grot/cache.json`                                                                                     |
| **Azure Entra ID (formerly Azure AD) Authentication** | Authenticates the data source using Azure authentication methods.                                                               | Details on the supported authentication methods and how to configure them can be found in the [Azure authentication section](./index.md#azure-entra-id-formerly-azure-ad-authentication). |

{{< admonition type="note" >}}
As of Grafana v13.0, passwords and usernames that contain semicolons (`;`) or closing braces (`}`) are handled correctly. If you previously encountered connection failures due to special characters in credentials, upgrade to Grafana v13.0 or later.
{{< /admonition >}}

**Additional settings:**

Additional settings are optional settings you configure for more control over your data source. This includes connection limits, connection timeout, group-by time interval, and Secure Socks Proxy.

**Connection limits:**

Grafana maintains a connection pool for each configured MSSQL data source. These settings control pool behavior and directly affect performance, especially under concurrent load from dashboards and alerting.

| Setting           | Description                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Max open**      | The maximum number of open connections to the database. If set to `0`, there is no limit. If `max open` is greater than `0` and less than `max idle`, `max idle` is adjusted to match.       |
| **Auto max idle** | When enabled, automatically sets `max idle` to match `max open`. If `max open` isn’t set, it defaults to `100`.                                                                              |
| **Max idle**      | The maximum number of idle connections in the pool. If `max open` is set and is lower than `max idle`, then `max idle` is reduced to match. If set to `0`, no idle connections are retained. |
| **Max lifetime**  | The maximum time (in seconds) a connection can be reused before being closed and replaced. If set to `0`, connections are reused indefinitely.                                               |

{{< admonition type="caution" >}}
If **Max open** is set too low, concurrent dashboard panels and alert rule evaluations compete for connections. Alerting queries may fail with "failed to connect to server" while dashboards continue to work, because alert evaluations use a separate execution path that can't wait indefinitely for a free connection. Increase **Max open** if you see intermittent alert failures.
{{< /admonition >}}

**Connection details:**

| **Setting**            | **Description**                                                                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Min time interval**  | Specifies the lower bound for the auto-generated `GROUP BY` time interval. Grafana recommends matching this value to your data's write frequency—for example, `1m` if data is written every minute. Refer to [Min time interval](#min-time-interval) for details. |
| **Connection timeout** | Specifies the maximum number of seconds to wait when attempting to connect to the database before timing out. A value of `0` (the default) disables the timeout.                                                                                                  |

**Windows AD Advanced settings:**

| Setting                   | Description                                                                                                                                                                                                             | Default              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **UDP Preference Limit**  | Defines the maximum packet size (in bytes) that Kerberos libraries attempt to send over UDP before retrying with TCP. A value of `1` forces all communication to use TCP.                                               | `1` (always use TCP) |
| **DNS Lookup KDC**        | Controls whether DNS `SRV` records are used to locate [Key Distribution Centers (KDCs)](https://web.mit.edu/kerberos/krb5-latest/doc/admin/realm_config.html#key-distribution-centers) and other servers for the realm. | `true`               |
| **krb5 config file path** | Specifies the path to the Kerberos configuration file used by the [MIT krb5 package](https://web.mit.edu/kerberos/krb5-1.12/doc/admin/conf_files/krb5_conf.html).                                                       | `/etc/krb5.conf`     |

<!-- vale Grafana.Spelling = NO -->

{{< admonition type="note" >}}
Windows AD (Kerberos) authentication is only available for self-managed Grafana installations. It is not supported in Grafana Cloud. For Grafana Cloud deployments connecting to SQL Server, use SQL Server Authentication or Azure Entra ID.
{{< /admonition >}}

**Kerberos SPN requirements:**

For Kerberos authentication to succeed, a Service Principal Name (SPN) must be registered for the SQL Server instance that matches the hostname Grafana uses to connect. This is especially important when connecting through Availability Group Listeners or DNS aliases.

Register SPNs using the `setspn` command on the SQL Server host:

```text
setspn -S MSSQLSvc/<SQL_SERVER_FQDN>:1433 <DOMAIN>\<SERVICE_ACCOUNT>
setspn -S MSSQLSvc/<SQL_SERVER_FQDN> <DOMAIN>\<SERVICE_ACCOUNT>
```

If Grafana connects through a Listener or alias, register an additional SPN for that name. Verify registered SPNs with `setspn -L <DOMAIN>\<SERVICE_ACCOUNT>`.

<!-- vale Grafana.Spelling = YES -->

### Connect to on-premises SQL Server from Grafana Cloud

If your SQL Server instance is in a private network (on-premises, VPN, or VPC), Grafana Cloud cannot reach it directly over the internet. You must use **Private data source connect (PDC)** to establish a secure tunnel between your Grafana Cloud stack and your private network.

{{< admonition type="note" >}}
PDC is required for any SQL Server that isn't publicly accessible from the internet. Firewall allowlisting alone is not sufficient because Grafana Cloud doesn't use static IP addresses for data source connections.
{{< /admonition >}}

**Network prerequisites:**

- **Port 22 (SSH):** The PDC agent on your network must be able to reach the Grafana Cloud PDC endpoint over port 22 for the SSH tunnel.
- **Port 1433 (SQL Server):** The PDC agent must be able to reach your SQL Server instance on port 1433 (or your custom SQL Server port).
- **DNS resolution:** The PDC agent must be able to resolve the SQL Server hostname from within your private network.

**Set up PDC for Microsoft SQL Server:**

1. In your Grafana Cloud stack, navigate to **Connections** > **Private data source connect**.
1. Create a new PDC connection or use an existing one.
1. Install and configure the PDC agent on a host within your private network that has access to the SQL Server instance. For detailed instructions, refer to [Configure Grafana private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc).
1. Return to the Microsoft SQL Server data source configuration.
1. Under **Private data source connect**, select your PDC connection from the drop-down.
1. Enter the SQL Server hostname as it's resolvable from within your private network (not a public DNS name).
1. Click **Save & test** to verify connectivity.

Click **Manage private data source connect** to open your PDC connection page and view your configuration details.

For more information about PDC, refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

{{< admonition type="caution" >}}
If you previously connected using a self-managed Grafana instance and are migrating to Grafana Cloud, you must configure PDC before your private SQL Server is accessible. Direct network access methods that worked with self-managed Grafana (VPN peering, private endpoints) don't apply to Grafana Cloud.
{{< /admonition >}}

After configuring your MSSQL data source options, click **Save & test** at the bottom to test the connection. You should see a confirmation dialog box that says:

**Database Connection OK**

### Azure Entra ID (formerly Azure AD) Authentication

The following Azure authentication methods are supported:

- App Registration (service principal)
- Managed Identity
- Current User authentication
- Azure Entra Password

The Azure SQL Server that you are connecting to must support Azure Entra authentication. For configuration details, refer to the [Azure SQL documentation](https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-aad-configure?view=azuresql&tabs=azure-portal).

#### Required server configuration

Before you can use any Azure Entra ID authentication method, you must enable Azure authentication in the Grafana server configuration. Add the following to your `grafana.ini` or `custom.ini` file:

```ini
[azure]
azure_auth_enabled = true
```

Depending on the method you choose, additional flags are required (documented in each section below). After changing the `.ini` file, restart the Grafana server for the changes to take effect.

#### Current User authentication

This is the recommended authentication mechanism when working with SQL Server instances that are hosted in Azure. It allows users to be authenticated to and query the database using their own credentials rather than long-lived credentials.

This authentication method requires your Grafana instance to be configured with Azure Entra ID (formerly Active Directory) authentication for login. With Azure Entra ID login, this method can be used to forward the currently logged in user’s credentials to the data source. The users credentials will then be used when requesting data from the data source. For details on how to configure your Grafana instance using Azure Entra refer to the [documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/).

{{< admonition type="note" >}}
Additional configuration is required to ensure that the App Registration used to login a user via Azure provides an access token with the permissions required by the data source.

The App Registration must be configured to issue both **Access Tokens** and **ID Tokens**.

1. In the Azure Portal, open the App Registration that requires configuration.
2. Select **Authentication** in the side menu.
3. Under **Implicit grant and hybrid flows** check both the **Access tokens** and **ID tokens** boxes.
4. Save the changes to ensure the App Registration is updated.

The App Registration must also be configured with additional **API Permissions** to provide authenticated users with access to the APIs utilised by the data source.

1. In the Azure Portal, open the App Registration that requires configuration.
1. Select **API Permissions** in the side menu.
1. Ensure the `openid`, `profile`, `email`, and `offline_access` permissions are present under the **Microsoft Graph** section. If not, they must be added.
1. Select **Add a permission** and choose the following permissions. They must be added individually. Refer to the [Azure documentation](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis) for more information.
   - Select **APIs my organization uses** > Search for **Azure SQL** and select it > **Delegated permissions** > `user_impersonation` > **Add permissions**

After all permissions have been added, the Azure authentication section in Grafana must be updated. The `scopes` section must be updated to include the `.default` scope to ensure that a token with access to all APIs declared on the App Registration is requested by Grafana. After updated the scopes value should equal: `.default openid email profile`.
{{< /admonition >}}

This method of authentication doesn't inherently support all backend functionality as a user's credentials won't be in scope. Affected functionality includes alerting, reporting, and recorded queries. Also, note that query and resource caching is disabled by default for data sources using current user authentication.

**To enable current user authentication for Grafana:**

1. Set the `user_identity_enabled` flag in the `[azure]` section of the [Grafana server configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure).

   ```ini
   [azure]
   user_identity_enabled = true
   ```

2. In the SQL Server data source configuration, set **Authentication** to **Azure AD Authentication** and the Azure Authentication type to **Current User**.

#### App Registration

Use an app registration (service principal) to authenticate the data source with a client ID and secret. This is the recommended method for automated, non-interactive access to Azure SQL.

**Prerequisites:**

- An app registration created in Azure Entra. For instructions, refer to the [Azure documentation for service principals](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#get-tenant-and-app-id-values-for-signing-in).
- The tenant ID, client (application) ID, and a client secret from the app registration.

**Step 1: Add the app registration as a database user**

1. Connect to your Azure SQL database as a user with administrative permissions (the user must have the ability to read your Azure Entra directory, for example, by possessing the `Directory Readers` role).
1. Run the following SQL to create a user for the app registration:

   ```sql
   CREATE USER [<APP_REGISTRATION_NAME>] FROM EXTERNAL PROVIDER;
   ```

1. Grant the created user appropriate permissions. Grafana recommends read-only access:

   ```sql
   ALTER ROLE db_datareader ADD MEMBER [<APP_REGISTRATION_NAME>];
   ```

**Step 2: Configure the Grafana server**

Ensure `azure_auth_enabled` is set in your `grafana.ini`:

```ini
[azure]
azure_auth_enabled = true
```

**Step 3: Configure the data source**

1. In the SQL Server data source configuration, set **Authentication** to **Azure AD Authentication** and the Azure Authentication type to **App Registration**.
1. Set **Azure Cloud** to **Azure** (for the Azure public cloud).
1. Enter the **Directory (tenant) ID**, **Application (client) ID**, and **Client Secret** from your app registration.

#### Managed Identity

{{< admonition type="note" >}}
Managed Identity is available only in [Azure Managed Grafana](https://azure.microsoft.com/en-us/products/managed-grafana) or self-managed Grafana deployed in Azure. It is not available in Grafana Cloud.
{{< /admonition >}}

You can use managed identity to configure SQL Server in Grafana if you host Grafana in Azure (such as an App Service or with Azure Virtual Machines) and have managed identity enabled on your VM.
This lets you securely authenticate data sources without manually configuring credentials.
For details on Azure managed identities, refer to the [Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview).

**To enable managed identity for Grafana:**

1. Set both `azure_auth_enabled` and `managed_identity_enabled` in the `[azure]` section of the [Grafana server configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure):

   ```ini
   [azure]
   azure_auth_enabled = true
   managed_identity_enabled = true
   ```

1. In the SQL Server data source configuration, set **Authentication** to **Azure AD Authentication** and the Azure Authentication type to **Managed Identity**.

   This hides the directory ID, application ID, and client secret fields, and the data source uses managed identity to authenticate to SQL Server.

1. Optionally, set `managed_identity_client_id` in the `[azure]` section to use a user-assigned managed identity instead of the default system-assigned identity.

Ensure that the managed identity is added to your Azure SQL instance as a user.

### Azure Entra Password

{{< admonition type="warning" >}}
Azure Entra Password is not a recommended authentication mechanism as it requires configuration using a single users password. Consider an alternative authentication method such as current user authentication or app registration.
{{< /admonition >}}

You can connect to an Azure SQL database using the username and password of a user that has permissions in the desired database. This also requires an app registration to be configured with access to the database.

**To enable Azure Entra password for Grafana:**

1. Set the `azure_entra_password_credentials_enabled` flag in the `[azure]` section of the [Grafana server configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure).

   ```ini
   [azure]
   azure_entra_password_credentials_enabled = true
   ```

2. In the SQL Server data source configuration, set **Authentication** to **Azure AD Authentication** and the Azure Authentication type to **Azure Entra Password**.
3. Set the **User ID** value to the username of the user in the Azure SQL database.
4. Set the **Application Client ID** to the client ID of the app registration that has been added to the Azure SQL database
5. Set the **Password** value to the password of the user in the Azure SQL database.

### Min time interval

The **Min time interval** setting defines a lower limit for the [`$__interval`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval) and [`$__interval_ms`][add-template-variables-interval_ms] variables.

This value _must_ be formatted as a number followed by a valid time identifier:

| Identifier | Description |
| ---------- | ----------- |
| `y`        | year        |
| `M`        | month       |
| `w`        | week        |
| `d`        | day         |
| `h`        | hour        |
| `m`        | minute      |
| `s`        | second      |
| `ms`       | millisecond |

Grafana recommends setting this value to match your Microsoft SQL Server write frequency.
For example, use `1m` if Microsoft SQL Server writes data every minute.

You can also override this setting in a dashboard panel under its data source options.

### Database user permissions

When adding a data source, ensure the database user you specify has only SELECT permissions on the relevant database and tables. Grafana does not validate the safety of queries, which means they can include potentially harmful SQL statements, such as `USE otherdb`; or `DROP TABLE user;`, which could get executed. To minimize this risk, Grafana strongly recommends creating a dedicated MSSQL user with restricted permissions.

```sql
CREATE USER grafanareader WITH PASSWORD 'password'
GRANT SELECT ON dbo.YourTable3 TO grafanareader
```

Also, ensure that the user doesn't have any unwanted privileges from the public role.

### Diagnose connection issues

If you use older versions of Microsoft SQL Server, such as 2008 and 2008R2, you might need to disable encryption before you can connect the data source.

Grafana recommends that you use the latest available service pack for optimal compatibility.

### Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system. For more information about provisioning, and for available configuration options, refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/).

#### Provisioning example

```yaml
apiVersion: 1

datasources:
  - name: MSSQL
    type: mssql
    url: localhost:1433
    user: grafana
    jsonData:
      database: grafana
      maxOpenConns: 100
      maxIdleConns: 100
      maxIdleConnsAuto: true
      connMaxLifetime: 14400
      connectionTimeout: 0
      encrypt: 'false'
    secureJsonData:
      password: 'Password!'
```

### Configure with Terraform

You can configure the Microsoft SQL Server data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to the [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/) documentation.

#### Terraform example

The following example creates a basic Microsoft SQL Server data source:

```hcl
resource "grafana_data_source" "mssql" {
  name = "MSSQL"
  type = "mssql"
  url  = "localhost:1433"
  user = "grafana"

  json_data_encoded = jsonencode({
    database           = "grafana"
    maxOpenConns       = 100
    maxIdleConns       = 100
    maxIdleConnsAuto   = true
    connMaxLifetime    = 14400
    connectionTimeout  = 0
    encrypt            = "false"
  })

  secure_json_data_encoded = jsonencode({
    password = "Password!"
  })
}
```

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).

## Next steps

After configuring your Microsoft SQL Server data source, you can:

- [Write queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/query-editor/) using the query editor to explore and visualize your data
- [Create template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/template-variables/) to build dynamic, reusable dashboards
- [Add annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/annotations/) to overlay SQL Server events on your graphs
- [Set up alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/alerting/) to create alert rules based on your SQL Server data
- [Troubleshoot issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/troubleshooting/) if you encounter problems with your data source
