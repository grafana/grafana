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
title: Configure the Microsoft SQL Server data source
weight: 200
refs:
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
  table:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
  configure-standard-options-display-name:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#display-name
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#display-name
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
  configure-pdc:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
  provision-grafana:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
  add-template-variables-interval-ms:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval_ms
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval_ms
  add-template-variables-interval:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval
  data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
  configure-grafana-azure-auth:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/
  configure-grafana-azure:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure
  configure-grafana-azure-auth-scopes:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/#enable-azure-ad-oauth-in-grafana
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/#enable-azure-ad-oauth-in-grafana
---

# Configure the Microsoft SQL Server data source

This document provides instructions for configuring the Microsoft SQL Server data source and explains available configuration options. For general information on adding and managing data sources, refer to [Grafana data sources](ref:data-sources) and [Data source management](ref:data-source-management).

## Before you begin

- Grafana comes with a built-in MSSQL data source plugin, eliminating the need to install a plugin.

- You must have the `Organization administrator` role to configure the MSSQL data source. Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- Familiarize yourself with your MSSQL security configuration and gather any necessary security certificates and client keys.

- Verify that data from MSSQL is being written to your Grafana instance.

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
| **Host**     | Sets the IP address or hostname (and optional port) of your MSSQL instance. The default port is `0`, which uses the driver's default. <br> You can include additional connection properties (e.g., `ApplicationIntent`) by separating them with semicolons (`;`). |
| **Database** | Sets the name of the MSSQL database to connect to.                                                                                                                                                                                                                |

**TLS/SSL Auth:**

Encrypt - Determines whether or to which extent a secure SSL TCP/IP connection will be negotiated with the server.

| Encrypt Setting | Description                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **Disable**     | Data sent between the client and server is **not encrypted**.                                    |
| **False**       | The default setting. Only the login packet is encrypted; **all other data is sent unencrypted**. |
| **True**        | **All data** sent between the client and server is **encrypted**.                                |

{{< admonition type="note" >}}
If you're using an older version of Microsoft SQL Server like 2008 and 2008R2, you may need to disable encryption to be able to connect.
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

**Additional settings:**

Additional settings are optional settings you configure for more control over your data source. This includes connection limits, connection timeout, group-by time interval, and Secure Socks Proxy.

**Connection limits**:

| Setting           | Description                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Max open**      | The maximum number of open connections to the database. If set to `0`, there is no limit. If `max open` is greater than `0` and less than `max idle`, `max idle` is adjusted to match.       |
| **Auto max idle** | When enabled, automatically sets `max idle` to match `max open`. If `max open` isn’t set, it defaults to `100`.                                                                              |
| **Max idle**      | The maximum number of idle connections in the pool. If `max open` is set and is lower than `max idle`, then `max idle` is reduced to match. If set to `0`, no idle connections are retained. |
| **Max lifetime**  | The maximum time (in seconds) a connection can be reused before being closed and replaced. If set to `0`, connections are reused indefinitely.                                               |

**Connection details:**

| **Setting**            | **Description**                                                                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Min time interval**  | Specifies the lower bound for the auto-generated `GROUP BY` time interval. Grafana recommends matching this value to your data's write frequency—for example, `1m` if data is written every minute. Refer to [Min time interval](#min-time-interval) for details. |
| **Connection timeout** | Specifies the maximum number of seconds to wait when attempting to connect to the database before timing out. A value of `0` (the default) disables the timeout.                                                                                                  |

**Windows ADS Advanced Settings**

| Setting                   | Description                                                                                                                                                                                                             | Default              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **UDP Preference Limit**  | Defines the maximum packet size (in bytes) that Kerberos libraries will attempt to send over UDP before retrying with TCP. A value of `1` forces all communication to use TCP.                                          | `1` (always use TCP) |
| **DNS Lookup KDC**        | Controls whether DNS `SRV` records are used to locate [Key Distribution Centers (KDCs)](https://web.mit.edu/kerberos/krb5-latest/doc/admin/realm_config.html#key-distribution-centers) and other servers for the realm. | `true`               |
| **krb5 config file path** | Specifies the path to the Kerberos configuration file used by the [MIT krb5 package](https://web.mit.edu/kerberos/krb5-1.12/doc/admin/conf_files/krb5_conf.html).                                                       | `/etc/krb5.conf`     |

**Private data source connect** - _Only for Grafana Cloud users._

Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](ref:private-data-source-connect) and [Configure Grafana private data source connect (PDC)](ref:configure-pdc) for instructions on setting up a PDC connection.

Click **Manage private data source connect** to open your PDC connection page and view your configuration details.

After configuring your MSSQL data source options, click **Save & test** at the bottom to test the connection. You should see a confirmation dialog box that says:

**Database Connection OK**

### Azure Entra ID (formerly Azure AD) Authentication

The following Azure authentication methods are supported:

- Current User authentication
- App Registration
- Managed Identity
- Azure Entra Password

The Azure SQL Server that you are connecting to should support Azure Entra authentication to support adding the App Registration as a user in the database. For configuration details, refer to the [Azure SQL documentation](https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-aad-configure?view=azuresql&tabs=azure-portal).

#### Current User authentication

This is the recommended authentication mechanism when working with SQL Server instances that are hosted in Azure. It allows users to be authenticated to and query the database using their own credentials rather than long-lived credentials.

This authentication method requires your Grafana instance to be configured with Azure Entra ID (formerly Active Directory) authentication for login. With Azure Entra ID login, this method can be used to forward the currently logged in user’s credentials to the data source. The users credentials will then be used when requesting data from the data source. For details on how to configure your Grafana instance using Azure Entra refer to the [documentation](ref:configure-grafana-azure-auth).

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

1. Set the `user_identity_enabled` flag in the `[azure]` section of the [Grafana server configuration](ref:configure-grafana-azure).

   ```ini
   [azure]
   user_identity_enabled = true
   ```

2. In the SQL Server data source configuration, set **Authentication** to **Azure AD Authentication** and the Azure Authentication type to **Current User**.

### App Registration

You must create an app registration and service principal in Azure Entra to authenticate the data source.
For configuration details, refer to the [Azure documentation for service principals](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#get-tenant-and-app-id-values-for-signing-in).

After the app registration has been created, make note of the tenant ID, client ID, and client secret. Take the following steps to add the app registration as a SQL user:

1. Connect to your Azure SQL database as a user with administrative permissions (the user used here must have the ability to read your Azure Entra directory e.g. by possessing the `Directory Readers` role).
2. Run `CREATE USER [$IDENTITY_NAME] FROM EXTERNAL PROVIDER;`, substituting `IDENTITY_NAME` with the app registration name.
3. Grant the created user the appropriate level of permissions for your use-case. It is recommended that users configured for data sources only have reader permissions.

After the appropriate permissions have been granted, configure the SQL Server data source to use the app registration:

1. In the SQL Server data source configuration, set **Authentication** to **Azure AD Authentication** and the Azure Authentication type to **App Registration**.
2. Set the **Azure Cloud** value to the correct value. If you are using the Azure public cloud this will be **Azure**.
3. Set the **Directory (tenant) ID**, **Application (client) ID**, and **Client Secret** values to those for your app registration.

### Managed Identity

{{< admonition type="note" >}}
Managed Identity is available only in [Azure Managed Grafana](https://azure.microsoft.com/en-us/products/managed-grafana) or Grafana OSS/Enterprise when deployed in Azure. It is not available in Grafana Cloud.
{{< /admonition >}}

You can use managed identity to configure SQL Server in Grafana if you host Grafana in Azure (such as an App Service or with Azure Virtual Machines) and have managed identity enabled on your VM.
This lets you securely authenticate data sources without manually configuring credentials via Azure AD App Registrations.
For details on Azure managed identities, refer to the [Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview).

**To enable managed identity for Grafana:**

1. Set the `managed_identity_enabled` flag in the `[azure]` section of the [Grafana server configuration](ref:configure-grafana-azure).

   ```ini
   [azure]
   managed_identity_enabled = true
   ```

2. In the SQL Server data source configuration, set **Authentication** to **Azure AD Authentication** and the Azure Authentication type to **Managed Identity**.

   This hides the directory ID, application ID, and client secret fields, and the data source uses managed identity to authenticate to SQL Server.

3. You can set the `managed_identity_client_id` field in the `[azure]` section of the [Grafana server configuration](ref:configure-grafana-azure) to allow a user-assigned managed identity to be used instead of the default system-assigned identity.

Ensure that the managed identity used is added to your Azure SQL instance as a user.

### Azure Entra Password

{{< admonition type="warning" >}}
Azure Entra Password is not a recommended authentication mechanism as it requires configuration using a single users password. Consider an alternative authentication method such as current user authentication or app registration.
{{< /admonition >}}

You can connect to an Azure SQL database using the username and password of a user that has permissions in the desired database. This also requires an app registration to be configured with access to the database.

**To enable Azure Entra password for Grafana:**

1. Set the `azure_entra_password_credentials_enabled` flag in the `[azure]` section of the [Grafana server configuration](ref:configure-grafana-azure).

   ```ini
   [azure]
   azure_entra_password_credentials_enabled = true
   ```

2. In the SQL Server data source configuration, set **Authentication** to **Azure AD Authentication** and the Azure Authentication type to **Azure Entra Password**.
3. Set the **User ID** value to the username of the user in the Azure SQL database.
4. Set the **Application Client ID** to the client ID of the app registration that has been added to the Azure SQL database
5. Set the **Password** value to the password of the user in the Azure SQL database.

### Min time interval

The **Min time interval** setting defines a lower limit for the [`$__interval`](ref:add-template-variables-interval) and [`$__interval_ms`][add-template-variables-interval_ms] variables.

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

When adding a data source, ensure the database user you specify has only SELECT permissions on the relevant database and tables. Grafana does not validate the safety of queries, which means they can include potentially harmful SQL statements, such as `USE otherdb`; or `DROP TABLE user;`, which could get executed. To minimize this risk, Grafana strongly recommends creating a dedicated MySQL user with restricted permissions.

```sql
CREATE USER grafanareader WITH PASSWORD 'password'
GRANT SELECT ON dbo.YourTable3 TO grafanareader
```

Also, ensure that the user doesn't have any unwanted privileges from the public role.

### Diagnose connection issues

If you use older versions of Microsoft SQL Server, such as 2008 and 2008R2, you might need to disable encryption before you can connect the data source.

Grafana recommends that you use the latest available service pack for optimal compatibility.

### Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system. For more information about provisioning, and for available configuration options, refer to [Provision Grafana](ref:provision-grafana).

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
