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
- **Template variables:** Create dynamic dashboards with variable-driven queries.
- **Annotations:** Overlay events from PostgreSQL on your dashboard panels.
- **Alerting:** Create alerts based on PostgreSQL query results (time series format only).
- **Macros:** Simplify queries with built-in macros for time filtering and grouping.

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
