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
weight: 300
---

# Grafana dashboards overview

Have you ever wondered what a dashboard is? In the observability world, this term is frequently used, but what exactly does it mean? The concept is borrowed from automobiles, where a dashboard gives drivers access to the controls necessary to operate a vehicle. Similarly, digital dashboards help us comprehend and manage systems. This topic explains how Grafana dashboards function, enabling you to create your own with greater ease.

The following image illustrates a sample Grafana dashboard.

{{< figure src="/media/docs/grafana/dashboards-overview/complex-dashboard-example.png" max-width="750px" caption="Example Grafana Dashboard" >}}

A Grafana dashboard consists of panels displaying data in beautiful graphs, charts, and other visualizations. These panels are created using components that transform raw data from a data source into visualizations. The process involves passing data through three gates: a plugin, a query, and an optional transformation.

The image below displays all the gates, followed by detailed explanations of their purpose, usage, and significance. The process of creating a visualization starts from the data source and progresses towards a Grafana dashboard.

{{< figure src="/media/docs/grafana/dashboards-overview/dashboard-component-architecture.png" max-width="750px" caption="Dashboard component architecture" >}}

## Data source

A data source refers to any entity that consists of data. It can be a SQL database, Grafana Loki, Grafana Mimir, or a JSON-based API. It can even be a basic CSV file. The first step in creating a dashboard visualization is selecting the data source that contains the data you need.

It can be difficult to understand the distinctions between different data sources as each possesses its own structure and requires different query methods. However, to streamline this complexity, Grafana Labs has created plugins that unify data sources into one coherent view.

## Plugins

A Grafana plugin is software that adds new capabilities to Grafana. They come in many types, but right now we will address _data source plugins_. The job of a Grafana data source plugin is to take a query you want answered, retrieve the  data from the data source, and reconcile the differences in data models using a unified data structure called a [data frame](https://grafana.com/docs/grafana/latest/developers/plugins/data-frames/). The data coming into the plugin from the data source might be many different formats (such as JSON, rows and columns, or CSV), but when it leaves the plugin and moves through the rest of the gates toward a visualization, it is always data frames.

Currently, Grafana offers a diverse range of 155 data sources that you can use. The most commonly used options are already pre-installed and accessible. Before exploring other options, look for an existing data source that matches your requirements. Grafana constantly updates the list, but if you don't find a suitable data source, you can browse through the [plugin catalog](/grafana/plugins/?type=datasource) or [create a plugin](/tutorials/build-a-data-source-plugin/).

## Query

Queries allow for the reduction of data to a specific dataset, providing a more manageable visualization. They help answer questions you have about system and operational processes. For instance, a company with an online store might want to determine the number of customers who add products to their shopping carts. This can be achieved through a query that aggregates access metrics for the shopping cart service, revealing the number of users accessing the service per second.

When working with data sources, it is crucial to recognize that each one has its own distinct query language. For example, Prometheus data sources utilize [PromQL](/blog/2020/02/04/introduction-to-promql-the-prometheus-query-language/), while [LogQL](https://grafana.com/docs/loki/latest/logql/) is used for logs, and particular databases employ SQL. A query supports every visualization in Grafana, and a dashboard might feature a range of query languages.

The following image shows the Query Editor associated with the Prometheus data source. The `node_cpu_seconds_total` query is written in PromQL and requests just one metric.

{{< figure src="/media/docs/grafana/dashboards-overview/example-query.png" max-width="750px" caption="Example Query" >}}


## Transforms

When the data format in a visualization doesn’t meet your requirements, you can apply a [transformation]({{< relref "../panels-visualizations/query-transform-data/transform-data" >}}) that manipulates the data returned by a query. You might not need to transform data when you are first starting out, but they are powerful and worth mentioning.

Transforming data is useful in the following kinds of situations: 

- You want to combine two fields together, for example, concatenating `Given Name` and `Family Name` into a `Full Name` field
- You have CSV data (all text), and you want to convert a field types (such as parsing a date or a number out of a string)
- You want to filter, join, merge, or perform other SQL-like operations that might not be supported by the underlying data source or query language


Transforms are located next to the **Query** tab in the edit dialog for a panel. Select the transform you want, and define the transform. The following image shows that you can have as many transforms as you want, just like queries. For example, you can chain together a series of transforms that make a change to a data type, filter results, organize columns, and sort the result into one data pipeline. Every time the dashboard is refreshed, the transform applies to the latest data from the data source.

{{< figure src="/media/docs/grafana/dashboards-overview/example-transform-chain.png" max-width="750px" caption="Example chain of transforms" >}}

## Panel

After the data is sourced, queried, and transformed, it passes to a panel which is the  final gate in the journey to a Grafana visualization.  A panel is a container that displays the visualization and provides you the controls to manipulate the visualization in many different ways.  The panel configuration is where you specify how you want to see the data. For example, it is within the panel that you use a drop-down menu in the top-right to specify the type of visualization you want to see such as a bar chart, pie chart, or histogram.

The panel options enable you to customize many aspects of the visualization and change them based on the visualization you select. Panels also contain queries that specify the data the panel is visualizing.

The following image shows a table panel being edited, together with the panel settings that let you see the query (bottom of frame) and the panel options (right of frame). This in turn shows how the data source, plugin, query, and panel all come together.

{{< figure src="/media/docs/grafana/dashboards-overview/example-table-panel.png" max-width="750px" caption="Example table panel" >}}

Selecting the best visualization depends on the data and how you want it presented.  To see examples of dashboards in one place that you can browse and inspect, check out [Grafana Play](https://play.grafana.org/), which has feature showcases and a variety of examples.

## Conclusion

With this model in mind, of data source -> plugin -> query -> transform -> panel, now you can see right through any Grafana dashboard you encounter, and imagine how to build your own.

Building a Grafana dashboard is a process that starts with determining your dashboard requirements and which data source supports those requirements. If you want to integrate a specialized database with a Grafana dashboard, it would be necessary to ensure the correct plugin is installed, so that you can create a data source to be used with that plugin.

And with the data source identified and the plugin installed, you can write your query, transform the data, and format the visualization to meet your needs.

This component architecture is part of what makes Grafana so powerful and general.  Given the data source plugin and data frame abstraction, any data source you have access to can work with the same general approach.
