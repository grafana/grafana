+++
title = "What's New in Grafana v6.0"
description = "Feature & improvement highlights for Grafana v6.0"
keywords = ["grafana", "new", "documentation", "6.0"]
type = "docs"
[menu.docs]
name = "Version 6.0"
identifier = "v6.0"
parent = "whatsnew"
weight = -11
+++

# What's New in Grafana v6.0

This update to Grafana introduces a new way of exploring your data, support for log data and tons of other features.

The main highlights are:

- The new query-focused [Explore]({{< relref "#explore" >}}) workflow for troubleshooting and/or for data exploration.
- [Support for Grafana Loki]({{< relref "#explore-and-grafana-loki" >}}) - a new open source log aggregation system from Grafana Labs.
- [Easily Switch Visualization with the Panel Edit UX Update]({{< relref "#easily-switch-visualization-with-panel-edit-ux-update" >}})
- [Google Stackdriver Datasource]({{< relref "#google-stackdriver-datasource" >}}) is out of beta and is officially released.
- The [Azure Monitor]({{< relref "#azure-monitor-datasource" >}}) plugin is ported from being an external plugin to being a core datasource

### Explore

Grafana's dashboard UI is all about building dashboards for visualization. **Explore** strips away all the dashboard and panel options so that you can focus on the query. Iterate until you have a working query and then think about building a dashboard.

For infrastructure monitoring and incident response, you no longer need to switch to other tools to debug what went wrong. **Explore** allows you to dig deeper into your metrics and logs to find the cause. Grafana's new logging datasource, [Loki](https://github.com/grafana/loki) is tightly integrated into Explore and allows you to correlate metrics and logs by viewing them side-by-side.

{{< docs-imagebox img="/img/docs/v60/explore_split.png" class="docs-image--no-shadow" caption="Screenshot of the new Explore option in the panel menu" >}}

**Explore** is a new paradigm for Grafana. It creates a new interactive debugging workflow that integrates two pillars of observability - metrics and logs.

#### Explore and Prometheus

The first version of Explore features a [custom querying experience for Prometheus](/features/explore/#prometheus-specific-features) and as well as an integration between Prometheus and Grafana Loki (see more about Loki below).

### Explore and Grafana Loki

The Explore feature allows you to combine metric queries and log queries. The first log integration is for the new open source log aggregation system from Grafana Labs called [Grafana Loki](https://github.com/grafana/loki).

Loki a horizontally-scalable, highly-available, multi-tenant log aggregation system inspired by Prometheus. It is designed to be very cost effective, as it does not index the contents of the logs, but rather a set of labels for each log stream. The logs from Loki are queried in a similar way to querying with label selectors in Prometheus. It uses labels to group log streams which can be made to match up with your Prometheus labels.

Read more about Grafana Loki [here](https://github.com/grafana/loki) or [Grafana Labs hosted Loki](https://grafana.com/loki).

The Explore feature allows you to query logs and features a new log panel.

{{< docs-imagebox img="/img/docs/v60/explore_loki.png" class="docs-image--no-shadow" caption="Explore Loki Log Streams" >}}

In the near future, we will be adding support for other log sources to Explore and the next planned integration is ElasticSearch logs.

### Easily Switch Visualization with Panel Edit UX Update

The UX for editing a panel has gotten an update and the major feature is being able to easily switch visualization using the new Visualization option. This means you can quickly switch from a Graph visualization to a Table visualization or any other visualization without having to create a new panel.

### Google Stackdriver Datasource

Built-in support for [Google Stackdriver](https://cloud.google.com/stackdriver/) is officially released in Grafana 6.0. Beta support was added in Grafana 5.3 and we have added lots of improvements since then.

To get started read the guide: [Using Google Stackdriver in Grafana](/features/datasources/stackdriver/).

### Azure Monitor Datasource

One of the goals of the Grafana v6.0 release is to add support for the three major clouds. Amazon Cloudwatch has been a core datasource for years and Google Stackdriver is also now supported. We developed an external plugin for Azure Monitor last year and for this release the [plugin](https://grafana.com/plugins/grafana-azure-monitor-datasource) is being moved into Grafana to be one of the built-in datasources. For users of the external plugin, Grafana will automatically start using the built-in version. As a core datasource, the Azure Monitor datasource will get alerting support for the official 6.0 release.

The Azure Monitor datasource integrates four Azure services with Grafana - Azure Monitor, Azure Log Analytics, Azure Application Insights and Azure Application Insights Analytics.

#### Technical Work - moving from Angular to React

The Grafana team is putting a huge amount of work into converting the frontend code in Grafana from Angular to React. Currently, all external plugins for Grafana are written in Angular but we are planning to also support plugins written in React very soon.

## Changelog

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list of new features, changes, and bug fixes.
