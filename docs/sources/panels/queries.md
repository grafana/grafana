+++
title = "Queries"
type = "docs"
[menu.docs]
identifier = "queries"
parent = "panels"
weight = 300
+++

# Queries

_Queries_ are how Grafana panels communicate with data sources to get data for the visualization. A query is basically a question written in the query language used by the data source. Grafana asks, "Hey data source, would you send me this data, organized this way?" If the query is properly formed, than the data source responds. How often the query is sent to the data source and how many data points are collected can be adjusted in the panel data source options.

## Query syntax

Every data source has a different query syntax to ask for the data. Here are two query examples:

PostgreSQL:
SELECT hostname FROM host  WHERE region IN($region)

PromQL (Prometheus query language):
query_result(max_over_time(<metric>[${__range_s}s]) != <state>)


## Query editors

To simplify query creation, Grafana comes with query editors. Query editors are forms that provide support for creating queries, for example completion, metric names or [template variables](link) suggestion.

Because of the difference between query languages, data sources may have query editors that look different. Below are two examples of query editors:

PostgreSQL query editor:


PromQL query editor:


Grafana supports up to 26 queries per panel.
## Query tab UI
The Query tab is divided into two sections.
Data source selection 
Data source options
Query inspector
Queries list

There is also a **Query inspector** button.

[IMAGE]
### Data source selection

To create a query you must [add a data source](LINK). Grafana automatically selects your default data source for a query in a new panel.

Apart from the data sources that you have configured in your Grafana there are three special data sources available:
--Grafana-- - Built-in data source for that generates random walk data. Useful for testing visualizations and running experiments.
--Mixed-- - Allows data source selection per query. When this data source is selected, Grafana allows you to select a data source for every new query that you add.
The first query will use the data source that was selected before you selected **Mixed**.
You cannot change an existing query to use the Mixed Data Source.
--Dashboard-- Queries result set from another panel in the same dashboard.

After you select a data source, a data source- specific query editor appears. 

For more information about data sources, see [Add a data source](LINK) or refer to individual topics in the [Data sources](LINK) documentation.

### Data source options

Click **Options** next to the data source selector to see settings for your selected data source. Changes you make here affect only this panel. 

Grafana sets defaults that are shown in dark gray text. Changes are displayed in white text. To return a field to the default setting, delete the white text from the field.

Panel data source options:

* **Max data points -**
* **Min interval -** 
* **Interval -** 
* **Relative time -**
* **Time shift -**
* **That one field Torkel mentioned that is only in Graphite -**

### Query inspector
Click **Query inspector** to open the Query tab of the panel inspector where you can see the query request sent by the panel and the response. 

Click **Refresh** to see the full text of the request sent by this panel to the server.

> **Note:** You need to add at least one query before the Query inspector can return results.

For more information about the panel inspector, refer to [Inspect a panel](LINK).


### Queries list
In the UI queries are organized in collapsible query rows. Each query row contains a query editor and is identified with a letter (A, B, C, and so on). 

You can:
Organize rows by moving up [INLINE ICON] or down [INLINE ICON]. 
The order of results reflects the order of the queries, so you can often adjust your visual results based on query order.
Duplicate query [INLINE ICON]. 
Duplicating queries is useful when working with multiple complex queries that are similar and you want to either experiment with different variants or do minor alterations.  
Hide a query [INLINE ICON]. 
Grafana does not send hidden queries to the data source.
Remove query [INLINE ICON]

