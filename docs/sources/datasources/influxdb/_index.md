---
aliases:
  - ../data-sources/influxdb/
  - ../data-sources/influxdb/provision-influxdb/
  - ../features/datasources/influxdb/
  - provision-influxdb/
description: Guide for using the InfluxDB data source in Grafana
keywords:
  - grafana
  - influxdb
  - flux
  - influxql
  - sql
  - time series
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: InfluxDB
title: InfluxDB data source
weight: 700
review_date: 2026-08-04
---

# InfluxDB data source

{{< docs/shared lookup="influxdb/intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

Grafana ships with the InfluxDB data source out of the box. The data source is preinstalled in both Grafana OSS and Grafana Enterprise, so there's nothing for you to install. It's packaged as a standalone plugin that Grafana can update independently of Grafana releases. For details, refer to [Plugin updates](#plugin-updates).

Grafana offers multiple configuration options for this data source, including a choice of three query languages (SQL, InfluxQL, and Flux). SQL and InfluxQL provide both visual builder and code editing modes, while Flux provides a code editor only.

## Supported versions

This data source supports the following InfluxDB products:

- InfluxDB OSS 1.x, 2.x, and 3.x
- InfluxDB Enterprise 1.x and 3.x
- InfluxDB Cloud Serverless
- InfluxDB Cloud Dedicated
- InfluxDB Cloud (TSM)

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Metrics     | Yes       |
| Logs        | Yes       |
| Traces      | No        |
| Alerting    | Yes       |
| Annotations | Yes       |

## Get started

The following documents help you set up and use the InfluxDB data source:

- [Configure the InfluxDB data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure/)
- [InfluxDB query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/query-editor/)
- [InfluxDB template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/template-variables/)
- [InfluxDB annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/annotations/)
- [InfluxDB alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/alerting/)
- [Troubleshoot InfluxDB data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/troubleshooting/)

## Additional features

After configuring the data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query data without building a dashboard.
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results.
- Configure [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) for dynamic dashboards.
- [Build dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/) to visualize your InfluxDB data.
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) rules based on your InfluxDB query results.

## Plugin updates

Starting with Grafana v13.2, the InfluxDB data source is a standalone plugin, preinstalled in both Grafana OSS and Enterprise. This enables more frequent updates independent of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

The standalone plugin requires Grafana 12.3.0 or later. The InfluxDB data source bundled with Grafana 13.1 and earlier continues to work as before. Those versions are unaffected by this change.

{{< admonition type="caution" >}}
Grafana recommends running plugin version 13.1.0 or later. Earlier versions could write API tokens to Grafana server logs in plain text at default log levels. If you've run an earlier version, treat your server logs as sensitive and rotate any tokens that may have been exposed.
{{< /admonition >}}

Users running Grafana 12.3.x through 13.1.x can install the standalone plugin from the plugin catalog if they want the latest features before upgrading to Grafana 13.2. To use the standalone plugin with these versions, add the following to your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/):

```ini
[plugin.influxdb]
as_external = true

[plugins]
; Install the latest version on startup:
preinstall_sync = influxdb
; Or install a specific version:
; preinstall_sync = influxdb@<version>
```

On self-managed Grafana, you control the plugin version. To roll back after a problematic update, pin a known-good version with `preinstall_sync = influxdb@<version>` and restart Grafana, or install a specific version from the **Administration > Plugins** page.

{{< admonition type="note" >}}
In Grafana Cloud, plugin updates are managed automatically. You can't pin the plugin to a specific version or roll back to a previous one yourself. If a plugin update causes problems with your dashboards or queries, contact Grafana Support.
{{< /admonition >}}

## Related resources

- [Official InfluxDB documentation](https://docs.influxdata.com/)
- [Grafana community forum](https://community.grafana.com/)
