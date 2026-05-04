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
review_date: 2026-05-04
---

# PostgreSQL data source

Grafana includes a built-in PostgreSQL data source plugin, enabling you to query and visualize data from any PostgreSQL-compatible database. You don't need to install a plugin to add the PostgreSQL data source to your Grafana instance.

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
- **Enum types:** Custom enum types are returned as string values.
- **Other types:** Types not explicitly mapped (such as arrays, composites, or custom domains) are returned as string values.

## Get started with the PostgreSQL data source

The following documents will help you get started with the PostgreSQL data source in Grafana:

- [Configure the PostgreSQL data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/configure/)
- [PostgreSQL query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/query-editor/)
- [PostgreSQL template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/template-variables/)
- [PostgreSQL annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/annotations/)
- [PostgreSQL alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/alerting/)
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/troubleshooting/)

After you configure the data source, you can:

- Create a variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)
- Add [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/annotations/) to overlay events on your panels
- Use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/template-variables/) for dynamic dashboards
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/alerting/) with time series queries (time series format only)
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/)

View a PostgreSQL overview on Grafana Play:

{{< docs/play title="PostgreSQL Overview" url="https://play.grafana.org/d/ddvpgdhiwjvuod/postgresql-overview" >}}

## Related data sources

The following databases use the PostgreSQL wire protocol and may work with this data source:

- [TimescaleDB](https://www.timescale.com/) — Enable the **TimescaleDB** toggle in the data source settings for `time_bucket` support.
- [CockroachDB](https://www.cockroachlabs.com/)
- [Amazon Redshift](https://aws.amazon.com/redshift/) — Grafana also offers a dedicated [Amazon Redshift data source](https://grafana.com/grafana/plugins/grafana-redshift-datasource/) with additional features.
- [CrateDB](https://cratedb.com/)
- [YugabyteDB](https://www.yugabyte.com/)
