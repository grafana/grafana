+++
title = "What's New in Grafana v7"
description = "Feature and improvement highlights for Grafana v7"
keywords = ["grafana", "new", "documentation", "7.0", "release notes"]
type = "docs"
[menu.docs]
name = "Version 7.0"
identifier = "v7.0"
parent = "whatsnew"
weight = -17
+++

# What's new in Grafana v7.0

This topic includes the release notes for the Grafana v7.0, which is currently in beta. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

This major release of Grafana contains a lot of new features and enhancements including the next step in our Observability story, powerful new features for manipulating, transforming and doing math on data and the first version of Usage Analytics in Grafana Enterprise.

The Grafana 7.0 stable will be released on the 18th of May. In the meantime if your want to know more about what we have been up to and what is coming sign up to our online GrafanaCon conference.

[{{< figure src="/assets/img/blog/GrafanaCONline.jpg" max-width="800px" lightbox="false" caption="GrafanaCONline May 13-29" >}}](https://grafana.com/about/events/grafanacon/2020/?source=blog)

The main highlights are:

- **New Panel Editor:** Redesign based on community feedback
- **Explore:** New tracing UI and support for visualizing Jaeger and Zipkin traces.
- **Enterprise:** Usage Analytics and Presence
- **Transformations:** Transformations and simple Math operations for all data sources.
- **Field overrides:** Automatically configure panels with data from queries.
- **Table:** New Table panel.
- **Plugins:** New plugins platform
- **Tutorials:** New tutorials section
- **Cloudwatch:** Cloudwatch Logs
- **Breaking change:** PhantomJS removed

## New Panel Editor

In Grafana 7.0 we have redesigned the UI for editing panels. The first visible change is that we have separated panel display settings to a right-hand side pane that you can collapse or expand depending on what your focus is on. With this change we are also introducing our new unified option model and UI for defining data configuration and display options. This unified data configuration system powers a consistent UI for setting data options across visualizations and making all data display settings data driven and overridable.

## New tracing UI

With Grafana 7.0 we are adding major support for distributed tracing. This adds an important telemetry mode to complement the existing support for metrics and logs. Traces allow you to follow how single requests travelled through a distributed system. We are starting with an integrated trace viewer and two new built-in data sources: Jaeger and Zipkin.

You can use the new trace view in Explore either directly and search for a particular trace or you can configure Loki to detect trace IDs in the log lines and link directly to a trace timeline pulled from Jaeger or Zipkin data source.

In the future we will add more workflows and integrations so that correlating between metrics, logs and traces is even easier.

## Transformations

Not just visualizing data from anywhere, in Grafana 7.0 you can transform them, too. By chaining a simple set of point and click transformations users will be able join, pivot, filter, re-name and calculate to get the results they need. Perfect for operations across queries or data sources missing essential data transformations.

Transformations and maths across queries. The data you want to visualize can come from many different places and it is usually not in exactly the right form. The new transformations feature allows you to rename fields, join separate time series together and more - data munging. Usually this requires writing code but this new feature lets you do it in the Grafana UI instead. It also lets you do maths across queries. Lots of data sources do not support this natively so being able to do it in Grafana is a killer feature. For users, with large dashboards or with heavy queries, being able to reuse the query result from one panel in another panel can be a huge performance gain.

**Transformations shipping in 7.0**

- **Reduce:** Reduce many rows / data points to a single value
- **Filter by name:** Filter fields by name or regex
- **Filter by refId:** Filter by query letter
- **Organize fields:** Reorder, rename and hide fields.
- **Labels to fields:** Transform time series with labels into a table where labels get's converted to fields and the result is joined by time
- **Join by field:** Join many result sets (series) together using for example the time field. Useful for transforming time series into a table with a shared time column and where each series get it's own column.
- **Add field from calculation:** This is a powerful transformation that allows you perform many different types of math operations and add the result as a new field. Examples:
  - Calculate the difference between two series or fields and add the result to a new field
  - Multiply one field with another another and add the result to a new field

## Field overrides

With Grafana 7.0 we are introducing a new, unified data configuration system that powers a consistent UI for setting data options across visualizations as well as making all data display settings data driven and overridable. This new option architecture and UI will make all panels have a consistent set of options and behaviors for attributes like `unit`, `min`, `max`, `thresholds`, `links`, `decimals` or `value mappings`. Not only that but all these options will share a consistent UI for specifying override rules and is extensible for custom panel specific options.

Up until now the overrides were available only for Graph and Table panel(via Column Styles), but with 7.0 they work consistently across all visualisation types and plugins.

This feature enables even more powerful visualizations and fine grained control over how the data is displayed.

## Panel inspect and export to CSV

Another new feature of Grafana 7.0 is Panel inspect. Inspect allows you to view the raw data for any Grafana panel as well as export that data to a CSV file. With Panel inspect you will also be able to perform simple raw data transformations like join, view query stats or detailed execution data.

{{< docs-imagebox img="/img/docs/v70/panel_edit_export_raw_data.png" max-width="1024px" caption="Panel Edit - Export raw data to CSV" >}}
{{< docs-imagebox img="/img/docs/v70/panel_edit_query_inspector.png" max-width="1024px" caption="Panel Edit - Query Inspector" >}}
{{< docs-imagebox img="/img/docs/v70/panel_edit_raw_json.png" max-width="1024px" caption="Panel Edit - View raw JSON" >}}
{{< docs-imagebox img="/img/docs/v70/panel_edit_stats.png" max-width="1024px" caption="Panel Edit - Stats" >}}

## Table panel

Grafana 7.0 comes with a new table panel (and deprecates the old one). This new table panel supports horizontal scrolling and column resize. Paired with the new `Organize fields` transformation detailed above you can reorder, hide & rename columns. This new panel also supports new cell display modes, like showing a bar gauge inside a cell.

{{< youtube J29wILRh3QQ >}}

## Auto grid mode for Stat panel and Gauge

This new 7.0 feature is for the gauge and stat panels. Before, stat and gauge only supported horizontal or vertical stacking: The auto layout mode just selected vertical or horizontal stacking based on the panel dimensions (whatever was highest). But in 7.0 the auto layout for these two panels will allow dynamic grid layouts where Grafana will try to optimize the usage of space and lay out each sub-visualization in a grid.

{{< youtube noq1rLGvsrU >}}

## Cloudwatch Logs

Grafana 7.0 adds logging support to one of our most popular cloud provider data sources. Autocomplete support for Cloudwatch Logs queries is included for improved productivity.

## Plugin platform

### Support for backend component - can add alerting to external plugins

### Front end plugins platform

In Grafana 7.0 we are maturing our panel and front-end datasource plugins platform. @grafana/ui, @grafana/data, @grafana/runtime, @grafana/e2e packages (available via NPM) aim to simplify the way plugins are developed. We want to deliver a set of [reliable APIs](https://grafana.com/docs/grafana/latest/packages_api/) and [components library](https://developers.grafana.com/ui) for plugin developers.

With [[@grafana/toolkit](https://www.npmjs.com/package/@grafana/toolkit) we are delivering a simple CLI that helps plugin authors quickly scaffold, develop and test their plugins without worrying about configuration details.

## New tutorials

To help you get started with Grafana, we’ve launched a brand new tutorials platform. We’ll continue to expand the platform with more tutorials, but here are some of the ones you can try out now:

- [Grafana fundamentals](https://grafana.com/tutorials/grafana-fundamentals/)
- [Create users and teams](https://grafana.com/tutorials/create-users-and-teams/)
- [Build a panel plugin](https://grafana.com/tutorials/build-a-panel-plugin/)
- [Build a data source plugin](https://grafana.com/tutorials/build-a-data-source-plugin/)

## Rollup indicator for Metrictank queries

Depending on the cardinality of the data and the time range MetricTank may return rolled up data (in our case, configured for hourly). This can be subtle as potentially only 1 or 2 graphs out of nine are rolled up.

https://github.com/grafana/grafana/pull/22738

## Breaking change - PhantomJS removed

[PhantomJS](https://phantomjs.org/), have been used for rendering images of dashboards and panels and have been included with Grafana since Grafana v2.0. Since then we’ve had a lot of related bugs and security related issues, mainly due to the fact that PhantomJS have struggled with supporting modern web technologies. Throughout the years, maintaining PhantomJS support in Grafana has been a nightmare. Removing support for PhantomJS has been a high priority for the Grafana project and got stressed even more when the PhantomJS maintainer in March 2018 [announced](https://github.com/ariya/phantomjs/issues/15344) the end of the project.

Since then we have been working towards removing PhantomJS. In October 2019, when Grafana v6.4 was released, we [announced](https://grafana.com/blog/2019/10/02/grafana-v6.4-released/#phantomjs-deprecation) the deprecation of PhantomJS. Grafana v7.0 removes all PhantomJS support which means that Grafana distribution no longer will include a built-in image renderer.

As a replacement for PhantomJS we’ve developed the [Grafana Image Renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) which is a plugin that runs on the backend and handles rendering panels and dashboards as PNG images using headless Chromium/Chrome. The [Grafana Image Renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) can either be installed as a Grafana plugin running in its own process side-by-side with Grafana. or run as an external HTTP service, hosted using Docker or as a standalone application.

Read more about [Image Rendering]({{< relref "../administration/image_rendering/" >}}) in the documentation for further instructions.

## Rich History in Explore out of beta

## Stackdriver data source supports Service Monitoring

[Service monitoring](https://cloud.google.com/service-monitoring) in Google Cloud Platform (GCP) enables you to monitor based on Service Level Objectives (SLOs) for your GCP services. The new SLO query builder in the Stackdriver data source allows you to display SLO data in Grafana.

https://grafana.com/docs/grafana/latest/features/datasources/stackdriver/#slo-service-level-objective-queries

## Time zone support

### Grafana Enterprise

Grafana Enterprise focuses on solving problems for large companies and Grafana installations. And in Grafana 7.0 we are finally
solving one of the most common problems of using Grafana at scale.

That is problems like:

- There are too many dashboards, how do I find the right one?
- How to find popular dashboards
- How to find dashboards with errors
- How to identify dashboards that are not being used
- Who created or last viewed this dashboard?

## Usage Analytics and Presence

In Grafana 7.0 we are introducing a series of features that build on our new usage analytics engine. Features like improved dashboard search to sort dashboards by usage and errors. When a user opens a dashboard, they will see a presence indicator of who else is viewing the same dashboard. And finally open a dashboard usage stats drawer to view recent dashboard usage.

{{< docs-imagebox img="/img/docs/v70/presence_indicator.jpg" max-width="1024px" caption="Grafana Enterprise - Presence Indicator" >}}
{{< docs-imagebox img="/img/docs/v70/dashboard_insights_stats.png" max-width="1024px" caption="Dashboard Insights Stats" >}}
{{< docs-imagebox img="/img/docs/v70/dashboard_insights_users.png" max-width="1024px" caption="Dashboard Insights Users" >}}
{{< docs-imagebox img="/img/docs/v70/improved_search.png" max-width="1024px" caption="Search" >}}

## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading/#upgrading-to-v7-0" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.
