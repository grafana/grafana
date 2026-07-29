---
aliases:
  - ../data-sources/loki/
  - ../features/datasources/loki/
description: Guide for using Loki in Grafana
keywords:
  - grafana
  - loki
  - logging
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Loki
title: Loki data source
weight: 800
review_date: 2026-07-29
---

# Loki data source

Grafana Loki is a horizontally scalable, highly available log aggregation system by Grafana Labs. Unlike other logging systems, Loki indexes only metadata about your logs in the form of labels, the same label model used by Prometheus. Loki compresses and stores the log content itself in chunks in object stores such as Amazon S3 or Google Cloud Storage, or on a local filesystem. The Loki data source in Grafana lets you query and visualize those logs, and correlate them with metrics, traces, and other data in unified dashboards.

Grafana includes built-in support for Loki, so you don't need to install a plugin.

## Supported features

| Feature     | Supported                                                  |
| ----------- | ---------------------------------------------------------- |
| Logs        | Yes                                                        |
| Metrics     | Yes. Use LogQL metric queries to derive metrics from logs. |
| Traces      | No                                                         |
| Alerting    | Yes                                                        |
| Annotations | Yes                                                        |

## Supported Loki versions

This data source supports these versions of Loki:

- v2.9+

## Get started

The following documents help you get started with the Loki data source:

- [Configure the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/)
- [Loki query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/query-editor/)
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/template-variables/)
- [Loki annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/annotations/)
- [Loki alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/alerting/)
- [Troubleshoot Loki issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/troubleshooting/)

To learn more about Loki itself, refer to the following Loki documentation:

- [Get started with Loki](https://grafana.com/docs/loki/latest/get-started/)
- [Install Loki](https://grafana.com/docs/loki/latest/setup/install/)
- [Loki best practices](https://grafana.com/docs/loki/latest/best-practices/)
- [LogQL query language](https://grafana.com/docs/loki/latest/query/)

## Additional features

After configuring the Loki data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query and live tail logs without building a dashboard.
- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/).
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results.
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) on your logs.
- Add [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/) to overlay log events on your graphs.
- Optimize performance with [query caching](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching).

## Related resources

- [Loki documentation](https://grafana.com/docs/loki/latest/)
- [LogQL query language](https://grafana.com/docs/loki/latest/query/)
- [Grafana community forum](https://community.grafana.com/)
