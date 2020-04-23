+++
title = "Data sources overview"
description = "Overview of data sources in Grafana"
keywords = ["grafana", "data sources"]
type = "docs"
[menu.docs]
name = "Data sources overview"
parent = "datasources"
weight = 1
+++

# Data sources

Grafana can visualize, explore, and alert on data from many different databases and cloud services. Each database or service type is accessed from a *data source*. Before you can create visualizations in Grafana, you must [add a data source]({{< relref "add-a-data-source.md" >}}).

Each data source has a specific query editor that is customized for the features and capabilities that the particular data source exposes. The query language and capabilities of each data source are obviously very different. You can combine data from multiple data sources into a single dashboard, but each panel is connected to a specific data source that belongs to a particular organization.

Use the query editor to build one or more queries in your time series database. The panel instantly updates, allowing you to effectively explore your data in real time and build a perfect query for that particular panel.

You can use [template variables]({{< relref "../../reference/templating.md" >}}) in the query editor within the queries themselves. This provides a powerful way to explore data dynamically based on the templating variables selected on the dashboard.

Grafana allows you to reference queries in the query editor by the row that they’re on. If you add a second query to graph, you can reference the first query by typing in #A. This provides an easy and convenient way to build compound queries.