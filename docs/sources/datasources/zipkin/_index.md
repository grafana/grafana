---
aliases:
  - ../data-sources/zipkin/
  - ../data-sources/zipkin/query-editor/
description: Guide for using the Zipkin data source in Grafana
keywords:
  - grafana
  - zipkin
  - tracing
  - distributed tracing
  - querying
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Zipkin
title: Zipkin data source
weight: 1600
review_date: 2026-04-08
---

# Zipkin data source

Grafana ships with built-in support for [Zipkin](https://zipkin.io/), an open source distributed tracing system.
The Zipkin data source lets you query and visualize traces collected by Zipkin directly in Grafana, helping you identify latency bottlenecks, trace requests across microservices, and understand dependencies between services.

{{< admonition type="note" >}}
This plugin requires Grafana version 12.3.0 or later.
{{< /admonition >}}

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Traces      | Yes       |
| Metrics     | No        |
| Logs        | No        |
| Alerting    | No        |
| Annotations | No        |

## Get started

The following pages help you get started with the Zipkin data source:

- [Configure the Zipkin data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/configure/)
- [Zipkin query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/query-editor/)
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/template-variables/)
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/troubleshooting/)

## Additional features

After configuring the data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query traces without building a dashboard
- Navigate from traces to related logs with [trace to logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/configure/#trace-to-logs) integration
- Navigate from traces to related metrics with [trace to metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/configure/#trace-to-metrics) integration
- Enable the [Node graph](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/) visualization to view service dependencies
- Add [Transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results

## Plugin updates

Always ensure that your plugin version is up-to-date so you have access to all current features and improvements. Navigate to **Plugins and data** > **Plugins** to check for updates. Grafana recommends upgrading to the latest Grafana version, and this applies to plugins as well.

{{< admonition type="note" >}}
Plugins are automatically updated in Grafana Cloud.
{{< /admonition >}}

## Related resources

- [Official Zipkin documentation](https://zipkin.io/)
- [Grafana community forum](https://community.grafana.com/)
