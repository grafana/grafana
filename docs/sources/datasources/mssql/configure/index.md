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
      destination: docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
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

| Authentication Type                                 | Description                                                                                                                     | Credentials / Fields                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **SQL Server Authentication**                       | Default method to connect to MSSQL. Use a SQL Server or Windows login in `DOMAIN\User` format.                                  | - **Username**: SQL Server username<br>- **Password**: SQL Server password                            |
| **Windows Authentication**<br>(Integrated Security) | Uses the logged-in Windows user's credentials via single sign-on. Available only when SQL Server allows Windows Authentication. | No input required; uses the logged-in Windows user's credentials                                      |
| **Windows AD**<br>(Username/Password)               | Authenticates a domain user with their Active Directory username and password.                                                  | - **Username**: `user@example.com`<br>- **Password**: Active Directory password                       |
| **Windows AD**<br>(Keytab)                          | Authenticates a domain user using a keytab file.                                                                                | - **Username**: `user@example.com`<br>- **Keytab file path**: Path to your keytab file                |
| **Windows AD**<br>(Credential Cache)                | Uses a Kerberos credential cache already loaded in memory (e.g., from a prior `kinit` command). No file needed.                 | - **Credential cache path**: Path to in-memory credential (e.g., `/tmp/krb5cc_1000`)                  |
| **Windows AD**<br>(Credential Cache File)           | Authenticates a domain user using a credential cache file (`.ccache`).                                                          | - **Username**: `user@example.com`<br>- **Credential cache file path**: e.g., `/home/grot/cache.json` |

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
