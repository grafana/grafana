---
aliases:
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

The following image illustrates each of the gates, and the following sections describe each element, how it’s used, and why it’s necessary. The journey of a visualization begins at the data source and works its way through to a Grafana dashboard.

{{< figure src="/media/docs/grafana/dashboards-overview/dashboard-component-architecture.png" max-width="750px" caption="Dashboard component architecture" >}}

## Data Source

A data source is any entity that contains data. A data source can be a SQL database, Grafana Loki, Grafana Mimir, or a JSON-based API. A data source can even be a flat CSV file. A dashboard visualization starts with the data source that contains the data you want to see.

Understanding the differences between various data sources can be a challenge because each data source has a unique structure and requires different query methods. To simplify this complexity, Grafana Labs has developed plugins that unify these data sources into one coherent view.

## Plugins

A Grafana plugin is software that adds new capabilities to Grafana. They come in many types, but right now we will address _data source plugins_. The job of a Grafana data source plugin is to take a query you want answered, retrieve the  data from the data source, and reconcile the differences in data models using a unified data structure called a [data frame](https://grafana.com/docs/grafana/latest/developers/plugins/data-frames/). The data coming into the plugin from the data source might be many different formats (such as JSON, rows and columns, or CSV), but when it leaves the plugin and moves through the rest of the gates toward a visualization, it is always data frames.

At the time of this writing, there are 155 different kinds of data sources available to use with Grafana.  The most popular options come pre-installed installed and  ready to use. After you determine your needs, first check to see if a data source is already available. Grafana is expanding the list all the time, so if you don’t find what you need, you can [check the plugin catalog](https://grafana.com/grafana/plugins/?type=datasource) or even [build your own plugin](https://grafana.com/tutorials/build-a-data-source-plugin/).

## Query

Query enable you to reduce the data to just a specific dataset, so you aren't trying to visualize the entire thing. A query is an answer to a question you have about your system and operations. For example, if your company has an online presence, you might be interested in understanding how many customers are adding products to the shopping cart. To answer that question, you can write a query that  takes all of the access metrics for a shopping cart service, and aggregates them into how many users per second are accessing the service.

It’s important to understand that data sources have their own unique query languages. Prometheus data sources may use [PromQL](/blog/2020/02/04/introduction-to-promql-the-prometheus-query-language/), logs may be queried with [LogQL](https://grafana.com/docs/loki/latest/logql/), and certain databases may use other languages like SQL.  Each time you see a visualization in Grafana, it is backed by a query and an entire dashboard may use several different languages and types of query.

The following image shows the Query Editor associated with the Prometheus data source. The node_cpu_seconds_total query is written in PromQL and requests just one metric.

{{< figure src="/media/docs/grafana/dashboards-overview/example-query.png" max-width="750px" caption="Example Query" >}}

Queries are a very powerful way to express with precision the data that you want on a dashboard.

## Transforms

Not all panels will use [transforms](https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/). When you are first starting out, you may not need them, but they’re so powerful we have to mention them.  Sometimes the data that comes from your source won’t be shaped correctly.  Common examples include things like:

* **Situation**: you want to combine two fields together, like concatenating Given Name + Family Name into one single full name field; combining/concatenating two fields together
* **Situation**: you have CSV data, (all text), and you want to convert a field types (such as parsing a date or a number out of a string)
* **Situation**: you want to do common filtering, joining, merging, or other SQL-like operations which may not be supported by the underlying data source or query language

{{< figure src="/media/docs/grafana/dashboards-overview/example-transforms.png" max-width="750px" caption="Transform Dialog" >}}

Transforms are located next to the “Query” tab in the edit dialog for a panel. Select the kind of transform you want, and fill in the details to make the necessary data changes. The following image shows that just like queries, you can have as many transforms as you want. For example you can chain together changing a data type, filtering results, organizing columns, and sorting the result all into one data pipeline. Every time the dashboard is refreshed, it works continuously over fresh data from the data source.

{{< figure src="/media/docs/grafana/dashboards-overview/example-transform-chain.png" max-width="750px" caption="Example chain of transforms" >}}

## Panel

After the data is sourced, queried, and transformed, it passes to a panel which is the  final gate in the journey to a Grafana visualization.  A panel is a container that displays the visualization and provides you the controls to manipulate the visualization in many different ways.  The panel configuration is where you specify how you want to see the data. For example, it is within the panel that you use a drop-down menu in the top-right to specify the type of visualization you want to see such as a bar chart, pie chart, or histogram.

The Panel options enable you to customize many aspects of the visualization and change based on the visualization you select. Panels also contain queries that specify the data the panel is visualizing.

The following image shows a table panel being edited, together with the panel settings that let you see the query (bottom of frame) and the panel options (right of frame). This in turn shows how the data source, plugin, query, and panel all come together.

{{< figure src="/media/docs/grafana/dashboards-overview/example-table-panel.png" max-width="750px" caption="Example table panel" >}}

Selecting the best visualization depends on the data and how you want it presented.  To see examples of dashboards in one place that you can browse and inspect, check out [Grafana Play](https://play.grafana.org/), which has feature showcases and a variety of examples.

## Conclusion

With this model in mind, of data source -> plugin -> query -> transform -> panel, now you can see right through any Grafana dashboard you encounter, and imagine how to build your own.

Building a Grafana dashboard is a process that starts with determining your dashboard requirements and which data source supports those requirements. If you want to integrate a specialized database with a Grafana dashboard, it would be necessary to ensure the correct plugin is installed, so that you can create a data source to be used with that plugin.

And with the data source identified and the plugin installed, you can write your query, transform the data, and format the visualization to meet your needs.

This component architecture is part of what makes Grafana so powerful and general.  Given the data source plugin and data frame abstraction, any data source you have access to can work with the same general approach.
