---
description: This document provides instructions for configuring the PostgreSQL data source.
keywords:
  - grafana
  - postgresql
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
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

This document provides instructions for configuring the PostgreSQL data source and explains available configuration options. For general information on managing data sources refer to [Data source management](ref:data-source-management).

## Before you begin

- You must have the `Organization administrator` role to configure the Postgres data source.
  Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- Grafana comes with a built-in PostgreSQL data source plugin, eliminating the need to install a plugin.

- Familiarize yourself with your PostgreSQL security configuration and gather any necessary security certificates, client certificates, and client keys.

- Know which version of PostgreSQL you are running. You will be prompted for this information during the configuration process.

{{< admonition type="note" >}}
When adding a data source, the database user you specify should have only `SELECT` permissions on the relevant database and tables. Grafana does not validate the safety of queries, which means they can include potentially harmful SQL statements, such as `USE otherdb;` or `DROP TABLE user;`, that could be executed. To mitigate this risk, Grafana strongly recommends creating a dedicated PostgreSQL user with restricted permissions.
{{< /admonition >}}

Example:

```sql
 CREATE USER grafanareader WITH PASSWORD 'password';
 GRANT USAGE ON SCHEMA schema TO grafanareader;
 GRANT SELECT ON schema.table TO grafanareader;
```

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

| Setting | Description                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| Name    | Sets the name you use to refer to the data source in panels and queries. Examples: `PostgreSQL-DB-1`.                    |
| Default | Toggle to set this specific PostgreSQL data source as the default pre-selected data source in panels and visualizations. |

**Connection section:**

| Setting       | Description                                                            |
| ------------- | ---------------------------------------------------------------------- |
| Host URL      | The IP address/hostname and optional port of your PostgreSQL instance. |
| Database name | The name of your PostgreSQL database.                                  |

**Authentication section:**

| Setting               | Description                                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Username              | Enter the username used to connect to your PostgreSQL database.                                                                                                                                                                                                    |
| Password              | Enter the password used to connect to the PostgreSQL database.                                                                                                                                                                                                     |
| TLS/SSL Mode          | Determines whether or with what priority a secure SSL TCP/IP connection will be negotiated with the server. When TLS/SSL Mode is disabled, TLS/SSL Method and TLS/SSL Auth Details aren’t visible options.                                                         |
| TLS/SSL Method        | Determines how TLS/SSL certificates are configured.                                                                                                                                                                                                                |
| - File system path    | This option allows you to configure certificates by specifying paths to existing certificates on the local file system where Grafana is running. Ensure this file is readable by the user executing the Grafana process.                                           |
| - Certificate content | This option allows you to configure certificate by specifying their content. The content is stored and encrypted in the Grafana database. When connecting to the database, the certificates are saved as files, on the local filesystem, in the Grafana data path. |

**TLS/SSL Auth Details:**

If you select the TLS/SSL Mode options **require**, **verify-ca** or **verify-full** and **file system path** the following are required:

| Setting                    | Description                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| TLS/SSL Root Certificate   | Specify the path to the root certificate file.                                                                        |
| TLS/SSL Client Certificate | Specify the path to the client certificate and ensure the file is accessible to the user running the Grafana process. |
| TLS/SSL Client Key         | Specify the path to the client key file and ensure the file is accessible to the user running the Grafana process.    |

If you select the TLS/SSL Mode option **require** and TLS/SSL Method certificate content the following are required:

| Setting                    | Description                     |
| -------------------------- | ------------------------------- |
| TLS/SSL Client Certificate | Provide the client certificate. |
| TLS/SSL Client Key         | Provide the client key.         |

If you select the TLS/SSL Mode options **verify-ca** or **verify-full** with the TLS/SSL Method certificate content the following are required:

| Setting                    | Description                     |
| -------------------------- | ------------------------------- |
| TLS/SSL Client Certificate | Provide the client certificate. |
| TLS/SSL Root Certificate   | Provide the root certificate.   |
| TLS/SSL Client Key         | Provide the client key.         |

**PostgreSQL Options:**

| Setting           | Description                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version           | Determines which functions are available in the query builder. The default is the current version.                                                                                                                                                                                                                                                                                          |
| Min time interval | Defines a lower limit for the auto group by time interval. Grafana recommends aligning this setting with the data write frequency. For example, set it to `1m` if your data is written every minute. Refer to [Min time interval](#min-time-interval) for format examples.                                                                                                                  |
| TimescaleDB       | A time-series database built as a PostgreSQL extension. When enabled, Grafana uses `time_bucket` in the `$__timeGroup` macro to display TimescaleDB-specific aggregate functions in the query builder. For more information, refer to [TimescaleDB documentation](https://docs.timescale.com/timescaledb/latest/tutorials/grafana/grafana-timescalecloud/#connect-timescaledb-and-grafana). |

**Connection limits:**

| Setting       | Description                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Max open      | The maximum number of open connections to the database. The default is `100`.                                                          |
| Auto max idle | Toggle to set the maximum number of idle connections to the number of maximum open connections. This setting is toggled on by default. |
| Max idle      | The maximum number of connections in the idle connection pool. The default is `100`.                                                   |
| Max lifetime  | The maximum amount of time in seconds a connection may be reused. The default is `14400`, or 4 hours.                                  |

**Private data source connect:**

| Setting                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private data source connect | _Only for Grafana Cloud users._ Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information, refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/). |

Click **Manage private data source connect** to be taken to your PDC connection page, where you’ll find your PDC configuration details.

After you have added your PostgreSQL connection settings, click **Save & test** to test and save the data source connection.

### Min time interval

The **Min time interval** setting defines a lower limit for the [`$__interval`](ref:add-template-variables-interval) and [`$__interval_ms`](ref:add-template-variables-interval-ms) variables.

This option can also be configured or overridden in the dashboard panel under the data source settings.

This value must be formatted as a number followed by a valid time identifier:

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

## Provision the data source

You can define and configure the data source in YAML files with [provisioning](/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).
For more information about provisioning, and available configuration options, refer to [Provision Grafana](ref:provisioning-data-sources).

### PostgreSQL provisioning example

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

#### Troubleshoot provisioning issues

If you encounter metric request errors or other issues:

- Ensure that the parameters in your data source YAML file precisely match the example provided, including parameter names and the correct use of quotation marks.
- Verify that the database name **IS NOT** included in the URL.
