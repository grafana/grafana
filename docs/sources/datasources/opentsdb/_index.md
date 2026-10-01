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
review_date: 2026-08-11
---

# OpenTSDB data source

OpenTSDB is an open source time series database built on top of HBase. Use the OpenTSDB data source to visualize metrics, create alerts, and build dashboards from your time series data.

Grafana ships with OpenTSDB preinstalled in both Grafana OSS and Enterprise, so there's nothing for you to install. The data source is now packaged as a standalone plugin that updates independently of Grafana releases. For details, refer to [Plugin updates](#plugin-updates).

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

## Plugin updates

Starting with Grafana v13.2, the OpenTSDB data source is a standalone plugin, preinstalled in both Grafana OSS and Enterprise. This enables more frequent updates independent of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

The standalone plugin requires Grafana 12.3.0 or later. The OpenTSDB data source bundled with Grafana 12.2 and earlier continues to work as before. These versions are unaffected by the externalization.

Users running Grafana 12.3.x through 13.1.x can install the standalone plugin from the plugin catalog if they want the latest features before upgrading to Grafana 13.2. To use the standalone plugin with these versions, add the following to your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/):

```ini
[plugin.opentsdb]
as_external = true

[plugins]
; Install the latest version on startup:
preinstall_sync = opentsdb
; Or install a specific version:
; preinstall_sync = opentsdb@<version>
```

## Additional features

After you have configured the OpenTSDB data source, you can:

- Add [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/annotations/) to overlay OpenTSDB events on your graphs.
- Configure and use [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/) for dynamic dashboards.
- Set up [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/) rules based on your time series queries.
- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to investigate your OpenTSDB data without building a dashboard.

## Related resources

- [Official OpenTSDB documentation](http://opentsdb.net/docs/build/html/index.html)
- [Grafana community forums](https://community.grafana.com/)
