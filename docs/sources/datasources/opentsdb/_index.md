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
refs:
  configure-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/configure/
  query-editor-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/query-editor/
  template-variables-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/
  alerting-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/
  annotations-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/annotations/
  troubleshooting-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/troubleshooting/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# OpenTSDB data source

Grafana ships with support for OpenTSDB, an open source time series database built on top of HBase. Use the OpenTSDB data source to visualize metrics, create alerts, and build dashboards from your time series data.

## Supported features

The OpenTSDB data source supports the following features:

| Feature | Supported | Notes |
| ------- | --------- | ----- |
| Metrics queries | Yes | Query time series data with aggregation, downsampling, and filtering |
| Alerting | Yes | Create alert rules based on OpenTSDB queries |
| Annotations | Yes | Overlay events on graphs using metric-specific or global annotations |
| Template variables | Yes | Use dynamic variables in queries |
| Explore | Yes | Ad-hoc data exploration without dashboards |

## Supported OpenTSDB versions

The data source supports OpenTSDB versions 2.1 through 2.4. Some features are version-specific:

| Feature | Minimum version |
| ------- | --------------- |
| Filters | 2.2 |
| Fill policies | 2.2 |
| Explicit tags | 2.3 |

## Get started

The following documents help you get started with the OpenTSDB data source:

- [Configure the OpenTSDB data source](ref:configure-opentsdb)
- [OpenTSDB query editor](ref:query-editor-opentsdb)
- [Template variables](ref:template-variables-opentsdb)
- [Alerting](ref:alerting-opentsdb)
- [Annotations](ref:annotations-opentsdb)
- [Troubleshooting](ref:troubleshooting-opentsdb)

## Explore

You can use [Explore](ref:explore) to query OpenTSDB data without creating a dashboard. This is useful for ad-hoc data exploration and troubleshooting.

## Related resources

- [Official OpenTSDB documentation](http://opentsdb.net/docs/build/html/index.html)
- [Grafana community forums](https://community.grafana.com/)
