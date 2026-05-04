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
review_date: 2026-03-10
---

# Prometheus data source

Prometheus is an open source monitoring system and time series database that scrapes and stores metrics for monitoring and alerting.

Grafana provides native support for Prometheus, so you don't need to install a plugin.

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Metrics     | Yes       |
| Alerting    | Yes       |
| Annotations | Yes       |
| Exemplars   | Yes       |

## Get started

The following documentation helps you set up and use the Prometheus data source:

- [Configure the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/)
- [Connect to Amazon Managed Service for Prometheus](aws-authentication/)
- [Connect to Azure Monitor Managed Service for Prometheus](azure-authentication/)
- [Prometheus query editor](query-editor/)
- [Template variables](template-variables/)
- [Annotations](annotations/)
- [Alerting](alerting/)
- [Troubleshooting](troubleshooting/)

## Exemplars

Exemplars link high-level metrics to specific traces, bridging the gap between aggregated metric data and detailed request-level traces. To learn how exemplars work, refer to [Introduction to exemplars](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/).

You can configure exemplar trace links when you [configure the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/), and toggle exemplars on or off per query in the query editor.

## Prometheus API

The Prometheus data source also works with other projects that implement the [Prometheus querying API](https://prometheus.io/docs/prometheus/latest/querying/api/).

For more information on how to query other Prometheus-compatible projects from Grafana, refer to the specific product's documentation:

- [Grafana Mimir](/docs/mimir/latest/)
- [Thanos](https://thanos.io/tip/components/query.md/)

## Pre-built dashboards

The Prometheus data source includes the following pre-built dashboards:

- **Prometheus Stats:** Prometheus server metrics including scrape durations, target counts, and rule evaluations.
- **Prometheus 2.0 Stats:** Updated Prometheus server metrics for Prometheus 2.x instances.
- **Grafana Stats:** Internal performance metrics for Grafana, exposed on the `/metrics` endpoint.

To import a pre-built dashboard:

1. Navigate to the Prometheus data source [configuration page](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/).
1. Click the **Dashboards** tab.
1. Click **Import** next to the dashboard you want to add.

For details about internal Grafana metrics, refer to [Internal Grafana metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/).

## Amazon Managed Service for Prometheus

Grafana has deprecated the Prometheus data source for Amazon Managed Service for Prometheus. Use the [Amazon Managed Service for Prometheus data source](https://grafana.com/grafana/plugins/grafana-amazonprometheus-datasource/) instead. For migration steps, refer to [Connect to Amazon Managed Service for Prometheus](aws-authentication/).

## Azure Monitor Managed Service for Prometheus

Grafana has deprecated the Prometheus data source for Azure Monitor Managed Service for Prometheus. Use the [Azure Monitor Managed Service for Prometheus data source](https://grafana.com/grafana/plugins/grafana-azureprometheus-datasource/) instead. For migration steps, refer to [Connect to Azure Monitor Managed Service for Prometheus](azure-authentication/).

## Additional features

After you configure Prometheus, you can:

- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)
- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query data without building a dashboard
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results
- Create [recorded queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/)

## Related resources

- [What is Prometheus?](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-to-prometheus/)
- [Prometheus documentation](https://prometheus.io/docs/)
- [Prometheus data model](https://prometheus.io/docs/concepts/data_model/)
- [Grafana community forum](https://community.grafana.com/)
