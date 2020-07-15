+++
title = "What's New in Grafana v7.1"
description = "Feature and improvement highlights for Grafana v7.1"
keywords = ["grafana", "new", "documentation", "7.1", "release notes"]
type = "docs"
[menu.docs]
name = "Version 7.1"
identifier = "v7.1"
parent = "whatsnew"
weight = -16
+++

# What's new in Grafana v7.1

This topic includes the release notes for the Grafana v7.1, which is currently in beta. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

The main highlights are:

- [**Query history search**]({{< relref "#query-history-search" >}})
- [**Provisioning of apps**]({{< relref "#provisioning-of-apps" >}})
- [**Azure Monitor Datasource**]({{< relref "#azure-monitor-datasource" >}})
- [**Influx Datasource**]({{< relref "#influx-datasource" >}})
- [**Deep linking for Google Cloud Monitoring (formerly named Google Stackdriver) datasource**]({{< relref "#deep-linking-for-google-cloud-monitoring-formerly-named-google-stackdriver-datasource" >}})
- [**Transforms**]({{< relref "#transforms" >}})
- [**Stat panel text mode**]({{< relref "#stat-panel-text-mode" >}})
- [**Unification of Explore modes**]({{< relref "#explore-modes-unified" >}})
- [**Grafana Enterprise features**]({{< relref "#grafana-enterprise-features" >}})
  - [**Support for HashiCorp Vault**]({{< relref "#support-for-hashicorp-vault" >}})
  - [**Internal links for Elastic**]({{< relref "#internal-links-for-elastic" >}})

## Query history search

In Grafana v 7.1 we are introducing search functionality in Query history. You can search across queries and your comments. It is especially useful in combination with a time filter and data source filter. Read more about Query history [here]({{<relref "../features/explore/index.md#query-history" >}}).

{{< docs-imagebox img="/img/docs/v71/query_history_search.gif" max-width="800px" caption="Query history search" >}}

## Provisioning of apps

Grafana v7.1 adds support for provisioning of app plugins. This allows app plugins to be configured and enabled/disabled using configuration files. Read more about provisioning of app plugins [here]({{ < relref "../administration/provisioning.md#plugins" >}}).

## Azure Monitor Datasource

Support for multiple dimensions has been added to all services in the Azure Monitor datasource. This means you can now group by more than one dimension with time series queries. With the Kusto based services, Log Analytics and Application Insights Analytics, you can also select multiple metrics as well as multiple dimensions.

Additionally, the “Raw Edit” mode for Application Insights Analytics has been replaced with a new service in the drop down for the datasource and is called “Insights Analytics”. The new query editor behaves in the same way as Log Analytics.

## Influx Datasource

Support for Flux and Influx v2 has been added.

## Deep linking for Google Cloud Monitoring (formerly named Google Stackdriver) datasource

A new feature in Grafana 7.1 is [deep linking from Grafana panels to the Metrics Explorer in Gooogle Cloud Console]({{<relref "../features/datasources/cloudmonitoring.md#deep-linking-from-grafana-panels-to-the-metrics-explorer-in-google-cloud-console">}}). Click on a time series in the panel to see a context menu with a link to View in Metrics explorer in Google Cloud Console. Clicking that link opens the Metrics explorer in the Monitoring Google Cloud Console and runs the query from the Grafana panel there.

## Internal links for Elastic

You can now create links in Elastic configuration that point to another datasource similar to existing feature in
Loki. This allows you to link traceID from your logs to tracing data source in Grafana.

## Transformations

We have added a new **Merge on time** transform that can combine many time series or table results. Unlike the join transform this combines the result into one table even when the time values does not align / match.

## Stat panel text mode

The [stat panel]({{<relref "../panels/visualizations/stat-panel.md#text-mode" >}}) has a new **Text mode** option to control what text to show.

By default, the Stat panel displays:

- Just the value for a single series or field.
- Both the value and name for multiple series or fields.

You can use the Text mode option to control what text the panel renders. If the value is not important, only name and color is, then change the `Text mode` to **Name**. The value will still be used to determine color and is displayed in a tooltip.

{{< docs-imagebox img="/img/docs/v71/stat-panel-text-modes.png" max-width="1025px" caption="Stat panel" >}}

## Explore modes unified

Grafana 7.1 includes a major change to Explore: it removes the query mode selector.

Many data sources tell Grafana whether a response contains time series data or logs data. Using this information, Explore chooses which visualization to use for that data. This means that you don't need to switch back and forth between Logs and Metrics modes depending on the type of query that you want to make. 

## Grafana Enterprise features

General features are included in the Grafana Enterprise edition software.

### Support for HashiCorp Vault

You can now use HashiCorp Vault to get secrets for configuration and provisioning of Grafana Enterprise. Learn more about this feature [here]({{<relref "../enterprise/vault.md">}}).

### Support for monthly in reports

With Grafana Enterprise 7.1 you can configure reports to be generated on a [monthly schedule]({{<relref "../enterprise/reporting.md#scheduling">}}).

## Upgrading

See [upgrade notes]({{<relref "../installation/upgrading.md">}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.
