---
aliases:
  - ../data-sources/opentsdb/
  - ../features/datasources/opentsdb/
  - ../features/opentsdb/
description: Guide for using OpenTSDB in Grafana
keywords:
  - grafana
  - opentsdb
  - guide
  - time series
  - tsdb
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: OpenTSDB
title: OpenTSDB data source
weight: 1100
last_reviewed: 2026-01-28
---

# OpenTSDB data source

Grafana ships with support for OpenTSDB, an open source time series database built on top of HBase. Use the OpenTSDB data source to visualize metrics, create alerts, and build dashboards from your time series data.

## Supported features

The OpenTSDB data source supports the following features:

| Feature            | Supported | Notes                                                                |
| ------------------ | --------- | -------------------------------------------------------------------- |
| Metrics queries    | Yes       | Query time series data with aggregation, downsampling, and filtering |
| Alerting           | Yes       | Create alert rules based on OpenTSDB queries                         |
| Annotations        | Yes       | Overlay events on graphs using metric-specific or global annotations |
| Template variables | Yes       | Use dynamic variables in queries                                     |
| Explore            | Yes       | Ad-hoc data exploration without dashboards                           |

## Supported OpenTSDB versions

The data source supports OpenTSDB versions 2.1 through 2.4. Some features are version-specific:

| Feature       | Minimum version |
| ------------- | --------------- |
| Filters       | 2.2             |
| Fill policies | 2.2             |
| Explicit tags | 2.3             |

## Get started

The following documents help you get started with the OpenTSDB data source:

- [Configure the OpenTSDB data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/configure/) - Set up authentication and connect to OpenTSDB.
- [OpenTSDB query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/query-editor/) - Create and edit queries with aggregation, downsampling, and filtering.
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/) - Create dynamic dashboards with OpenTSDB variables.
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/troubleshooting/) - Solve common configuration and query errors.

## Additional features

After you have configured the OpenTSDB data source, you can:

- Add [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/annotations/) to overlay OpenTSDB events on your graphs.
- Configure and use [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/) for dynamic dashboards.
- Set up [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/) rules based on your time series queries.
- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to investigate your OpenTSDB data without building a dashboard.

## Related resources

- [Official OpenTSDB documentation](http://opentsdb.net/docs/build/html/index.html)
- [Grafana community forums](https://community.grafana.com/)
