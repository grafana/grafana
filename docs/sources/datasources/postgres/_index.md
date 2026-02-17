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

## Get started with the PostgreSQL data source

The following documents will help you get started with the PostgreSQL data source in Grafana:

- [Configure the PostgreSQL data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/configure/)
- [PostgreSQL query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/query-editor/)
- [PostgreSQL template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/template-variables/)
- [PostgreSQL annotations](annotations/)
- [PostgreSQL alerting](alerting/)
- [Troubleshooting](troubleshooting/)

After you have configured the data source you can:

- Create a variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)
- Add [annotations](annotations/) to overlay events on your panels
- Use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/template-variables/) for dynamic dashboards
- Set up [alerting](alerting/) with time series queries
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/)

View a PostgreSQL overview on Grafana Play:

{{< docs/play title="PostgreSQL Overview" url="https://play.grafana.org/d/ddvpgdhiwjvuod/postgresql-overview" >}}
