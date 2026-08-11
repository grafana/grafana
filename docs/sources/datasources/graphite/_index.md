---
aliases:
  - ../data-sources/graphite/
  - ../features/datasources/graphite/
description: Introduction to the Graphite data source in Grafana.
keywords:
  - grafana
  - graphite
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Graphite
title: Graphite data source
weight: 600
review_date: 2026-08-11
---

# Graphite data source

Graphite is an open source time series database built for storing and retrieving numeric metrics at scale. Grafana ships with built-in support for Graphite, so you can query your metrics, build dashboards, and drive alerts without installing a plugin.

The Graphite data source pairs a feature-rich query editor with template variables, annotations, and tag-based queries, taking you from a raw metric path to a polished visualization in just a few steps. This page covers the configuration options, variables, and querying features specific to Graphite.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

## Supported features

The Graphite data source supports the following features:

| Feature     | Supported |
| ----------- | --------- |
| Metrics     | Yes       |
| Logs        | No        |
| Traces      | No        |
| Alerting    | Yes       |
| Annotations | Yes       |

After you add the Graphite data source, you can [configure it](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/configure/) so that your Grafana instance's users can create queries in its [query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/query-editor/) when they [build dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/) and use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/).

{{< docs/play title="Graphite: Sample Website Dashboard" url="https://play.grafana.org/d/000000003/" >}}

## Get Grafana metrics into Graphite

Grafana exposes metrics for Graphite on the `/metrics` endpoint.
Refer to [Internal Grafana metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/) for more information.

## Graphite and Loki integration

When you change the data source selection in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/), Graphite queries are converted to Loki queries.
Grafana extracts Loki label names and values from the Graphite queries according to mappings provided in the Graphite data source configuration. Grafana automatically transforms queries using tags with `seriesByTags()` without requiring additional setup.

## Pre-built dashboards

The Graphite data source ships with pre-built dashboards to help you monitor your Graphite deployment:

- **Graphite Carbon Metrics** visualizes the internal metrics that Carbon reports about your Graphite stack.
- **Metrictank** helps you monitor MetricTank, the multi-tenant time series engine that's compatible with Graphite.

To import a pre-built dashboard, navigate to the Graphite data source's **Dashboards** tab and click **Import** next to the dashboard you want.

## Get the most out of the data source

After installing and configuring the Graphite data source you can:

- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)
- Configure and use [templates and variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/)
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/)
- Add [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/)
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/)
- [Troubleshoot](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/troubleshooting/) common issues with the Graphite data source
