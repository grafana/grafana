---
description: Learn how Grafana dashboards are built.
keywords:
  - grafana
  - dashboards
  - panel
  - data source
  - transform
  - query
title: Grafana dashboards overview
menuTitle: Dashboard overview
weight: 390
---

# Grafana dashboards overview

Have you ever wondered what a dashboard is? In the observability world, this term is frequently used, but what exactly does it mean? The concept is borrowed from automobiles, where a dashboard gives drivers access to the controls necessary to operate a vehicle. Similarly, digital dashboards help us comprehend and manage systems. This topic explains how Grafana dashboards function, enabling you to create your own with greater ease.

The following image illustrates a sample Grafana dashboard:

{{< figure src="/media/docs/grafana/dashboards-overview/complex-dashboard-example.png" max-width="750px" caption="Example Grafana dashboard" >}}

A Grafana dashboard consists of panels displaying data in beautiful graphs, charts, and other visualizations. These panels are created using components that transform raw data from a data source into visualizations. The process involves passing data through three gates: a plugin, a query, and an optional transformation.

The image below displays all the gates, followed by detailed explanations of their purpose, usage, and significance.

{{< figure src="/media/docs/grafana/dashboards-overview/dashboard-component-architecture.png" max-width="750px" caption="Dashboard component architecture" >}}

## Data sources

A data source refers to any entity that consists of data. It can be an SQL database, Grafana Loki, Grafana Mimir, or a JSON-based API. It can even be a basic CSV file. The first step in creating a dashboard visualization is selecting the data source that contains the data you need.

It can be difficult to understand the distinctions between different data sources as each possesses its own structure and requires different query methods. However, in dashboards, you can see different data sources visualized in one single view, making it easier to understand your data overall.

## Plugins

A Grafana plugin is software that adds new capabilities to Grafana. They come in many types, but right now we'll address _data source plugins_. The job of a Grafana data source plugin is to take a query you want answered, retrieve the data from the data source, and reconcile the differences between the data model of the data source and the data model of Grafana dashboards. It does this using a unified data structure called a [data frame][data-frames].

The data coming into the plugin from the data source might be in many different formats (such as JSON, rows and columns, or CSV), but when it leaves the plugin and moves through the rest of the gates toward a visualization, it's always in data frames.

Currently, Grafana offers a diverse range of 155 data sources that you can use. The most commonly used options are already pre-installed and accessible. Before exploring other options, look for an existing data source that matches your requirements. Grafana constantly updates the list, but if you don't find a suitable data source, you can browse through the [plugin catalog](/grafana/plugins/?type=datasource) or [create a plugin]({{< relref "../../developers/plugins/create-a-grafana-plugin" >}}).

## Queries

Queries allow you to reduce the entirety of your data to a specific dataset, providing a more manageable visualization. They help answer questions you have about system and operational processes. For instance, a company with an online store might want to determine the number of customers who add products to their shopping carts. This can be achieved through a query that aggregates access metrics for the shopping cart service, revealing the number of users accessing the service per second.

When working with data sources, it's crucial to recognize that each one has its own distinct query language. For example, Prometheus data sources utilize [PromQL](/blog/2020/02/04/introduction-to-promql-the-prometheus-query-language/), while [LogQL](/docs/loki/latest/logql/) is used for logs, and particular databases employ SQL. A query is the foundation of every visualization in Grafana, and a dashboard might use a range of query languages.

The following image shows the Query Editor associated with the Prometheus data source. The `node_cpu_seconds_total` query is written in PromQL and requests just one metric:

{{< figure src="/media/docs/grafana/dashboards-overview/example-query.png" max-width="750px" caption="Example query" >}}

## Transformations

When the data format in a visualization doesn’t meet your requirements, you can apply a [transformation][transform-data] that manipulates the data returned by a query.
You might not need to transform data when you're first starting out, but they're powerful and worth mentioning.

Transforming data is useful in the following kinds of situations:

- You want to combine two fields together, for example, concatenating `Given Name` and `Family Name` into a `Full Name` field.
- You have CSV data (all text), and you want to convert a field type (such as parsing a date or a number out of a string).
- You want to filter, join, merge, or perform other SQL-like operations that might not be supported by the underlying data source or query language.

Transformations are located in the **Transform** tab in the edit dialog for a panel. Select the transformation you want, and define the transformation. The following image shows that you can have as many transformations as you want, just like queries. For example, you can chain together a series of transformations that make a change to a data type, filter results, organize columns, and sort the result into one data pipeline. Every time the dashboard is refreshed, the transformation applies to the latest data from the data source.

The following image shows the transformation dialog:

{{< figure src="/media/docs/grafana/dashboards-overview/example-transform-chain.png" max-width="750px" caption="Example chain of transformations" >}}

## Panels

After the data is sourced, queried, and transformed, it passes to a panel, which is the final gate in the journey to a Grafana visualization. A panel is a container that displays the visualization and provides you with various controls to manipulate it. The panel configuration is where you specify how you want to see the data. For example, you use a drop-down menu in the top-right of the panel to specify the type of visualization you want to see, such as a bar chart, pie chart, or histogram.

The panel options let you customize many aspects of the visualization and the options differ based on which visualization you select. Panels also contain queries that specify the data the panel is visualizing.

The following image shows a table panel being edited, the panel settings showing the query at the bottom, and the panel options on the right. In this image, you can see how the data source, plugin, query, and panel all come together.

{{< figure src="/media/docs/grafana/dashboards-overview/example-table-panel.png" max-width="750px" caption="Example table panel" >}}

Selecting the best visualization depends on the data and how you want it presented. To see examples of dashboards in one place that you can browse and inspect, refer to [Grafana Play](https://play.grafana.org/), which has feature showcases and a variety of examples.

## Conclusion

With the data source, plugin, query, transformation, and panel model in mind, you can now see right through any Grafana dashboard you encounter, and imagine how to build your own.

Building a Grafana dashboard is a process that starts with determining your dashboard requirements and identifying which data sources support those requirements. If you want to integrate a specialized database with a Grafana dashboard, you must ensure the correct plugin is installed so that you can add a data source to use with that plugin.

And with the data source identified and the plugin installed, you can write your query, transform the data, and format the visualization to meet your needs.

This component architecture is part of what makes Grafana so powerful and general. Given the data source plugin and data frame abstraction, any data source you can access can work with the same general approach.

{{% docs/reference %}}
[data-frames]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/developers/plugins/introduction-to-plugin-development/data-frames"
[data-frames]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/developers/plugins/introduction-to-plugin-development/data-frames"

[transform-data]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data/transform-data"
[transform-data]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data/transform-data"
{{% /docs/reference %}}
