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

## Explore

{{< docs-imagebox img="/img/docs/v60/explore_prometheus.png" max-width="800px" class="docs-image--right" caption="Screenshot of the new Explore option in the panel menu" >}}

Grafana's dashboard UI is all about building dashboards for visualization. **Explore** strips away all the dashboard and panel options so that you can focus on the query & metric exploration. Iterate until you have a working query and then think about building a dashboard. You can also jump from a dashboard panel into **Explore** and from there do some ad-hoc query exporation with the panel queries as a starting point.

For infrastructure monitoring and incident response, you no longer need to switch to other tools to debug what went wrong. **Explore** allows you to dig deeper into your metrics and logs to find the cause. Grafana's new logging datasource, [Loki](https://github.com/grafana/loki) is tightly integrated into Explore and allows you to correlate metrics and logs by viewing them side-by-side.

**Explore** is a new paradigm for Grafana. It creates a new interactive debugging workflow that integrates two pillars of observability - metrics and logs.

#### Explore and Prometheus

The first version of Explore features a [custom querying experience for Prometheus](/features/explore/#prometheus-specific-features) and as well as an integration between Prometheus and Grafana Loki (see more about Loki below).

### Explore splits

Explore supports splitting the view so you can compare different queries, different datasources and metrics & logs side by side!

{{< docs-imagebox img="/img/docs/v60/explore_split.png" max-width="800px" caption="Screenshot of the new Explore option in the panel menu" >}}

### Explore and Grafana Loki

The log exploration & visualization features in Explore are available to any data source but are currently only implemented by the new open source log
aggregation system from Grafana Lab called [Grafana Loki](https://github.com/grafana/loki).

Loki is a horizontally-scalable, highly-available, multi-tenant log aggregation system inspired by Prometheus. It is designed to be very cost effective, as it does not index the contents of the logs, but rather a set of labels for each log stream. The logs from Loki are queried in a similar way to querying with label selectors in Prometheus. It uses labels to group log streams which can be made to match up with your Prometheus labels.

Read more about Grafana Loki [here](https://github.com/grafana/loki) or [Grafana Labs hosted Loki](https://grafana.com/loki).

The Explore feature allows you to query logs and features a new log panel.

In the near future, we will be adding support for other log sources to Explore and the next planned integration is ElasticSearch logs.

{{< docs-imagebox img="/img/docs/v60/explore_loki.png" max-width="1200px" class="docs-image--left" caption="Explore Loki Log Streams" >}}

### Easily Switch Visualization with Panel Edit UX Update

The UX for editing a panel has gotten an update and the major feature is being able to easily switch visualization using the new Visualization option. This means you can quickly switch from a Graph visualization to a Table visualization or any other visualization without having to create a new panel.

<div class="medium-6 columns">
   <video width="320" height="240" controls>
    <source src="/assets/videos/new_panel_edit_ux.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
  </div>

### Google Stackdriver Datasource

Built-in support for [Google Stackdriver](https://cloud.google.com/stackdriver/) is officially released in Grafana 6.0. Beta support was added in Grafana 5.3 and we have added lots of improvements since then.

To get started read the guide: [Using Google Stackdriver in Grafana](/features/datasources/stackdriver/).

### Azure Monitor Datasource

One of the goals of the Grafana v6.0 release is to add support for the three major clouds. Amazon Cloudwatch has been a core datasource for years and Google Stackdriver is also now supported. We developed an external plugin for Azure Monitor last year and for this release the [plugin](https://grafana.com/plugins/grafana-azure-monitor-datasource) is being moved into Grafana to be one of the built-in datasources. For users of the external plugin, Grafana will automatically start using the built-in version. As a core datasource, the Azure Monitor datasource will get alerting support for the official 6.0 release.

The Azure Monitor datasource integrates four Azure services with Grafana - Azure Monitor, Azure Log Analytics, Azure Application Insights and Azure Application Insights Analytics.

### Provisioning support for alert notifiers

Grafana now added support for provisioning alert notifiers from configuration files. Allowing operators to provision notifiers without using the UI or the API. A new field called `uid` has been introduced which is a string identifier that the administrator can set themselves. Same kind of identifier used for dashboards since v5.0. This feature makes it possible to use the same notifier configuration in multiple environments and refer to notifiers in dashboard json by a string identifier instead of the numeric id which depends on insert order and how many notifiers that exists in the instance.

### Auth and session token improvements
The previous session storage implementation in Grafana was causing problems in larger HA setups due to too many write requests to the database. The remember me token also have several security issues which is why we decided to rewrite auth middleware in Grafana and remove the session storage since most operations using the session storage could be rewritten to use cookies or data already made available earlier in the request. 
If you are using `Auth proxy` for authentication the session storage will still be used but our goal is to remove this ASAP as well.

This release will force all users to log in again since their previous token is not valid anymore.

### Other features

- The ElasticSearch datasource now supports [bucket script pipeline aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-pipeline-bucket-script-aggregation.html). This gives the ability to do per bucket computations like the difference or ratio between two metrics.

- The way session storage works has been refactored to be more secure and to be more performant by doing fewer writes to the database.

- Support for Google Hangouts Chat alert notifications

#### Technical Work - moving from Angular to React

The Grafana team is putting a huge amount of work into converting the frontend code in Grafana from Angular to React. Currently, all external plugins for Grafana are written in Angular but we are planning to also support plugins written in React very soon.

## Changelog

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list of new features, changes, and bug fixes.
