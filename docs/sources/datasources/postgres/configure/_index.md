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
review_date: 2026-05-04
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

{{< admonition type="note" >}}
**Grafana Cloud users:** Grafana Cloud can't reach databases on `localhost`, `127.0.0.1`, or private IP ranges (`10.x`, `172.16.x`, `192.168.x`) directly. If your PostgreSQL instance isn't publicly accessible, you must set up [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) to establish a secure tunnel between Grafana Cloud and your private network. If you experience intermittent connection drops with the Docker-based PDC agent, try switching to the binary-based agent instead.

If your database is publicly accessible but protected by a firewall, you must allowlist the Grafana Cloud outbound IP addresses. Grafana Cloud doesn't provide per-stack static IP addresses—only service-level IP ranges. For the current list of outbound IP addresses, refer to [Allow Grafana Cloud IP addresses in a firewall](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/allow-grafana-cloud-ips/).
{{< /admonition >}}

| Setting       | Description                                                                                                                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host URL      | The IP address/hostname and optional port of your PostgreSQL instance. The default PostgreSQL port is `5432`. For IPv6 addresses, use the format `[::1]:5432`. To connect through a Unix socket, enter the socket directory path (for example, `/var/run/postgresql`). |
| Database name | The name of your PostgreSQL database. This database is used as the default for queries in the [query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/query-editor/).                                                                   |

**Authentication section:**

| Setting               | Description                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Username              | Enter the username used to connect to your PostgreSQL database.                                                                                                                                                                                                                                                                                                                                             |
| Password              | Enter the password used to connect to the PostgreSQL database. This field is optional. If left empty, the PostgreSQL client driver resolves the password using the standard [PostgreSQL password file](https://www.postgresql.org/docs/current/static/libpq-pgpass.html) (`.pgpass`). To use a non-default password file location, set the `PGPASSFILE` environment variable in the Grafana server process. |
| TLS/SSL Mode          | Determines whether and how a secure TLS/SSL connection is negotiated with the server. Refer to the [TLS/SSL mode reference](#tlsssl-mode-reference) for guidance on each mode. When set to `disable`, the TLS/SSL Method and Auth Details options aren't visible.                                                                                                                                           |
| TLS/SSL Method        | Determines how TLS/SSL certificates are configured.                                                                                                                                                                                                                                                                                                                                                         |
| - File system path    | This option allows you to configure certificates by specifying paths to existing certificates on the local file system where Grafana is running. Ensure this file is readable by the user executing the Grafana process.                                                                                                                                                                                    |
| - Certificate content | This option allows you to configure certificates by specifying their content. The content is stored and encrypted in the Grafana database. When connecting to the database, the certificates are saved as files, on the local filesystem, in the Grafana data path.                                                                                                                                         |

### TLS/SSL mode reference

Choose the TLS/SSL mode based on your security requirements and where your database is hosted:

| Mode          | Encryption | Server identity verified | When to use                                                                                                                                                                                      |
| ------------- | ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `disable`     | No         | No                       | Local development or trusted private networks only. Don't use in production.                                                                                                                     |
| `require`     | Yes        | No                       | **Recommended minimum for cloud-hosted databases** such as Amazon RDS, Azure Database for PostgreSQL, and Google Cloud SQL. Encrypts the connection but doesn't verify the server's certificate. |
| `verify-ca`   | Yes        | CA only                  | Use when you need to confirm the server certificate is signed by a trusted CA but don't need to verify the hostname.                                                                             |
| `verify-full` | Yes        | CA + hostname            | **Most secure option.** Verifies both the CA and that the server hostname matches the certificate. Recommended for production when you control the certificates.                                 |

{{< admonition type="note" >}}
Most cloud-hosted PostgreSQL services (Amazon RDS, Azure Database for PostgreSQL, Google Cloud SQL) require at minimum `require` mode. If you leave TLS/SSL Mode set to `disable`, the connection may be rejected by the server. Check your cloud provider's documentation for the recommended `sslmode` setting.
{{< /admonition >}}

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

| Setting           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version           | The PostgreSQL server version. Determines which functions are available in the query builder. The default is 9.3. When you save the data source, Grafana auto-detects the server version and updates this field if it can connect successfully.                                                                                                                                                                                                                                                               |
| Min time interval | Defines a lower limit for the auto group by time interval. Grafana recommends aligning this setting with the data write frequency. For example, set it to `1m` if your data is written every minute. Refer to [Min time interval](#min-time-interval) for format examples.                                                                                                                                                                                                                                    |
| TimescaleDB       | A time-series database built as a PostgreSQL extension. When enabled, Grafana uses `time_bucket` in the `$__timeGroup` macro and displays TimescaleDB-specific aggregate functions in the query builder. Grafana auto-detects TimescaleDB on save if your server is version 9.6 or later and the extension is installed. For more information, refer to [TimescaleDB documentation](https://docs.timescale.com/timescaledb/latest/tutorials/grafana/grafana-timescalecloud/#connect-timescaledb-and-grafana). |

**Connection limits:**

These settings control how Grafana manages connections to your PostgreSQL server. Tune these values if you share the database with other applications or use connection pooling software such as PgBouncer.

| Setting       | Description                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Max open      | The maximum number of open connections to the database. The default is `100`. Reduce this if your PostgreSQL server has a low `max_connections` limit or if multiple Grafana instances connect to the same database. |
| Auto max idle | Toggle to set the maximum number of idle connections to the number of maximum open connections. This setting is toggled on by default.                                                                               |
| Max idle      | The maximum number of connections in the idle connection pool. The default is `100`. When using PgBouncer or similar connection pooling software, consider lowering this to avoid holding unnecessary connections.   |
| Max lifetime  | The maximum amount of time in seconds a connection may be reused. The default is `14400` (4 hours). Set a lower value if your network or security policy requires periodic reconnection.                             |

**Private data source connect:**

| Setting                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private data source connect | _Only for Grafana Cloud users._ Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information, refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/). |

Click **Manage private data source connect** to be taken to your PDC connection page, where you’ll find your PDC configuration details.

**Secure SOCKS proxy:**

If your Grafana instance has the Secure SOCKS proxy feature enabled, a toggle appears in the data source settings. When enabled, Grafana routes PostgreSQL connections through a SOCKS proxy for secure access to databases in private networks. For more information, refer to [Configure a Secure SOCKS5 proxy](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/proxy/).

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

### Basic provisioning example

The following example provisions a PostgreSQL data source with password authentication and SSL disabled:

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

### Provisioning with TLS

The following example provisions a PostgreSQL data source with `verify-full` TLS mode using file system paths for certificates:

```yaml
apiVersion: 1

datasources:
  - name: Postgres-TLS
    type: postgres
    url: db.example.com:5432
    user: grafana
    secureJsonData:
      password: '<PASSWORD>'
    jsonData:
      database: grafana
      sslmode: 'verify-full'
      tlsConfigurationMethod: 'file-path'
      sslRootCertFile: '/etc/grafana/certs/root.crt'
      sslCertFile: '/etc/grafana/certs/client.crt'
      sslKeyFile: '/etc/grafana/certs/client.key'
```

Replace `<PASSWORD>` with your database password and update the certificate paths to match your environment.

### Provisioning with TimescaleDB

The following example enables TimescaleDB support:

```yaml
apiVersion: 1

datasources:
  - name: Postgres-TimescaleDB
    type: postgres
    url: timescale.example.com:5432
    user: grafana
    secureJsonData:
      password: '<PASSWORD>'
    jsonData:
      database: metrics
      sslmode: 'require'
      postgresVersion: 1000
      timescaledb: true
```

Replace `<PASSWORD>` with your database password.

### Provisioning with a Unix socket

The following example connects through a Unix socket instead of TCP:

```yaml
apiVersion: 1

datasources:
  - name: Postgres-Socket
    type: postgres
    url: /var/run/postgresql
    user: grafana
    secureJsonData:
      password: '<PASSWORD>'
    jsonData:
      database: grafana
      sslmode: 'disable'
```

Replace `<PASSWORD>` with your database password. When using a Unix socket, set `url` to the socket directory path. Don't include a port number.

### Provisioning with environment variables

You can use the `$__env{}` syntax to reference environment variables in provisioning files. This avoids storing credentials in plain text YAML:

```yaml
apiVersion: 1

datasources:
  - name: Postgres
    type: postgres
    url: $__env{PG_HOST}:$__env{PG_PORT}
    user: $__env{PG_USER}
    secureJsonData:
      password: $__env{PG_PASSWORD}
    jsonData:
      database: $__env{PG_DATABASE}
      sslmode: 'require'
```

### Provisioning configuration reference

The following table lists all `jsonData` and `secureJsonData` fields supported when provisioning the PostgreSQL data source:

| Field                    | Location         | Description                                                                            |
| ------------------------ | ---------------- | -------------------------------------------------------------------------------------- |
| `database`               | `jsonData`       | The database name.                                                                     |
| `sslmode`                | `jsonData`       | TLS/SSL mode: `disable`, `require`, `verify-ca`, or `verify-full`.                     |
| `maxOpenConns`           | `jsonData`       | Maximum open connections. Default: `100`.                                              |
| `maxIdleConns`           | `jsonData`       | Maximum idle connections. Default: `100`.                                              |
| `maxIdleConnsAuto`       | `jsonData`       | Set max idle to max open automatically. Default: `true`.                               |
| `connMaxLifetime`        | `jsonData`       | Connection max lifetime in seconds. Default: `14400`.                                  |
| `postgresVersion`        | `jsonData`       | Server version code: `903` (9.3), `904` (9.4), `905` (9.5), `906` (9.6), `1000` (10+). |
| `timescaledb`            | `jsonData`       | Enable TimescaleDB support. Default: `false`.                                          |
| `tlsConfigurationMethod` | `jsonData`       | TLS cert method: `file-path` or `file-content`.                                        |
| `sslRootCertFile`        | `jsonData`       | Path to root CA certificate (when using `file-path` method).                           |
| `sslCertFile`            | `jsonData`       | Path to client certificate (when using `file-path` method).                            |
| `sslKeyFile`             | `jsonData`       | Path to client key (when using `file-path` method).                                    |
| `password`               | `secureJsonData` | Database password.                                                                     |
| `tlsCACert`              | `secureJsonData` | Root CA certificate content (when using `file-content` method).                        |
| `tlsClientCert`          | `secureJsonData` | Client certificate content (when using `file-content` method).                         |
| `tlsClientKey`           | `secureJsonData` | Client key content (when using `file-content` method).                                 |

#### Troubleshoot provisioning issues

If you encounter metric request errors or other issues when provisioning, refer to [Provisioning errors](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/troubleshooting/#provisioning-errors) in the PostgreSQL troubleshooting guide.

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
