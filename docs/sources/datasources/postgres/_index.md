---
aliases:
  - ../data-sources/postgres/
  - ../features/datasources/postgres/
description: Introduction to the PostgreSQL data source in Grafana.
keywords:
  - grafana
  - postgresql
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: PostgreSQL
title: PostgreSQL data source
weight: 1200
review_date: 2026-08-10
---

# PostgreSQL data source

Grafana ships with the PostgreSQL data source out of the box. It's preinstalled in Grafana OSS and Enterprise, so you don't need to install a plugin to add it. The data source is packaged as a standalone plugin that can update independently of Grafana releases.

Grafana offers several configuration options for this data source as well as a visual and code-based query editor.

## Supported databases

This data source supports the following PostgreSQL-compatible databases:

- PostgreSQL 9.0 and newer
- Amazon RDS for PostgreSQL
- Amazon Aurora PostgreSQL
- Azure Database for PostgreSQL
- Google Cloud SQL for PostgreSQL

Grafana recommends using the latest available version for your database for optimal compatibility.

## Key capabilities

The PostgreSQL data source supports:

- **Time series queries:** Visualize metrics over time using built-in time grouping macros.
- **Table queries:** Display query results in table format for any valid SQL query.
- **EXPLAIN queries:** Inspect query execution plans directly in the query editor.
- **Template variables:** Create dynamic dashboards with variable-driven queries using the built-in variable query editor.
- **Annotations:** Overlay events from PostgreSQL on your dashboard panels.
- **Alerting:** Create alerts based on PostgreSQL query results (time series format only).
- **Macros:** Simplify queries with built-in macros for time filtering and grouping.

## Supported PostgreSQL data types

The PostgreSQL plugin uses the [PGX driver](https://github.com/jackc/pgx) for database connectivity. The following PostgreSQL data types are supported:

- **Numeric types:** `int2`, `int4`, `int8`, `float4`, `float8`, `numeric`
- **String types:** `text`, `varchar`, `char`, `bpchar`
- **Date/time types:** `timestamp`, `timestamptz`, `date`, `time`, `timetz`, `interval`
- **Boolean:** `bool`
- **JSON types:** `json`, `jsonb`
- **Enumerated types:** Custom `enum` types are returned as string values.
- **Other types:** Types not explicitly mapped (such as arrays, composites, or custom domains) are returned as string values.

## Get started

The following documents help you get started with the PostgreSQL data source:

- [Configure the PostgreSQL data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/configure/) - Set up authentication and connect to PostgreSQL.
- [PostgreSQL query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/query-editor/) - Create and edit queries with time series, table, and EXPLAIN formats.
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/template-variables/) - Create dynamic dashboards with PostgreSQL variables.
- [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/annotations/) - Overlay PostgreSQL events on your dashboard graphs.
- [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/alerting/) - Create alerts based on PostgreSQL query results.
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/troubleshooting/) - Solve common configuration and query errors.

## Additional features

After you configure the PostgreSQL data source, you can:

- Add [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/annotations/) to overlay PostgreSQL events on your graphs.
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/alerting/) rules based on your time series queries.
- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to investigate your PostgreSQL data without building a dashboard.
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to process query results.

To see the PostgreSQL data source in action, explore the demo dashboard on Grafana Play:

{{< docs/play title="PostgreSQL Overview" url="https://play.grafana.org/d/ddvpgdhiwjvuod/postgresql-overview" >}}

## Plugin updates

Starting with Grafana v13.2, the PostgreSQL data source is a standalone plugin, preinstalled in both Grafana OSS and Enterprise. This enables more frequent updates independent of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

The standalone plugin requires Grafana 12.3.0 or later. The PostgreSQL data source bundled with Grafana 13.1 and earlier continues to work as before. These versions are unaffected by the externalization.

Users running Grafana 12.3.x through 13.1.x can install the standalone plugin from the plugin catalog if they want the latest features before upgrading to Grafana 13.2. To use the standalone plugin with Grafana 12.3.x through 13.1.x, add the following to your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/):

```ini
[plugin.grafana-postgresql-datasource]
as_external = true

[plugins]
; Install the latest version on startup:
preinstall_sync = grafana-postgresql-datasource
; Or install a specific version:
; preinstall_sync = grafana-postgresql-datasource@<version>
```

## Related data sources

The following databases use the PostgreSQL wire protocol and may work with this data source:

- [TimescaleDB](https://www.timescale.com/). Enable the **TimescaleDB** toggle in the data source settings for `time_bucket` support.
- [CockroachDB](https://www.cockroachlabs.com/)
- [Amazon Redshift](https://aws.amazon.com/redshift/). Grafana also offers a dedicated [Amazon Redshift data source](https://grafana.com/grafana/plugins/grafana-redshift-datasource/) with additional features.
- [CrateDB](https://cratedb.com/)
- [YugabyteDB](https://www.yugabyte.com/)
