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
---

# Configure the PostgreSQL data source

This document explains how to configure the PostgreSQL data source and lists all configuration options. For general information on managing data sources, refer to [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

## Before you begin

- You need the `Organization administrator` role to configure the data source. You can also [configure it via YAML](#provision-the-data-source) using Grafana provisioning or [using Terraform](#configure-with-terraform).

- Grafana includes a built-in PostgreSQL data source; no plugin installation is required.

- Have your PostgreSQL security details ready (certificates and client keys, if using TLS/SSL).

- Note your PostgreSQL version; you’ll be prompted for it during configuration.

{{< admonition type="note" >}}
When adding a data source, the database user you specify should have only `SELECT` permissions on the relevant schemas and tables. Grafana does not validate the safety of queries, so users could run potentially harmful SQL (for example, `DROP TABLE`). Create a dedicated PostgreSQL user with restricted permissions to limit risk.
{{< /admonition >}}

Example:

```sql
 CREATE USER grafanareader WITH PASSWORD 'password';
 GRANT USAGE ON SCHEMA schema TO grafanareader;
 GRANT SELECT ON schema.table TO grafanareader;
```

Replace `schema` and `table` with your schema and table names.

## Add the PostgreSQL data source

Complete the following steps to set up a new PostgreSQL data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
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

| Setting       | Description                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host URL      | The IP address/hostname and optional port of your PostgreSQL instance.                                                                                                                               |
| Database name | The name of your PostgreSQL database. This database is used as the default for queries in the [query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/query-editor/). |

**Authentication section:**

| Setting               | Description                                                                                                                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Username              | Enter the username used to connect to your PostgreSQL database.                                                                                                                                                                                                                               |
| Password              | Enter the password used to connect to the PostgreSQL database. If a password is not specified and your PostgreSQL is configured to request a password, the data source will look for a [standard PostgreSQL password file](https://www.postgresql.org/docs/current/static/libpq-pgpass.html). |
| TLS/SSL Mode          | Determines whether or with what priority a secure SSL TCP/IP connection will be negotiated with the server. When TLS/SSL Mode is disabled, TLS/SSL Method and TLS/SSL Auth Details aren’t visible options.                                                                                    |
| TLS/SSL Method        | Determines how TLS/SSL certificates are configured.                                                                                                                                                                                                                                           |
| - File system path    | This option allows you to configure certificates by specifying paths to existing certificates on the local file system where Grafana is running. Ensure this file is readable by the user executing the Grafana process.                                                                      |
| - Certificate content | This option allows you to configure certificates by specifying their content. The content is stored and encrypted in the Grafana database. When connecting to the database, the certificates are saved as files, on the local filesystem, in the Grafana data path.                           |

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
| Version           | The PostgreSQL server version. Determines which functions are available in the query builder. The default is 9.3.                                                                                                                                                                                                                                                                           |
| Min time interval | Defines a lower limit for the auto group by time interval. Grafana recommends aligning this setting with the data write frequency. For example, set it to `1m` if your data is written every minute. Refer to [Min time interval](#min-time-interval) for format examples.                                                                                                                  |
| TimescaleDB       | A time series database built as a PostgreSQL extension. When enabled, Grafana uses `time_bucket` in the `$__timeGroup` macro to display TimescaleDB-specific aggregate functions in the query builder. For more information, refer to [TimescaleDB documentation](https://docs.timescale.com/timescaledb/latest/tutorials/grafana/grafana-timescalecloud/#connect-timescaledb-and-grafana). |

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

The **Min time interval** setting defines a lower limit for the [`$__interval`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval) and [`$__interval_ms`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval_ms) variables.

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

You can define and configure the data source in YAML files with [provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources). For more information about provisioning and available configuration options, refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources).

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

If you encounter metric request errors or other issues when provisioning, see [Provisioning errors](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/troubleshooting/#provisioning-errors) in the PostgreSQL troubleshooting guide.

## Configure with Terraform

You can configure the PostgreSQL data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/).

### Terraform example

The following example creates a basic PostgreSQL data source:

```hcl
resource "grafana_data_source" "postgres" {
  name = "Postgres"
  type = "postgres"
  url  = "localhost:5432"
  user = "grafana"

  json_data_encoded = jsonencode({
    database         = "grafana"
    sslmode          = "disable"
    maxOpenConns     = 100
    maxIdleConns     = 100
    maxIdleConnsAuto = true
    connMaxLifetime  = 14400
    postgresVersion  = 903
    timescaledb      = false
  })

  secure_json_data_encoded = jsonencode({
    password = "Password!"
  })
}
```

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).

## Next steps

After configuring your PostgreSQL data source, you can:

- [Write queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/query-editor/) using the query editor to explore and visualize your data.
- [Use template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/template-variables/) to create dynamic, reusable dashboards.
- [Add annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/annotations/) to overlay PostgreSQL events on your panels.
- [Set up alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/alerting/) to create alert rules based on your PostgreSQL data (time series format only).
- [Troubleshoot issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/troubleshooting/) if you encounter problems with your data source.
