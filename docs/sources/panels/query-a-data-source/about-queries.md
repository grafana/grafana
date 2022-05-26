---
aliases:
  - /docs/sources/panels/query-a-data-source/about-queries/
title: About queries
weight: 10
---

# About queries

_Queries_ are how Grafana panels communicate with data sources to get data for the visualization. A query is a question written in the query language used by the data source. How often the query is sent to the data source and how many data points are collected can be adjusted in the panel data source options.

Use you a query editor to write a query. Each data source has its own query editor that we have customized to include the features and capabilities of the data source. Grafana supports up to 26 queries per panel.

> Important! You must be familiar with the query language of the data source. For more information about data sources, refer to [Data sources](../../../datasources/).

## Query editors

Depending on your data source, the query editor might provide auto-completion, metric names, or variable suggestions.

Because of the difference between query languages, data sources have query editors that look different. Here are two examples of query editors.

**InfluxDB query editor**

{{< figure src="/static/img/docs/queries/influxdb-query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" >}}

**Prometheus (PromQL) query editor**

{{< figure src="/static/img/docs/queries/prometheus-query-editor-7-4.png" class="docs-image--no-shadow" max-width="1000px" >}}

## Query syntax

Data sources use different query languages to return data. Here are two query examples:

**PostgreSQL**

```
SELECT hostname FROM host  WHERE region IN($region)
```

**PromQL**

```
query_result(max_over_time(<metric>[${__range_s}s]) != <state>)
```

## Data sources used in queries

In addition to the data sources that you have configured in Grafana, there are three special data sources available:

- **Grafana -** A built-in data source that generates random walk data, which can be useful for testing visualizations and running experiments.
- **Mixed -** Select this option to query multiple data sources in the same panel. When you select this data source, Grafana enables you to select a data source for every new query that you add.
  - The first query uses the data source that was selected before you selected **Mixed**.
  - You cannot change an existing query to use the Mixed Data Source.
- **Dashboard -** Select this option to use a result set from another panel in the same dashboard.

You can combine data from multiple data sources onto a single dashboard, but each panel is tied to a specific data source that belongs to a particular Organization.
