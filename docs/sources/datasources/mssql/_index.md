---
aliases:
  - ../data-sources/mssql/
  - ../features/datasources/mssql/
description: Guide for using Microsoft SQL Server in Grafana
keywords:
  - grafana
  - MSSQL
  - Microsoft
  - SQL
  - guide
  - Azure SQL Database
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Microsoft SQL Server
title: Microsoft SQL Server data source
weight: 900
refs:
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  add-template-variables-interval-ms:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval_ms
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval_ms
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  add-template-variables-interval:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
---

# Microsoft SQL Server data source

Grafana ships with built-in support for Microsoft SQL Server (MS SQL).
You can query and visualize data from any Microsoft SQL Server 2005 or newer, including Microsoft Azure SQL Database.

This topic explains configuration specific to the Microsoft SQL Server data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML](#provision-the-data-source) with Grafana's provisioning system.

Once you've added the Microsoft SQL Server data source, you can [configure it](#configure-the-data-source) so that your Grafana instance's users can create queries in its [query editor](query-editor/) when they [build dashboards](ref:build-dashboards) and use [Explore](ref:explore).

## Configure the data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Microsoft SQL Server` in the search bar.
1. Select **Microsoft SQL Server**.

   The **Settings** tab of the data source is displayed.

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
| **Auto (max idle)** | If set will set the maximum number of idle connections to the number of maximum open connections (Grafana v9.5.1+). Default is `true`.                                                                                                                                                                                                                             |
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
      maxOpenConns: 100 # Grafana v5.4+
      maxIdleConns: 100 # Grafana v5.4+
      maxIdleConnsAuto: true # Grafana v9.5.1+
      connMaxLifetime: 14400 # Grafana v5.4+
      connectionTimeout: 0 # Grafana v9.3+
      encrypt: 'false'
    secureJsonData:
      password: 'Password!'
```

## Query the data source

You can create queries with the Microsoft SQL Server data source's query editor when editing a panel that uses a MS SQL data source.

For details, refer to the [query editor documentation](query-editor/).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation](template-variables/).
