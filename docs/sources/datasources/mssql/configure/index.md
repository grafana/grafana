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

---

# Configure the Microsoft SQL Server data source

This document provides instructions for configuring the Microsoft SQL Server data source and explains available configuration options. For general information on managing data sources, refer to [Data source management](ref:data-source-management).

## Before you begin

- You must have the `Organization administrator` role to configure the Postgres data source.
  Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- Grafana comes with a built-in MSSQL data source plugin, eliminating the need to install a plugin.

- Familiarize yourself with your MSSQL security configuration and gather any necessary security certificates and client keys.

- Verify that data from MSSQL is being written to your Grafana instance.

## Configure the data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**
1. Type `MSSQL` in the search bar.
1. Select the **MSSQL data source**.
1. Click **Add new data source** in the upper right.

Grafana takes you to the **Settings** tab where you will set up your configuration.










<!-- To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Microsoft SQL Server` in the search bar.
1. Select **Microsoft SQL Server**.

The **Settings** tab of the data source is displayed. -->







1. Set the data source's basic configuration options:

| Name                | Description                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**            | Sets the name you use to refer to the data source in panels and queries.                                                                                                                                                                                                                                                                                           |
| **Default**         | Sets the data source that's pre-selected for new panels.                                                                                                                                                                                                                                                                                                           |
| **Host**            | Sets the IP address/hostname and optional port of your MS SQL instance. Default port is 0, the driver default. You can specify multiple connection properties, such as `ApplicationIntent`, by separating each property with a semicolon (`;`).                                                                                                                    |
| **Database**        | Sets the name of your MS SQL database.                                                                                                                                                                                                                                                                                                                             |
| **Authentication**  | Sets the authentication mode, either using SQL Server authentication, Windows authentication (single sign-on for Windows users), Azure Active Directory authentication, or various forms of Windows Active Directory authentication.                                                                                                                               |
| **User**            | Defines the database user's username.                                                                                                                                                                                                                                                                                                                              |
| **Password**        | Defines the database user's password.                                                                                                                                                                                                                                                                                                                              |
| **Encrypt**         | Determines whether or to which extent a secure SSL TCP/IP connection will be negotiated with the server. Options include: `disable` - data sent between client and server is not encrypted; `false` - data sent between client and server is not encrypted beyond the login packet; `true` - data sent between client and server is encrypted. Default is `false`. |
| **Max open**        | Sets the maximum number of open connections to the database. Default is `100`.                                                                                                                                                                                                                                                                                     |
| **Max idle**        | Sets the maximum number of connections in the idle connection pool. Default is `100`.                                                                                                                                                                                                                                                                              |
| **Auto (max idle)** | If set will set the maximum number of idle connections to the number of maximum open connections. Default is `true`.                                                                                                                                                                                                                                               |
| **Max lifetime**    | Sets the maximum number of seconds that the data source can reuse a connection. Default is `14400` (4 hours).                                                                                                                                                                                                                                                      |

You can also configure settings specific to the Microsoft SQL Server data source. These options are described in the sections below.

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

### Connection timeout

The **Connection timeout** setting defines the maximum number of seconds to wait for a connection to the database before timing out. Default is 0 for no timeout.

### UDP Preference Limit

The **UDP Preference Limit** setting defines the maximum size packet that the Kerberos libraries will attempt to send over a UDP connection before retrying with TCP. Default is 1 which means always use TCP.

### DNS Lookup KDC

The **DNS Lookup KDC** setting controls whether to [lookup KDC in DNS](https://web.mit.edu/kerberos/krb5-latest/doc/admin/realm_config.html#mapping-hostnames-onto-kerberos-realms). Default is true.

### KRB5 config file path

The **KRB5 config file path** stores the location of the `krb5` config file. Default is `/etc/krb5.conf`

### Database user permissions

Grafana doesn't validate that a query is safe, and could include any SQL statement.
For example, Microsoft SQL Server would execute destructive queries like `DELETE FROM user;` and `DROP TABLE user;` if the querying user has permission to do so.

To protect against this, we strongly recommend that you create a specific MS SQL user with restricted permissions.

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

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

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