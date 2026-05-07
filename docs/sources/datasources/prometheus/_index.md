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
---

# Prometheus data source

Prometheus is an open source database that uses a telemetry collector agent to scrape and store metrics used for monitoring and alerting.

Grafana provides native support for Prometheus, so you don't need to install a plugin.

The following documentation will help you get started working with Prometheus and Grafana:

- [What is Prometheus?](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-to-prometheus/)
- [Prometheus data model](https://prometheus.io/docs/concepts/data_model/)
- [Getting started](https://prometheus.io/docs/prometheus/latest/getting_started/)
- [Configure the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure)
- [Prometheus query editor](query-editor/)
- [Template variables](template-variables/)
- [Troubleshooting](troubleshooting/)

## Exemplars

In Prometheus, an **exemplar** is a specific trace that represents a measurement taken within a given time interval. While metrics provide an aggregated view of your system, and traces offer a detailed view of individual requests, exemplars serve as a bridge between the two, linking high-level metrics to specific traces for deeper insights.

Exemplars associate higher-cardinality metadata from a specific event with traditional time series data. Refer to [Introduction to exemplars](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/) in the Prometheus documentation for detailed information on how they work.

Grafana can show exemplar data alongside a metric both in Explore and in Dashboards.

{{< figure src="/static/img/docs/v74/exemplars.png" class="docs-image--no-shadow" caption="Exemplar window" >}}

You add exemplars when you configure the Prometheus data source.

{{< figure src="/static/img/docs/prometheus/exemplars-10-1.png" max-width="500px" class="docs-image--no-shadow" >}}

## Prometheus API

The Prometheus data source also works with other projects that implement the [Prometheus querying API](https://prometheus.io/docs/prometheus/latest/querying/api/).

For more information on how to query other Prometheus-compatible projects from Grafana, refer to the specific product's documentation:

- [Grafana Mimir](/docs/mimir/latest/)
- [Thanos](https://thanos.io/tip/components/query.md/)

## View Grafana metrics with Prometheus

Grafana exposes metrics for Prometheus on the `/metrics` endpoint and includes a pre-built dashboard to help you start visualizing your metrics immediately.

Complete the following steps to import the pre-built dashboard:

1. Navigate to the Prometheus [configuration page](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure).
1. Click the **Dashboards** tab.
1. Locate the **Grafana metrics** dashboard in the list and click **Import**.

For details about these metrics, refer to [Internal Grafana metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/).

## Amazon Managed Service for Prometheus

Grafana has deprecated the Prometheus data source for Amazon Managed Service for Prometheus. Use the [Amazon Managed Service for Prometheus data source](https://grafana.com/grafana/plugins/grafana-amazonprometheus-datasource/) instead. The linked documentation outlines the migration steps.

## Get the most out of the Prometheus data source

After you install and configure Prometheus you can:

- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)
- Configure and use [templates and variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/)
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/)
- Add [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/)
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/)
- Create [recorded queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/)
