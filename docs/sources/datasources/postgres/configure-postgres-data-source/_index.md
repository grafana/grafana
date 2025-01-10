---
aliases:
  - ../data-sources/postgres/
  - ../features/datasources/postgres/
description: Guide for using PostgreSQL in Grafana
keywords:
  - grafana
  - postgresql
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure the PostgreSQL data source
title: Configure the PostgreSQL data source
weight: 10
refs:
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
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
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
  configure-standard-options-display-name:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#display-name
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#display-name
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  variable-syntax-advanced-variable-format-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options
---

# Configure the PostgreSQL data source




## Before you begin

You must have the `Organization administrator` role to configure the Postgres data source.
Administrators can also [configure the data source via YAML](#provision-the-data-source) with Grafana's provisioning system.

Grafana comes with a built-in PostgreSQL data source plugin, eliminating the need to install a plugin.

{{< admonition type="note" >}}
When adding a data source, the database user you specify should have only `SELECT` permissions on the relevant database and tables. Grafana does not validate the safety of queries, which means they can include potentially harmful SQL statements, such as `USE otherdb;` or `DROP TABLE user;`, that could be executed. To mitigate this risk, Grafana strongly recommends creating a dedicated MySQL user with restricted permissions.
{{< /admonition >}}


## Add the PostgreSQL data source

Complete the following steps to set up a new PostgreSQL data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**
1. Type `PostgreSQL` in the search bar.
1. Select the **PostgreSQL data source**.
1. Click **Add new data source** in the upper right.

You are taken to the **Settings** tab where you will configure the data source.

## PostgreSQL configuration options

Following is a list of PostgreSQL configuration options:

- **Name** - Sets the name you use to refer to the data source in panels and queries. Examples: `PostgreSQL-DB-1`.
- **Default** - Toggle to set as the default data source.

**Connection section:**

- **Host URL** - The IP address/hostname and optional port of your PostgreSQL instance. This does not include the database name. The connection string for connecting to Postgres will not be correct and it may cause errors.
- **Database name** -  The name of your PostgreSQL database.

**Authentication section:**

- **Username** - Enter the username used to connect to your PostgreSQL database.
- **Password** - Enter the password used to connect to the PostgreSQL database.
- **TLS/SSL Mode** - Determines whether or with what priority a secure SSL TCP/IP connection will be negotiated with the server. When **TLS/SSL Mode** is disabled, **TLS/SSL Method** and **TLS/SSL Auth Details** aren't visible options.
- **TLS/SSL Method** - Determines how TLS/SSL certificates are configured. Selecting the **File system path** option allows you to configure certificates by specifying paths to existing certificates on the local file system where Grafana is running. Ensure this file is readable by the user executing the Grafana process. Selecting the **Certificate content** option allows you to configure certificate by specifying their content. The content is stored and encrypted in Grafana's database. When connecting to the database, the certificates are saved as files in Grafana's configured data path on the local filesystem. 

**TLS/SSL Auth Details**

-  



**PostgreSQL Options:**

- **Version** - Determines which functions are available in the query builder. The default is the current version.
- **Min time interval** - Defines a lower limit for the [`$__interval`](ref:add-template-variables-interval) and [`$__interval_ms`](ref:add-template-variables-interval-ms) variables. Grafana recommends aligning this setting with the data write frequency. For example, set it to `1m` if your data is written every minute. Refer to [Min time interval](#min-time-interval) for format examples.
- **TimescaleDB** - A time-series database built as a PostgreSQL extension. When enabled, Grafana uses `time_bucket` in the `$__timeGroup` macro to display TimescaleDB specific aggregate functions in the query builder. For more information, refer to [TimescaleDB documentation](https://docs.timescale.com/timescaledb/latest/tutorials/grafana/grafana-timescalecloud/#connect-timescaledb-and-grafana).

**Connection limits:**

- **Max open** - The maximum number of open connections to the database. The default `100`.
- **Auto (max idle)** - Toggle to set the maximum number of idle connections to the number of maximum open connections. This setting is toggled on by default.
-  **Max idle** - The maximum number of connections in the idle connection pool. The default `100`.
-  **Max lifetime** - The maximum amount of time in seconds a connection may be reused. The default is `14400`, or 4 hours.

**Private data source connect** - _Only for Grafana Cloud users._ Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

Click **Manage private data source connect** to be taken to your PDC connection page, where you’ll find your PDC configuration details.

Once you have added your MySQL connection settings, click **Save & test** to test and save the data source connection.









| Name                        | Description                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**                    | The data source name. This is how you refer to the data source in panels and queries.                                                                                                                                                                                                                                                                                                  |
| **Default**                 | Default data source means that it will be pre-selected for new panels.                                                                                                                                                                                                                                                                                                                 |
| **Host**                    | The IP address/hostname and optional port of your PostgreSQL instance. _Do not_ include the database name. The connection string for connecting to Postgres will not be correct and it may cause errors.                                                                                                                                                                               |
| **Database**                | Name of your PostgreSQL database.                                                                                                                                                                                                                                                                                                                                                      |
| **User**                    | Database user's login/username                                                                                                                                                                                                                                                                                                                                                         |
| **Password**                | Database user's password                                                                                                                                                                                                                                                                                                                                                               |
| **SSL Mode**                | Determines whether or with what priority a secure SSL TCP/IP connection will be negotiated with the server. When SSL Mode is disabled, SSL Method and Auth Details would not be visible.                                                                                                                                                                                               |
| **SSL Auth Details Method** | Determines whether the SSL Auth details will be configured as a file path or file content.                                                                                                                                                                                                                                                                                             |
| **SSL Auth Details Value**  | File path or file content of SSL root certificate, client certificate and client key                                                                                                                                                                                                                                                                                                   |
| **Max open**                | The maximum number of open connections to the database, default `100`.                                                                                                                                                                                                                                                                                                                 |
| **Max idle**                | The maximum number of connections in the idle connection pool, default `100`.                                                                                                                                                                                                                                                                                                          |
| **Auto (max idle)**         | If set will set the maximum number of idle connections to the number of maximum open connections. Default is `true`.                                                                                                                                                                                                                                                                   |
| **Max lifetime**            | The maximum amount of time in seconds a connection may be reused, default `14400`/4 hours.                                                                                                                                                                                                                                                                                             |
| **Version**                 | Determines which functions are available in the query builder.                                                                                                                                                                                                                                                                                                                         |
| **TimescaleDB**             | A time-series database built as a PostgreSQL extension. When enabled, Grafana uses `time_bucket` in the `$__timeGroup` macro to display TimescaleDB specific aggregate functions in the query builder. For more information, see [TimescaleDB documentation](https://docs.timescale.com/timescaledb/latest/tutorials/grafana/grafana-timescalecloud/#connect-timescaledb-and-grafana). |

### Min time interval

A lower limit for the [`$__interval`](ref:add-template-variables-interval) and [`$__interval_ms`](ref:add-template-variables-interval-ms) variables.
Recommended to be set to write frequency, for example `1m` if your data is written every minute.
This option can also be overridden/configured in a dashboard panel under data source options. It's important to note that this value **needs** to be formatted as a
number followed by a valid time identifier, e.g. `1m` (1 minute) or `30s` (30 seconds). The following time identifiers are supported:

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



Example:

```sql
 CREATE USER grafanareader WITH PASSWORD 'password';
 GRANT USAGE ON SCHEMA schema TO grafanareader;
 GRANT SELECT ON schema.table TO grafanareader;
```

Make sure the user does not get any unwanted privileges from the public role.


### Provision the data source

It's now possible to configure data sources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for data sources on the [provisioning docs page](ref:provisioning-data-sources).

#### Provisioning example

```yaml
apiVersion: 1

datasources:
  - name: Postgres
    type: postgres
    url: localhost:5432
    user: grafana
    secureJsonData:
      password: 'Password!'
    jsonData:
      database: grafana
      sslmode: 'disable' # disable/require/verify-ca/verify-full
      maxOpenConns: 100
      maxIdleConns: 100
      maxIdleConnsAuto: true
      connMaxLifetime: 14400
      postgresVersion: 903 # 903=9.3, 904=9.4, 905=9.5, 906=9.6, 1000=10
      timescaledb: false
```

{{% admonition type="note" %}}
In the above code, the `postgresVersion` value of `10` refers to version PostgreSQL 10 and above.
{{% /admonition %}}

#### Troubleshoot provisioning

If you encounter metric request errors or other issues:

- Make sure your data source YAML file parameters exactly match the example. This includes parameter names and use of quotation marks.
- Make sure the `database` name is not included in the `url`.

