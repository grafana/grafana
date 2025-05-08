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
refs:
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  get-started-prometheus:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/getting-started/get-started-grafana-prometheus/#get-started-with-grafana-and-prometheus
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/getting-started/get-started-grafana-prometheus/#get-started-with-grafana-and-prometheus
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  set-up-grafana-monitoring:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/
  configure-grafana:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/
  administration-documentation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  exemplars:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
  intro-to-prometheus:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-to-prometheus/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-to-prometheus/
  configure-prometheus-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  recorded-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/
  transformations:
   - pattern: /docs/grafana/
     destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
   - pattern: /docs/grafana-cloud/
     destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/
  alerting:
   - pattern: /docs/grafana/
     destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
   - pattern: /docs/grafana-cloud/
     destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  visualizations:
   - pattern: /docs/grafana/
     destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/
   - pattern: /docs/grafana-cloud/
     destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/
  variables:
   - pattern: /docs/grafana/
     destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
   - pattern: /docs/grafana-cloud/
     destination: /docs/grafana-cloud/visualizations/dashboards/variables/

---

# Prometheus data source

Prometheus is an open source database that uses a telemetry collector agent to scrape and store metrics used for monitoring and alerting.

Grafana provides native support for Prometheus, so you don't need to install a plugin.

The following documentation will help you get started working with Prometheus and Grafana:

- [What is Prometheus?](ref:intro-to-prometheus)
- [Prometheus data model](https://prometheus.io/docs/concepts/data_model/)
- [Getting started](https://prometheus.io/docs/prometheus/latest/getting_started/)
- [Configure the Prometheus data source](ref:configure-prometheus-data-source)
- [Prometheus query editor](query-editor/)
- [Template variables](template-variables/)

## Exemplars

In Prometheus, an **exemplar** is a specific trace that represents a measurement taken within a given time interval. While metrics provide an aggregated view of your system, and traces offer a detailed view of individual requests, exemplars serve as a bridge between the two, linking high-level metrics to specific traces for deeper insights.

Exemplars associate higher-cardinality metadata from a specific event with traditional time series data. Refer to [Introduction to exemplars](ref:exemplars) in the Prometheus documentation for detailed information on how they work.

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

1. Navigate to the Prometheus [configuration page](ref:configure-prometheus-data-source).
1. Click the **Dashboards** tab.
1. Locate the **Grafana metrics** dashboard in the list and click **Import**.

For details about these metrics, refer to [Internal Grafana metrics](ref:set-up-grafana-monitoring).

## Amazon Managed Service for Prometheus

Grafana has deprecated the Prometheus data source for Amazon Managed Service for Prometheus. Use the [Amazon Managed Service for Prometheus data source](https://grafana.com/grafana/plugins/grafana-amazonprometheus-datasource/) instead. The linked documentation outlines the migration steps.

## Get the most out of the Prometheus data source

After you install and configure Prometheus you can:

- Create a wide variety of [visualizations](ref:visualizations)
- Configure and use [templates and variables](ref:variables)
- Add [transformations](ref:transformations)
- Add [annotations](ref:annotate-visualizations)
- Set up [alerting](ref:alerting)
- Create [recorded queries](ref:recorded-queries)
