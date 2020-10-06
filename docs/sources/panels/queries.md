+++
title = "Queries"
type = "docs"
[menu.docs]
identifier = "queries"
parent = "panels"
weight = 300
+++

# Queries

_Queries_ are how Grafana panels communicate with data sources to get data for the visualization. A query is a question written in the query language used by the data source. Grafana asks, "Hey data source, would you send me this data, organized this way?" If the query is properly formed, then the data source responds. How often the query is sent to the data source and how many data points are collected can be adjusted in the panel data source options.

Grafana supports up to 26 queries per panel.

## Query editors

Query editors are forms that help you write queries. Depending on your data source, the query editor might provide auto-completion, metric names, or variable suggestion.

Because of the difference between query languages, data sources may have query editors that look different. Here are two examples of query editors:

**InfluxDB query editor**

{{< docs-imagebox img="/img/docs/queries/influxdb-query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" >}}

**Prometheus (PromQL) query editor**

{{< docs-imagebox img="/img/docs/queries/prometheus-query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" >}}

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

For more information about writing a query for your data source, refer to the specific [Grafana data source]({{< relref "../features/datasources/_index.md" >}}) documentation.

## Query tab UI

The Query tab consists of the following elements:

- Data source selector
- Query options
- Query inspector button
- Query editor list

{{< docs-imagebox img="/img/docs/queries/query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" >}}

### Data source selector

The data source selector is a drop-down list. Click it to select a data source you have added. When you create a panel, Grafana automatically selects your default data source. For more information about adding data sources, refer to [Add a data source]({{< relref "../features/datasources/add-a-data-source.md" >}}).

{{< docs-imagebox img="/img/docs/queries/data-source-selector-7-0.png" class="docs-image--no-shadow" max-width="250px" >}}

In addition to the data sources that you have configured in your Grafana, there are three special data sources available:

- **Grafana -** A built-in data source that generates random walk data. Useful for testing visualizations and running experiments.
- **Mixed -** Select this to query multiple data sources in the same panel. When this data source is selected, Grafana allows you to select a data source for every new query that you add.
  * The first query will use the data source that was selected before you selected **Mixed**.
  * You cannot change an existing query to use the Mixed Data Source.
- **Dashboard -** Select this to use a result set from another panel in the same dashboard.

### Query options

Click **Query options** next to the data source selector to see settings for your selected data source. Changes you make here affect only queries made in this panel.

{{< docs-imagebox img="/img/docs/queries/data-source-options-7-0.png" class="docs-image--no-shadow" max-width="1000px" >}}

Grafana sets defaults that are shown in dark gray text. Changes are displayed in white text. To return a field to the default setting, delete the white text from the field.

Panel data source query options:

- **Max data points -** If the data source supports it, sets the maximum numbers of data points for each series returned. If the query returns more data points than the max data points setting, then the data source consolidates them (reduces the number of points returned by aggregating them together by average or max or other function).
  
  There are two main reasons for limiting the number of points, performance and smoothing the line. The default value is the width (or number of pixels) of the graph as there is no point in having more data points than the graph panel can display.

  With streaming data, the max data points value is used for the rolling buffer. (Streaming is a continuous flow of data and buffering is a way of dividing the stream into chunks). Loki streams data in the live tailing mode.

- **Min interval -** Sets a minimum limit for the automatically calculated interval, typically the minimum scrape interval. If a data point is saved every 15 seconds, then there's no point in having an interval lower than that. Another use case is to set it to a higher minimum than the scrape interval to get more coarse-grained, well-functioning queries.
  
- **Interval -** The interval is a time span that you can use when aggregating or grouping data points by time. 
  
  Grafana automatically calculates an appropriate interval and it can be used as a variable in templated queries. The variable is either in seconds: `$__interval` or in milliseconds: `$__interval_ms`. It is typically used in aggregation functions like sum or average. For example, a Prometheus query using the interval variable: `rate(http_requests_total[$__interval])`.

  This automatic interval is calculated based on the width of the graph. If the user zooms out a lot then the interval becomes greater, resulting in a more coarse grained aggregation whereas if the user zooms in then the interval decreases resulting in a more fine grained aggregation.

  For more information, refer to [Global variables]({{< relref "../variables/variable-types/global-variables.md" >}}).

- **Relative time -** You can override the relative time range for individual panels, causing them to be different than what is selected in the dashboard time picker in the top right corner of the dashboard. This allows you to show metrics from different time periods or days on the same dashboard.
  
- **Time shift -** The time shift function is another way to override the time range for individual panels. It only works with relative time ranges and allows you to adjust the time range.
  
  For example, you could shift the time range for the panel to be two hours earlier than the dashboard time picker. For more information, refer to [Time range controls]({{< relref "../dashboards/time-range-controls.md" >}}).

- **Cache timeout -** (This field is only visible if available in your data source.) If your time series store has a query cache, then this option can override the default cache timeout. Specified as a numeric value in seconds.

### Query inspector button

You can click **Query inspector** to open the Query tab of the panel inspector where you can see the query request sent by the panel and the response. 

Click **Refresh** to see the full text of the request sent by this panel to the server.

> **Note:** You need to add at least one query before the Query inspector can return results.

For more information about the panel inspector, refer to [Inspect a panel]({{< relref "inspect-panel.md" >}}).

### Query editor list

In the UI, queries are organized in collapsible query rows. Each query row contains a query editor and is identified with a letter (A, B, C, and so on). 

You can:

| Icon | Description |
|:--:|:---|
| {{< docs-imagebox img="/img/docs/queries/duplicate-query-icon-7-0.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}} | Copy a query. Duplicating queries is useful when working with multiple complex queries that are similar and you want to either experiment with different variants or do minor alterations. |
| {{< docs-imagebox img="/img/docs/queries/hide-query-icon-7-0.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}} | Hide a query. Grafana does not send hidden queries to the data source. |
| {{< docs-imagebox img="/img/docs/queries/remove-query-icon-7-0.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}} | Remove a query. Removing a query permanently deletes it, but sometimes you can recover deleted queries by reverting to previously saved versions of the panel. |
| {{< docs-imagebox img="/img/docs/queries/query-drag-icon-7-2.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}} | Reorder queries. Change the order of queries by clicking and holding the drag icon, then drag queries where desired. The order of results reflects the order of the queries, so you can often adjust your visual results based on query order. |
