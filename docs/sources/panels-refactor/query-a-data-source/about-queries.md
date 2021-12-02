+++
title = "About queries"
weight = 1
+++

# About queries

_Queries_ are how Grafana panels communicate with data sources to get data for the visualization. A query is a question written in the query language used by the data source. Grafana asks, "Hey data source, would you send me this data, organized this way?" If the query is properly formed, then the data source responds. How often the query is sent to the data source and how many data points are collected can be adjusted in the panel data source options.

Grafana supports up to 26 queries per panel.

+++++++++++++++++++
Each data source has a specific Query Editor that is customized for the features and capabilities that the particular data source exposes. The query language and capabilities of each data source are obviously very different. You can combine data from multiple data sources onto a single Dashboard, but each Panel is tied to a specific data source that belongs to a particular Organization.

## Query editors

Query editors are forms that help you write queries. Depending on your data source, the query editor might provide auto-completion, metric names, or variable suggestion.

Because of the difference between query languages, data sources may have query editors that look different. Here are two examples of query editors:

**InfluxDB query editor**

{{< figure src="/static/img/docs/queries/influxdb-query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" >}}

**Prometheus (PromQL) query editor**

{{< figure src="/static/img/docs/queries/prometheus-query-editor-7-4.png" class="docs-image--no-shadow" max-width="1000px" >}}

## Query syntax

Data sources have different query languages and syntaxes to ask for the data. Here are two query examples:

**PostgreSQL**

```
SELECT hostname FROM host  WHERE region IN($region)
```

**PromQL**

```
query_result(max_over_time(<metric>[${__range_s}s]) != <state>)
```

For more information about writing a query for your data source, refer to the specific [Grafana data source]({{< relref "../datasources/_index.md" >}}) documentation.

### Examples:

- **Relative time:**

| Example          | Relative time field |
| ---------------- | ------------------- |
| Last 5 minutes   | `now-5m`            |
| The day so far   | `now/d`             |
| Last 5 days      | `now-5d/d`          |
| This week so far | `now/w`             |
| Last 2 years     | `now-2y/y`          |

- **Time shift:**

| Example              | Time shift field |
| -------------------- | ---------------- |
| Last entire week     | `1w/w`           |
| Two entire weeks ago | `2w/w`           |
| Last entire month    | `1M/M`           |
| This entire year     | `1d/y`           |
| Last entire year     | `1y/y`           |
