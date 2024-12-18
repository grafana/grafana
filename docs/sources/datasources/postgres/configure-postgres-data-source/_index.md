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

## PostgreSQL settings

To configure basic settings for the data source, complete the following steps:

1.  Click **Connections** in the left-side menu.
1.  Under Your connections, click **Data sources**.
1.  Enter `PostgreSQL` in the search bar.
1.  Select **PostgreSQL**.

    The **Settings** tab of the data source is displayed.

1.  Set the data source's basic configuration options:

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

### Database user permissions (Important!)

The database user you specify when you add the data source should only be granted SELECT permissions on
the specified database and tables you want to query. Grafana does not validate that the query is safe. The query
could include any SQL statement. For example, statements like `DELETE FROM user;` and `DROP TABLE user;` would be
executed. To protect against this we **highly** recommend you create a specific PostgreSQL user with restricted permissions.

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

