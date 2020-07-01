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

- [**Unified querying experience in Explore**]({{< relref "#unified-querying-experience-in-explore" >}})
- [**Query history search**]({{< relref "#query-history-search" >}})
- [**Provisioning of apps**]({{< relref "#provisioning-of-apps" >}})
- [**Azure Monitor Datasource**]({{< relref "#azure-monitor-datasource" >}})
- [**Influx Datasource**]({{< relref "#influx-datasource" >}})
- [**Deep linking for Google Cloud Monitoring (formerly named Google Stackdriver) datasource**]({{< relref "#influx-datasource" >}})
- [**Grafana Enterprise features**]({{< relref "#grafana-enterprise-features" >}})
- [**Support for HashiCorp Vault**]({{< relref "#support-for-hashicorp-vault" >}})
- [**Internal links for Elastic**]({{< relref "#internal-links-for-elastic" >}})

## Unified querying experience in Explore
TODO

## Query history search
In Grafana v 7.1 we are introducing search functionality in Query history. You can search across queries and your comments. It is especially useful in combination with a time filter and data source filter. Read more about Query history [here]({{ < relref ”../features/explore/index.md#query-history” >}}).

## Provisioning of apps

Grafana v7.1 adds support for provisioning of app plugins. This allows app plugins to be configured and enabled/disabled using configuration files. Read more about provisioning of app plugins [here]({{ < relref ”../administration/provisioning.md#plugins” >}}).  

## Azure Monitor Datasource

Support for multiple dimensions has been added to all services in the Azure Monitor datasource. This means you can now group by more than one dimension with time series queries. With the Kusto based services, Log Analytics and Application Insights Analytics, you can also select multiple metrics as well as multiple dimensions.

Additionally, the “Raw Edit” mode for Application Insights Analytics has been replaced with a new service in the drop down for the datasource and is called “Insights Analytics”. The new query editor behaves in the same way as Log Analytics.  

## Influx Datasource

Support for Flux and Influx v2 has been added.

## Deep linking for Google Cloud Monitoring (formerly named Google Stackdriver) datasource

A new feature in Grafana 7.1 is [deep linking from Grafana panels to the Metrics Explorer in Gooogle Cloud Console]({{< relref "../features/datasources/cloudmonitoring.md#deep-linking-from-grafana-panels-to-the-metrics-explorer-in-gooogle-cloud-console" >}}). Click on a time series in the panel to see a context menu with a link to View in Metrics explorer in Google Cloud Console. Clicking that link opens the Metrics explorer in the Monitoring Google Cloud Console and runs the query from the Grafana panel there.

## Internal links for Elastic

You can now create links in Elastic configuration that point to another datasource similar to existing feature in
 Loki. This allows you to link traceID from your logs to tracing data source in Grafana.

## Grafana Enterprise features

General features are included in the Grafana Enterprise edition software.

### Support for HashiCorp Vault

You can now use HashiCorp Vault to get secrets for configuration and provisioning of Grafana Enterprise. Learn more about this feature [here]({{< relref "../enterprise/vault.md" >}}). 

### Support for monthly in reports

With Grafana Enterprise 7.1 you can configure reports to be generated on a [monthly schedule]({{< relref "../enterprise/reporting.md#scheduling" >}}).

## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading.md" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.
