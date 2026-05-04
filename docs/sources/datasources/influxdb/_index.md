---
aliases:
  - ../data-sources/influxdb/
  - ../data-sources/influxdb/provision-influxdb/
  - ../features/datasources/influxdb/
  - provision-influxdb/
description: Guide for using the InfluxDB data source in Grafana
keywords:
  - grafana
  - influxdb
  - flux
  - influxql
  - sql
  - time series
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: InfluxDB
title: InfluxDB data source
weight: 700
review_date: 2026-05-01
---

# InfluxDB data source

{{< docs/shared lookup="influxdb/intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

Grafana includes a built-in InfluxDB data source plugin, enabling you to query and visualize data from InfluxDB without installing additional plugins. Grafana offers multiple configuration options for this data source, including a choice of three query languages (SQL, InfluxQL, and Flux) and a query editor with both code and visual builder modes.

## Supported versions

This data source supports the following InfluxDB products:

- InfluxDB OSS 1.x, 2.x, and 3.x
- InfluxDB Enterprise 1.x and 3.x
- InfluxDB Cloud Serverless
- InfluxDB Cloud Dedicated
- InfluxDB Cloud (TSM)

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Metrics     | Yes       |
| Logs        | Yes       |
| Traces      | No        |
| Alerting    | Yes       |
| Annotations | Yes       |

## Get started

The following documents help you set up and use the InfluxDB data source:

- [Configure the InfluxDB data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure/)
- [InfluxDB query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/query-editor/)
- [InfluxDB template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/template-variables/)
- [InfluxDB annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/annotations/)
- [InfluxDB alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/alerting/)
- [Troubleshoot InfluxDB data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/troubleshooting/)

## Additional features

After configuring the data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query data without building a dashboard.
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results.
- Configure [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) for dynamic dashboards.
- [Build dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/) to visualize your InfluxDB data.
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) rules based on your InfluxDB query results.

## Plugin updates

Always ensure that your plugin version is up-to-date so you have access to all current features and improvements. Navigate to **Plugins and data** > **Plugins** to check for updates. Grafana recommends upgrading to the latest Grafana version, and this applies to plugins as well.

{{< admonition type="note" >}}
Plugins are automatically updated in Grafana Cloud.
{{< /admonition >}}

## Related resources

- [Official InfluxDB documentation](https://docs.influxdata.com/)
- [Grafana community forum](https://community.grafana.com/)
