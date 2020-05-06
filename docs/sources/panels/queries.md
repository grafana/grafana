+++
title = "Queries"
type = "docs"
[menu.docs]
identifier = "queries"
parent = "panels"
weight = 300
+++

# Queries

> **Note:** This documentation refers to a feature only available in Grafana 7.0 beta.

_Queries_ are how Grafana panels communicate with data sources to get data for the visualization. A query is basically a question written in the query language used by the data source. Grafana asks, "Hey data source, would you send me this data, organized this way?" If the query is properly formed, than the data source responds. How often the query is sent to the data source and how many data points are collected can be adjusted in the panel data source options.

Grafana supports up to 26 queries per panel.

## Query editors

Query editors are forms that help you write queries. Depending on your data source, the query editor might completion, metric names, or variable suggestion.

Because of the difference between query languages, data sources may have query editors that look different. Here are two examples of query editors:

**InfluxDB query editor**

{{< docs-imagebox img="/img/docs/queries/influxdb-query-editor-7-0.png" class="docs-image--no-shadow" max-width="1000px" >}}

**Prometheus (PromQL) query editor**

{{< docs-imagebox img="/img/docs/queries/prometheus-query-editor-7-0.png" class="docs-image--no-shadow" max-width="1000px" >}}

## Query syntax

Every data source has a different query language and syntax to ask for the data. Here are two query examples:

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

* Data source selector
* Data source options
* Query inspector button
* Query editor list

{{< docs-imagebox img="/img/docs/queries/query-editor-7-0.png" class="docs-image--no-shadow" max-width="1000px" >}}

### Data source selector

The data source selector is a drop-down list. Click it to select a data source you have added. When you create a panel, Grafana automatically selects your default data source. For more information about adding data sources, refer to [Add a data source]({{< relref "../features/datasources/add-a-data-source.md" >}}).

{{< docs-imagebox img="/img/docs/queries/data-source-selector-7-0.png" class="docs-image--no-shadow" max-width="250px" >}}

In addition to the data sources that you have configured in your Grafana, there are three special data sources available:

* **Grafana -** A built-in data source that generates random walk data. Useful for testing visualizations and running experiments.
* **Mixed -** Select this to query multiple data sources in the same panel. When this data source is selected, Grafana allows you to select a data source for every new query that you add.
  * The first query will use the data source that was selected before you selected **Mixed**.
  * You cannot change an existing query to use the Mixed Data Source.
* **Dashboard -** Select this to query a result set from another panel in the same dashboard.

### Data source options

Click **Options** next to the data source selector to see settings for your selected data source. Changes you make here affect only this panel.

{{< docs-imagebox img="/img/docs/queries/data-source-options-7-0.png" class="docs-image--no-shadow" max-width="400px" >}}

Grafana sets defaults that are shown in dark gray text. Changes are displayed in white text. To return a field to the default setting, delete the white text from the field.

Panel data source options:

* **Max data points -**
* **Min interval -** 
* **Interval -** 
* **Relative time -**
* **Time shift -**
* **That one field Torkel mentioned that is only in Graphite -**

### Query inspector button

Click **Query inspector** to open the Query tab of the panel inspector where you can see the query request sent by the panel and the response. 

Click **Refresh** to see the full text of the request sent by this panel to the server.

> **Note:** You need to add at least one query before the Query inspector can return results.

For more information about the panel inspector, refer to [Inspect a panel]({{< relref "inspect-panel.md" >}}).


### Query editor list

In the UI, queries are organized in collapsible query rows. Each query row contains a query editor and is identified with a letter (A, B, C, and so on). 

You can:

* **Change the order of queries** by moving up [INLINE ICON] or down [INLINE ICON].
  The order of results reflects the order of the queries, so you can often adjust your visual results based on query order.

* **Copy a query** [INLINE ICON]. 
  Duplicating queries is useful when working with multiple complex queries that are similar and you want to either experiment with different variants or do minor alterations.  

* **Hide a query** [INLINE ICON]. 
  Grafana does not send hidden queries to the data source.

* **Remove a query** [INLINE ICON]
  Removing a query permanently deletes it, but sometimes you can recover deleted queries by reverting to previously saved versions of the panel.

