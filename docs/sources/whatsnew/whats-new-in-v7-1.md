---
_build:
  list: false
aliases:
  - /docs/grafana/latest/guides/whats-new-in-v7-1/
  - /docs/grafana/latest/whatsnew/whats-new-in-v7-1/
description: Feature and improvement highlights for Grafana v7.1
keywords:
  - grafana
  - new
  - documentation
  - '7.1'
  - release notes
title: What's New in Grafana v7.1
weight: -28
---

# What's new in Grafana v7.1

This topic includes the release notes for the Grafana v7.1. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

The main highlights are:

- [**Flux and InfluxDB 2.x support in the Influx Datasource**]({{< relref "#influx-datasource" >}})
- [**Query history search**]({{< relref "#query-history-search" >}})
- [**Unification of Explore modes**]({{< relref "#explore-modes-unified" >}})
- [**Elasticsearch- link to another data source from Explore**]({{< relref "#internal-links-for-elasticsearch" >}})
- [**Merge on time transform for the new table panel**]({{< relref "#transformations" >}})
- [**Stat panel text mode**]({{< relref "#stat-panel-text-mode" >}})
- [**Time range picker update**]({{< relref "#time-range-picker-update" >}})
- [**Provisioning of apps**]({{< relref "#provisioning-of-apps" >}})
- [**Azure Monitor Datasource**]({{< relref "#azure-monitor-datasource" >}})
- [**Deep linking for Google Cloud Monitoring (formerly named Google Stackdriver) datasource**]({{< relref "#deep-linking-for-google-cloud-monitoring-formerly-named-google-stackdriver-datasource" >}})
- [**Grafana Enterprise features**]({{< relref "#grafana-enterprise-features" >}})
  - [**Secret management with HashiCorp Vault**]({{< relref "#support-for-hashicorp-vault" >}})
  - [**Monthly schedules in reports**]({{< relref "#support-for-monthly-schedules-in-reports" >}})

## Influx data source

Support for Flux and Influx v2 has been added. The InfluxData blog post, [How to Build Grafana Dashboards with InfluxDB, Flux and InfluxQL](https://www.influxdata.com/blog/how-grafana-dashboard-influxdb-flux-influxql/) explains the changes in depth.

## Query history search

In Grafana v 7.1 we are introducing search functionality in Query history. You can search across queries and your comments. It is especially useful in combination with a time filter and data source filter. Read more about [Query history here]({{< relref "../explore/#query-history" >}}).

{{< figure src="/static/img/docs/v71/query_history_search.gif" max-width="800px" caption="Query history search" >}}

## Explore modes unified

Grafana 7.1 includes a major change to Explore: it removes the query mode selector.

Many data sources tell Grafana whether a response contains time series data or logs data. Using this information, Explore chooses which visualization to use for that data. This means that you don't need to switch back and forth between Logs and Metrics modes depending on the type of query that you want to make.

## Internal links for Elasticsearch

The new internal linking feature for Elasticsearch allows you to link to other data sources from your logs. You can now create links in Elastic configuration that point to another data source (similar to an existing feature in Loki). An example would be using a traceID field from your logs to be able to link to traces in a tracing data source like Jaeger.

## Transformations

We have added a new **Merge on time** transform that can combine many time series or table results. Unlike the join transform, this combines the result into one table even when the time values do not align / match.

The new table panel introduced in 7.0 was missing a few features that the old table panel had. This feature, along with ad hoc filtering, means that the new table panel has achieved feature parity with the old table panel.

## Ad hoc filtering in the new table panel

[Ad hoc filtering]({{< relref "../variables/variable-types/#ad-hoc-filters" >}}), a way to automatically add filters to queries without having to define template variables is now supported in the new Table panel.

## Stat panel text mode

The [stat panel]({{< relref "../visualizations/stat-panel/#text-mode" >}}) has a new **Text mode** option to control what text to show.

By default, the Stat panel displays:

- Just the value for a single series or field.
- Both the value and name for multiple series or fields.

You can use the Text mode option to control what text the panel renders. If the value is not important, only name and color is, then change the `Text mode` to **Name**. The value will still be used to determine color and is displayed in a tooltip.

{{< figure src="/static/img/docs/v71/stat-panel-text-modes.png" max-width="1025px" caption="Stat panel" >}}

## Provisioning of apps

Grafana v7.1 adds support for provisioning of app plugins. This allows app plugins to be configured and enabled/disabled using configuration files. For more information about provisioning of app, refer to [provisioning plugin]({{< relref "../administration/provisioning/#plugins" >}}).

## Azure Monitor data source

Support for multiple dimensions has been added to all services in the Azure Monitor datasource. This means you can now group by more than one dimension with time series queries. With the Kusto based services, Log Analytics and Application Insights Analytics, you can also select multiple metrics as well as multiple dimensions.

Additionally, the Raw Edit mode for Application Insights Analytics has been replaced with a new service in the drop-down for the data source and is called Insights Analytics. The new query editor behaves in the same way as Log Analytics.

## Deep linking for Google Cloud Monitoring (formerly named Google Stackdriver) data source

A new feature in Grafana 7.1 is [deep linking from Grafana panels to the Metrics Explorer in Google Cloud Console]({{< relref "../datasources/google-cloud-monitoring/#deep-linking-from-grafana-panels-to-the-metrics-explorer-in-google-cloud-console" >}}). Click on a time series in the panel to see a context menu with a link to View in Metrics explorer in Google Cloud Console. Clicking that link opens the Metrics explorer in the Monitoring Google Cloud Console and runs the query from the Grafana panel there.

## Time range picker update

With 7.1 we are updating the dashboard's time range picker to allow time zone selection. You no longer need to go to dashboard settings to change the dashboard's time zone.

The time zone picker itself also got UX improvements. Now you can search for the timezone using country or city name, time zone abbreviations, or UTC offsets.

## Grafana Enterprise features

General features are included in the Grafana Enterprise edition software.

### Support for HashiCorp Vault

You can now use HashiCorp Vault to get secrets for configuration and provisioning of Grafana Enterprise. For more information about HashiCorp Vault, refer to [vault]({{< relref "../setup-grafana/configure-security/configure-database-encryption/integrate-with-hashicorp-vault/" >}}).

### Support for monthly schedules in reports

With Grafana Enterprise 7.1, you can generate reports on a [monthly schedule]({{< relref "../share-dashboards-panels/#scheduling" >}}).

## Upgrading

See [upgrade notes]({{< relref "../setup-grafana/upgrade-grafana/" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.
