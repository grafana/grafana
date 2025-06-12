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
     destination:  docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
   - pattern: /docs/grafana-cloud/
     destination:  docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
  configure-pdc:
   - pattern: /docs/grafana/
     destination:  /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
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


---

# Configure the Microsoft SQL Server data source

This document provides instructions for configuring the Microsoft SQL Server data source and explains available configuration options. For general information on managing data sources, refer to [Data source management](ref:data-source-management).

## Before you begin

- Grafana comes with a built-in MSSQL data source plugin, eliminating the need to install a plugin.

- You must have the `Organization administrator` role to configure the Postgres data source.
  Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- Familiarize yourself with your MSSQL security configuration and gather any necessary security certificates and client keys.

- Verify that data from MSSQL is being written to your Grafana instance.

## Add the MSSQL data source

To add the MSSQL data source complete the following steps:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**
1. Type `Microsoft SQL Server` in the search bar.
1. Select **Microsoft SQL Server** under data source.
1. Click **Add new data source** in the upper right.

Grafana takes you to the **Settings** tab, where you will set up your Microsoft SQL Server configuration.

## Configure the data source in the UI

Following are configuration options for the Microsoft SQL Server data soruce:

- **Name** - The data source name. Sets the name you use to refer to the data source in panels and queries. Examples: MSSQL-1, MSSQL_Sales1.
- **Default** - Toggle to select as the default name in dashboard panels. When you go to a dashboard panel, this will be the default selected data source.

**Connection:**

 - **Host** - Sets the IP address/hostname and optional port of your MSSQL instance. Default port is 0, the driver default. You can specify multiple connection properties, such as `ApplicationIntent`, by separating each property with a semicolon (`;`).
- **Database** - Sets the name of your MSSQL database.

**TLS/SSL Auth:** 


Encrypt - Determines whether or to which extent a secure SSL TCP/IP connection will be negotiated with the server.

- **Disable** - Data sent between client and server is not encrypted.
- **False** - The default setting. Data sent between client and server is not encrypted beyond the login packet.
- **True** - Data sent between client and server is encrypted.

Note:
If you're using an older version of Microsoft SQL Server like 2008 and 2008R2, you may need to disable encryption to be able to connect.

**Authentication:** 

Authentication Type

- **SQL Server Authentication** -  This is the default mechanism to connect to MSSQL Server. Enter the SQL Server Authentication login or the Windows Authentication login in the DOMAIN\User format.
  - **Username** - 
  - **Password** - 

- **Windows Authentication (Windows Integrated Security)** - This authentication method uses the logged-in Windows user's credentials to authenticate with SQL Server via single sign-on. This method is available when the user is already signed into Windows and SQL Server is configured to allow Windows Authentication.

- **Windows AD (Active Directory username/password)** - Authenticates a domain user using their Active Directory username and password.
  - **Username** - Format is `user@example.com`. The realm is derived from the username.
  - **Password** - 

- **Windows AD: (Keytab)** - Authenticates a domain user using a keytab file.
  - **Username** - Format is `user@example.com`. The realm is derived from the username.
  - **Keytab file path** - Add your keytab file path.
- **Windows AD (Credential Cache)** - Sign on for domain user via credential cache.
 Authenticates a domain user using a Kerberos credential cache already loaded into memory (e.g., from a prior kinit command). No file is needed.
  - **Credential cache path *** - Add your credential cache path. Example: /tmp/krb5cc_1000
- **Windows AD: (Credential cache _file_)** - Sign on for domain user via credential cache file. Authenticates a domain user using a credential cache file (`.ccache`).
  - **Username** Use the format `user@edomain.com`.
  - **Credential cache file path** - Add your credential cache file path. Example: /home/grot/cache.json






| **Authentication Type**                | **Description**                                                                                                   | **Required Fields**                                                                                 |
|----------------------------------------|-------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| Windows AD (Keytab)                    | Authenticates a domain user using a keytab file.                                                                  | Username: `user@example.com`<br>Keytab file path: Path to your keytab file                          |
| Windows AD (Credential Cache)          | Signs on a domain user via a Kerberos credential cache already loaded into memory (e.g., from a prior `kinit`). No file is needed. | Credential cache path: Path to your credential cache (e.g., `/tmp/krb5cc_1000`)                     |
| Windows AD (Credential Cache File)     | Signs on a domain user via a credential cache file (`.ccache`).                                                   | Username: `user@edomain.com`<br>Credential cache file path: Path to your credential cache file (e.g., `/home/grot/cache.json`) |







The default is `SQL server authentication`. 

**Additional settings:**

Additional settings are optional settings you configure for more control over your data source. This includes connection limits, connection timeout, group-by time interval, and Secure Socks Proxy.

- **Connection limits** - 
  - **Max open** - The maximum number of open connections to the database. If set to 0, there is no limit. If `max open` is greater than 0 and less than the `max idle` setting, `max idle` will be adjusted to match it.

  - **Auto max idle** - Toggle on to automatically set the maximum idle connections to match the max open connections. If max open connections isn’t set, it defaults to `100`.

  - **Max idle** - The maximum number of idle connections in the pool. If `max open` connections is set to a value greater than 0 and is lower than this setting, `max idle` connections will be reduced to match it. If set to 0, idle connections are not retained.

  - Max lifetime - Specifies the maximum duration (in seconds) that a connection can be reused before it is closed and replaced. If set to `0`, connections are reused indefinitely.



**Connection details:**

| **Setting**           | **Description**                                                                                                                                                                                                                  |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Min time interval**     | Specifies the lower bound for the auto-generated `GROUP BY` time interval. Grafana recommends matching this value to your data's write frequency—for example, `1m` if data is written every minute. Refer to [Min time interval](#min-time-interval) for details. |
| **Connection timeout**    | Specifies the maximum number of seconds to wait when attempting to connect to the database before timing out. A value of `0` (the default) disables the timeout.                            |


**Windows ADS Advanced Settings**

- **UDP Preference Limit** - _Optional_ The default is 1 and means always use TCP and is optional. The **UDP Preference Limit** setting defines the maximum size packet that the Kerberos libraries will attempt to send over a UDP connection before retrying with TCP. Default is 1 which means always use TCP.

- **DNS Lookup KDC** - This setting controls whether DNS `SRV` records should be used to discover the [Key Distribution Centers (KDCs)](https://web.mit.edu/kerberos/krb5-latest/doc/admin/realm_config.html#key-distribution-centers) and other servers for the specified realm. The default is `true`.

- **krb5 config file path** - The path to the configuration file for the [MIT krb5 package](https://web.mit.edu/kerberos/krb5-1.12/doc/admin/conf_files/krb5_conf.html). The default is `/etc/krb5.conf`.

| Setting                  | Description                                                                                                                                                                                                                       | Default             |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------|
| **UDP Preference Limit** | Defines the maximum packet size (in bytes) that Kerberos libraries will attempt to send over UDP before retrying with TCP. A value of `1` forces all communication to use TCP.                                                 | `1` (always use TCP) |
| **DNS Lookup KDC**       | Controls whether DNS `SRV` records are used to locate [Key Distribution Centers (KDCs)](https://web.mit.edu/kerberos/krb5-latest/doc/admin/realm_config.html#key-distribution-centers) and other servers for the realm.         | `true`              |
| **krb5 config file path**| Specifies the path to the Kerberos configuration file used by the [MIT krb5 package](https://web.mit.edu/kerberos/krb5-1.12/doc/admin/conf_files/krb5_conf.html).                                                             | `/etc/krb5.conf`    |



**Private data source connect** - _Only for Grafana Cloud users._ 

Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](ref:private-data-source-connect) and [Configure Grafana private data source connect (PDC)](ref:configure-pdc) for instructions on setting up a PDC connection.

Click **Manage private data source connect** to open your PDC connection page and view your configuration details.

After configuring your Graphite data source options, click **Save & test** at the bottom to test the connection. You should see a confirmation dialog box that says:

<!-- 
1. Set the data source's basic configuration options:

| Name                | Description                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**            | Sets the name you use to refer to the data source in panels and queries.                                                                                                                                                                                                                                                                                           |
| **Default**         | Sets the data source that's pre-selected for new panels.                                                                                                                                                                                                                                                                                                           |
| **Host**            | Sets the IP address/hostname and optional port of your MSSQL instance. Default port is 0, the driver default. You can specify multiple connection properties, such as `ApplicationIntent`, by separating each property with a semicolon (`;`).                                                                                                                    |
| **Database**        | Sets the name of your MSSQL database.                                                                                                                                                                                                                                                                                                                             |
| **Authentication**  | Sets the authentication mode, either using SQL Server authentication, Windows authentication (single sign-on for Windows users), Azure Active Directory authentication, or various forms of Windows Active Directory authentication.                                                                                                                               |
| **User**            | Defines the database user's username.                                                                                                                                                                                                                                                                                                                              |
| **Password**        | Defines the database user's password.                                                                                                                                                                                                                                                                                                                              |
| **Encrypt**         | Determines whether or to which extent a secure SSL TCP/IP connection will be negotiated with the server. Options include: `disable` - data sent between client and server is not encrypted; `false` - data sent between client and server is not encrypted beyond the login packet; `true` - data sent between client and server is encrypted. Default is `false`. |
| **Max open**        | Sets the maximum number of open connections to the database. Default is `100`.                                                                                                                                                                                                                                                                                     |
| **Max idle**        | Sets the maximum number of connections in the idle connection pool. Default is `100`.                                                                                                                                                                                                                                                                              |
| **Auto (max idle)** | If set will set the maximum number of idle connections to the number of maximum open connections. Default is `true`.                                                                                                                                                                                                                                               |
| **Max lifetime**    | Sets the maximum number of seconds that the data source can reuse a connection. Default is `14400` (4 hours).                                                                                                                                                                                                                                                      |

You can also configure settings specific to the Microsoft SQL Server data source. These options are described in the sections below. -->

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

We recommend setting this value to match your Microsoft SQL Server write frequency.
For example, use `1m` if Microsoft SQL Server writes data every minute.

You can also override this setting in a dashboard panel under its data source options.

### Database user permissions

Grafana doesn't validate that a query is safe, and could include any SQL statement.
For example, Microsoft SQL Server would execute destructive queries like `DELETE FROM user;` and `DROP TABLE user;` if the querying user has permission to do so.

To protect against this, we strongly recommend that you create a specific MSSQL user with restricted permissions.

Grant only `SELECT` permissions on the specified database and tables that you want to query to the database user you specified when you added the data source:

```sql
CREATE USER grafanareader WITH PASSWORD 'password'
GRANT SELECT ON dbo.YourTable3 TO grafanareader
```

Also, ensure that the user doesn't have any unwanted privileges from the public role.

### Diagnose connection issues

If you use older versions of Microsoft SQL Server, such as 2008 and 2008R2, you might need to disable encryption before you can connect the data source.

We recommend that you use the latest available service pack for optimal compatibility.

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