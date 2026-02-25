---
aliases:
  - ../data-sources/influxdb/
  - ../data-sources/influxdb/provision-influxdb/
  - ../features/datasources/influxdb/
  - provision-influxdb/
description: InfluxDB data source for Grafana
keywords:
  - grafana
  - influxdb
  - guide
  - flux
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: InfluxDB
title: InfluxDB data source
weight: 700
---

# InfluxDB data source

{{< docs/shared lookup="influxdb/intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

Grafana includes a built-in InfluxDB data source plugin, enabling you to query and visualize data from InfluxDB without installing additional plugins. Grafana offers multiple configuration options for this data source, including a choice of three query languages (InfluxQL, SQL, and Flux) and a query editor with both code and visual builder modes.

## Supported versions

This data source supports the following InfluxDB products:

- InfluxDB OSS 1.x, 2.x, and 3.x
- InfluxDB Enterprise 1.x and 3.x
- InfluxDB Cloud Serverless
- InfluxDB Cloud Dedicated
- InfluxDB Cloud (TSM)

## Key capabilities

The InfluxDB data source supports:

- **Multiple query languages:** Choose from InfluxQL, SQL (v3.x+), or Flux depending on your InfluxDB version.
- **Time series queries:** Visualize metrics over time with built-in macros for time filtering and grouping.
- **Table queries:** Display query results in table format.
- **Template variables:** Create dynamic dashboards with variable-driven queries.
- **Annotations:** Overlay events from InfluxDB on your dashboard panels.
- **Alerting:** Create alerts based on InfluxDB query results.
- **Log querying:** Query and display log data in Explore and the Logs panel.

## Get started with the InfluxDB data source

The following documents will help you get started with the InfluxDB data source in Grafana:

- [Configure the InfluxDB data source](./configure/)
- [InfluxDB query editor](./query-editor/)
- [InfluxDB template variables](./template-variables/)
- [Troubleshoot InfluxDB data source issues](./troubleshooting/)

## Additional resources

Once you have configured the InfluxDB data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to run ad hoc queries against your InfluxDB data.
- Configure and use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) for dynamic dashboards.
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to process query results.
- [Build dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/) to visualize your InfluxDB data.
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) based on your InfluxDB query results.
