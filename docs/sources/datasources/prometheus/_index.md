---
aliases:
  - ../data-sources/prometheus/
  - ../features/datasources/prometheus/
description: Guide for using Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Prometheus
title: Prometheus data source
weight: 1300
review_date: 2026-05-07
---

# Prometheus data source

Prometheus is an open source database that uses a telemetry collector agent to scrape and store metrics used for monitoring and alerting.

Grafana includes built-in support for Prometheus, so you don't need to install a plugin. The Prometheus data source also works with other projects that implement the [Prometheus querying API](https://prometheus.io/docs/prometheus/latest/querying/api/), including [Grafana Mimir](/docs/mimir/latest/) and [Thanos](https://thanos.io/tip/components/query.md/).

## Supported features

| Feature         | Supported |
| --------------- | --------- |
| Metrics         | Yes       |
| Alerting        | Yes       |
| Annotations     | Yes       |
| Recording rules | Yes       |
| Exemplars       | Yes       |

## Get started

The following documents help you set up and use the Prometheus data source:

- [Configure the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/)
- [Prometheus query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor/)
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/template-variables/)
- [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/annotations/)
- [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/alerting/)
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/)

## Exemplars

In Prometheus, an **exemplar** is a specific trace that represents a measurement taken within a given time interval. While metrics provide an aggregated view of your system, and traces offer a detailed view of individual requests, exemplars serve as a bridge between the two, linking high-level metrics to specific traces for deeper insights.

Exemplars associate higher-cardinality metadata from a specific event with traditional time series data. Refer to [Introduction to exemplars](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/) for detailed information on how they work.

Grafana can display exemplar data alongside a metric both in Explore and in dashboards.

You configure exemplars when you set up the Prometheus data source. For details, refer to the Exemplars section in [Configure the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/).

## Amazon Managed Service for Prometheus

Grafana has deprecated the Prometheus data source for Amazon Managed Service for Prometheus. Use the [Amazon Managed Service for Prometheus data source](https://grafana.com/grafana/plugins/grafana-amazonprometheus-datasource/) instead. The linked documentation outlines the migration steps.

## Additional features

After you configure the Prometheus data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query data without building a dashboard
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results
- Create [recorded queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/) for pre-aggregated data
- Build a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)

## Related resources

- [What is Prometheus?](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-to-prometheus/)
- [Prometheus data model](https://prometheus.io/docs/concepts/data_model/)
- [Getting started with Prometheus](https://prometheus.io/docs/prometheus/latest/getting_started/)
- [Grafana community forum](https://community.grafana.com/)
