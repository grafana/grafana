---
aliases:
  - /docs/grafana/latest/panels/expressions/
  - /docs/grafana/latest/panels/inspect-panel/
  - /docs/grafana/latest/panels/queries/
  - /docs/grafana/latest/panels/query-a-data-source/
  - /docs/grafana/latest/panels/share-query-results/
  - /docs/grafana/latest/panels/query-a-data-source/about-queries/
  - /docs/grafana/latest/panels/query-a-data-source/navigate-query-tab/
  - /docs/grafana/latest/panels/query-a-data-source/add-a-query/
  - /docs/grafana/latest/panels/query-a-data-source/manage-queries/
  - /docs/grafana/latest/panels-visualizations/manage-queries/
  - /docs/grafana/latest/panels/query-options/
  - /docs/grafana/latest/panels/reference-query-options/
  - /docs/grafana/latest/panels-visualizations/query-options/
title: Query and transform data
weight: 200
---

# Query and transform data

Data source queries return data that can then be transformed via transformations and then visualized by different types of visualizations. The query language and query builder UI depends on the data source type. Grafana supports many different types of data sources.

## About queries

_Queries_ are how Grafana panels communicate with data sources to get data for the visualization. A query is a question written in the query language used by the data source. How often the query is sent to the data source and how many data points are collected can be adjusted in the panel data source options.

Use you a query editor to write a query. Each data source has its own query editor that we have customized to include the features and capabilities of the data source. Grafana supports up to 26 queries per panel.

> Important! You must be familiar with the query language of the data source. For more information about data sources, refer to [Data sources]({{< relref "../../datasources/" >}}).

### Query editors

Depending on your data source, the query editor might provide auto-completion, metric names, or variable suggestions.

Because of the difference between query languages, data sources have query editors that look different. Here are two examples of query editors.

**InfluxDB query editor**

{{< figure src="/static/img/docs/queries/influxdb-query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" >}}

**Prometheus (PromQL) query editor**

{{< figure src="/static/img/docs/queries/prometheus-query-editor-7-4.png" class="docs-image--no-shadow" max-width="1000px" >}}

### Query syntax

Data sources use different query languages to return data. Here are two query examples:

**PostgreSQL**

```
SELECT hostname FROM host  WHERE region IN($region)
```

**PromQL**

```
query_result(max_over_time(<metric>[${__range_s}s]) != <state>)
```

### Data sources used in queries

In addition to the data sources that you have configured in Grafana, there are three special data sources available:

- **Grafana -** A built-in data source that generates random walk data, which can be useful for testing visualizations and running experiments.
- **Mixed -** Select this option to query multiple data sources in the same panel. When you select this data source, Grafana enables you to select a data source for every new query that you add.
  - The first query uses the data source that was selected before you selected **Mixed**.
  - You cannot change an existing query to use the Mixed Data Source.
- **Dashboard -** Select this option to use a result set from another panel in the same dashboard.

You can combine data from multiple data sources onto a single dashboard, but each panel is tied to a specific data source that belongs to a particular Organization.

## Navigate the query tab

The Query tab consists of the following elements:

- Data source selector: Use the data source selector to select the source of the data you want to query. For more information about data sources, refer to [Data sources]({{< relref "../../datasources/" >}}).
- Query options: Enables you to set maximum data retrieved parameters and query execution time intervals.
- Query inspector button: Open the query inspector panel where you can view and optimize your query.
- Query editor list: Lists the queries you have written.
- Expressions: Use the expression builder to create alert expressions. For more information about expressions, refer to [Use expressions to manipulate data]({{< relref "expression-queries/" >}}).

{{< figure src="/static/img/docs/queries/query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" >}}

## Add a query

A query returns data that Grafana visualizes in dashboards. When you create a panel, Grafana automatically selects the default data source.

**To add a query**:

1. Edit the panel to which you are adding a query.
1. Click the **Query** tab.
1. Click the **Data source** drop-down menu and select a data source.
1. Click **Query options** to configure the maximum number of data points you need.
   For more information about query options, refer to [Query options]({{< relref "#query-options" >}}).
1. Write the query using the query editor.
1. Click **Apply**.

The system queries the data source and presents the data in the visualization.

## Manage queries

Queries are organized in collapsible query rows. Each query row contains a query editor and is identified with a letter (A, B, C, and so on).

You can:

|                                                                    Icon                                                                     | Description                                                                                                                                                                                                                                    |
| :-----------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  {{< figure src="/static/img/docs/queries/query-editor-help-7-4.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}}   | Toggle query editor help. If supported by the data source, click this icon to display information on how to use the query editor or provide quick access to common queries.                                                                    |
| {{< figure src="/static/img/docs/queries/duplicate-query-icon-7-0.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}} | Copy a query. Duplicating queries is useful when working with multiple complex queries that are similar and you want to either experiment with different variants or do minor alterations.                                                     |
|   {{< figure src="/static/img/docs/queries/hide-query-icon-7-0.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}}    | Hide a query. Grafana does not send hidden queries to the data source.                                                                                                                                                                         |
|  {{< figure src="/static/img/docs/queries/remove-query-icon-7-0.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}}   | Remove a query. Removing a query permanently deletes it, but sometimes you can recover deleted queries by reverting to previously saved versions of the panel.                                                                                 |
|   {{< figure src="/static/img/docs/queries/query-drag-icon-7-2.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}}    | Reorder queries. Change the order of queries by clicking and holding the drag icon, then drag queries where desired. The order of results reflects the order of the queries, so you can often adjust your visual results based on query order. |

## Query options

Click **Query options** next to the data source selector to see settings for your selected data source. Changes you make here affect only queries made in this panel.

{{< figure src="/static/img/docs/queries/data-source-options-7-0.png" class="docs-image--no-shadow" max-width="1000px" >}}

Grafana sets defaults that are shown in dark gray text. Changes are displayed in white text. To return a field to the default setting, delete the white text from the field.

Panel data source query options:

- **Max data points -** If the data source supports it, sets the maximum numbers of data points for each series returned. If the query returns more data points than the max data points setting, then the data source consolidates them (reduces the number of points returned by aggregating them together by average or max or other function).

  There are two main reasons for limiting the number of points, performance and smoothing the line. The default value is the width (or number of pixels) of the graph as there is no point in having more data points than the graph panel can display.

  With streaming data, the max data points value is used for the rolling buffer. (Streaming is a continuous flow of data and buffering is a way of dividing the stream into chunks). Loki streams data in the live tailing mode.

- **Min interval -** Sets a minimum limit for the automatically calculated interval, typically the minimum scrape interval. If a data point is saved every 15 seconds, then there's no point in having an interval lower than that. Another use case is to set it to a higher minimum than the scrape interval to get more coarse-grained, well-functioning queries.

- **Interval -** The interval is a time span that you can use when aggregating or grouping data points by time.

  Grafana automatically calculates an appropriate interval and it can be used as a variable in templated queries. The variable is either in seconds: `$__interval` or in milliseconds: `$__interval_ms`. It is typically used in aggregation functions like sum or average. For example, a Prometheus query using the interval variable: `rate(http_requests_total[$__interval])`.

  This automatic interval is calculated based on the width of the graph. If the user zooms out a lot then the interval becomes greater, resulting in a more coarse grained aggregation whereas if the user zooms in then the interval decreases resulting in a more fine grained aggregation.

  For more information, refer to [Global variables]({{< relref "../../dashboards/variables/add-template-variables/#global-variables" >}}).

- **Relative time -** You can override the relative time range for individual panels, causing them to be different than what is selected in the dashboard time picker in the top right corner of the dashboard. This allows you to show metrics from different time periods or days on the same dashboard.

- **Time shift -** The time shift function is another way to override the time range for individual panels. It only works with relative time ranges and allows you to adjust the time range.

  For example, you could shift the time range for the panel to be two hours earlier than the dashboard time picker. For more information, refer to [Time range controls]({{< relref "../../dashboards/manage-dashboards/#configure-dashboard-time-range-controls" >}}).

- **Cache timeout -** (This field is only visible if available in your data source.) If your time series store has a query cache, then this option can override the default cache timeout. Specified as a numeric value in seconds.

### Examples

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

### Panel time overrides and timeshift

In [Query options]({{< relref "#query-options" >}}), you can override the relative time range for individual panels, which causes them to be different than what is selected in the dashboard time picker located in the upper right. This enables you to show metrics from different time periods or days at the same time.

> **Note:** Panel time overrides have no effect when the time range for the dashboard is absolute.
