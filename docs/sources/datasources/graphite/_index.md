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

Graphite is an open source time series database that stores numeric metrics. Grafana includes built-in support for Graphite, so you can query your metrics, build dashboards, and set up alerts without installing a plugin.

The Graphite data source includes a query editor for building metric queries and supports template variables, annotations, tag-based queries, and Grafana Alerting.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

{{< docs/play title="Graphite: Sample Website Dashboard" url="https://play.grafana.org/d/000000003/" >}}

## Supported features

The Graphite data source supports the following features:

| Feature     | Supported |
| ----------- | --------- |
| Metrics     | Yes       |
| Logs        | No        |
| Traces      | No        |
| Alerting    | Yes       |
| Annotations | Yes       |

## Get started

The following documents help you set up and use the Graphite data source:

- [Configure the Graphite data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/configure/)
- [Graphite query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/query-editor/)
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/template-variables/)
- [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/annotations/)
- [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/alerting/)
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/troubleshooting/)

## Additional features

After you configure the Graphite data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query data without building a dashboard
- Build a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results
- Configure [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) for dynamic, reusable dashboards

## Send Grafana metrics to Graphite

Grafana can report its own internal metrics to a Graphite backend. In the `[metrics.graphite]` section of the Grafana configuration file, set `address` to your Carbon host and port, for example `localhost:2003`. For the full list of internal metrics settings, refer to [Set up Grafana monitoring](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/).

## Graphite and Loki integration

When you change the data source selection in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/), Graphite queries are converted to Loki queries.
Grafana extracts Loki label names and values from the Graphite queries according to mappings provided in the Graphite data source configuration. Grafana automatically transforms queries using tags with `seriesByTags()` without requiring additional setup.

## Pre-built dashboards

The Graphite data source ships with pre-built dashboards to help you monitor your Graphite deployment:

- **Graphite Carbon Metrics** visualizes the internal metrics that Carbon reports about your Graphite stack.
- **Metrictank** helps you monitor MetricTank, the multi-tenant time series engine that's compatible with Graphite.

To import a pre-built dashboard, navigate to the Graphite data source's **Dashboards** tab and click **Import** next to the dashboard you want.

## Related resources

- [Learn more about Graphite](https://graphiteapp.org/)
- [Graphite documentation](https://graphite.readthedocs.io/)
- [Grafana community forum](https://community.grafana.com/)
