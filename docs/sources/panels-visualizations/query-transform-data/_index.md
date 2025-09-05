---
aliases:
  - ../panels/expressions/
  - ../panels/inspect-panel/
  - ../panels/queries/
  - ../panels/query-a-data-source/
  - ../panels/query-a-data-source/about-queries/
  - ../panels/query-a-data-source/add-a-query/
  - ../panels/query-a-data-source/manage-queries/
  - ../panels/query-a-data-source/navigate-query-tab/
  - ../panels/query-options/
  - ../panels/reference-query-options/
  - ../panels/share-query-results/
  - manage-queries/
  - query-options/
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Query and transform data
description: Query and transform your data
weight: 40
refs:
  data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/
  built-in-core-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#built-in-core-data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/#built-in-core-data-sources
  use-expressions-to-manipulate-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/expression-queries/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/expression-queries/
  global-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#global-variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#global-variables
  plugin-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/
  recorded-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/
  special-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#special-data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/#special-data-sources
---

# Query and transform data

Grafana supports many types of [data sources](ref:data-sources).
Data source _queries_ return data that Grafana can _transform_ and visualize.
Each data source uses its own query language, and data source plugins each implement a query-building user interface called a query editor.

## About queries

Grafana panels communicate with data sources using queries, which retrieve data for the visualization.
A query is a question written in the query language used by the data source.

You can configure query frequency and data collection limits in the panel's data source options.
Grafana supports up to 26 queries per panel.

{{< admonition type="note" >}}
You **must** be familiar with a data source's query language.
For more information, refer to [Data sources](ref:data-sources).
{{< /admonition >}}

### Query editors

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-queries-tab-v11.6.png" max-width="750px" alt="The InfluxDB query editor" >}}

Each data source's query editor provides a customized user interface that helps you write queries that take advantage of its unique capabilities.

Because of the differences between query languages, each data source query editor looks and functions differently.
Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

For example, this video demonstrates the visual Prometheus query builder:

{{< vimeo 720004179 >}}

For details on a specific data source's unique query editor features, refer to its documentation:

- For data sources included with Grafana, refer to [Built-in core data sources](ref:built-in-core-data-sources), which links to each core data source's documentation.
- For data sources installed as plugins, refer to the documentation for the plugin.
  - Data source plugins in Grafana's [plugin catalog](/grafana/plugins/) link to or include their documentation in their catalog listings.
    For details about the plugin catalog, refer to [Plugin management](ref:plugin-management).
  - For links to Grafana Enterprise data source plugin documentation, refer to the [Enterprise plugins index](/docs/plugins/).

### Query syntax

Each data source uses a different query languages to request data.
For details on a specific data source's unique query language, refer to its documentation.

**PostgreSQL example:**

```
SELECT hostname FROM host WHERE region IN($region)
```

**PromQL example:**

```
query_result(max_over_time(<metric>[${__range_s}s]) != <state>)
```

### Saved queries

{{< admonition type="note" >}}
Saved queries is currently in [public preview](https://grafana.com/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

This feature is only available on Grafana Enterprise and Grafana Cloud.
{{< /admonition >}}

You can save queries that you've created so they can be reused by you and others in your organization.
This helps users across your organization create dashboards or find insights in Explore without having to create their own queries or know a query language.
It also helps you avoid having several users build the same queries for the same data sources multiple times.

You can see a list of these queries in the **Saved queries** drawer:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-saved-queries-v12.2png.png" max-width="550px" alt="List of saved queries and the edit query form" caption="The Saved queries drawer accessed from Dashboards" >}}

When you first open the drawer, the list of queries in the **All** tab is filtered by the data source of the panel.
However, you can clear that filter to display all saved queries.

The list in the **Favorites** tab is also filtered by data source, by default.
The **Recent** tab displays the last 20 queries across all data sources from your **Query history** in Explore.
From this tab, you can save queries for reuse as well.

In the **Saved queries** drawer, you can:

- Search for queries by data source name, query content, title, or description.
- Sort queries alphabetically or by creation date.
- Filter by data source name, author name, and tags (the tag filter uses the `OR` operator, while the others use the `AND` operator).
- Set queries as favorites.
- Duplicate, lock and unlock a query for editing, or delete a saved query.
- Edit a query title, description, tags, or the availability of the query to other users in your organization. By default, saved queries are locked for editing.
- When you access the **Saved queries** drawer from Explore, you can use the **Edit in Explore** option to edit the body of a query.

Access the duplicate, lock, unlock, and delete query options through the menu in the top-right corner of the query form next to the **Edit** button.

To access your saved queries, click **+ Add from saved queries** in the query editor:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-add-from-saved-2-v12.2.png" max-width="750px" alt="Add a saved query" >}}

If you've already entered a query, you also have the option to replace it with a saved one:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-replace-w-saved-v12.2.png" max-width="750px" alt="Replace a query with a saved one" >}}

#### Save a query

To save a query you've created:

1. From the query editor, click the **Save query** icon:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-save-query-v12.2.png" max-width="750px" alt="Save a query" >}}

1. In the **Saved queries** drawer, enter a title for the query that will make it easy to find later.
1. (Optional) Enter a description and relevant tags.
1. Clear the **Share query with all users** checkbox if you only want the saved query to be available to you.
1. Click **Save**.

#### Known limitations

- No validation is performed when you save a query, so it's possible to save an invalid query. You should confirm the query is working properly before you save it.
- Saved queries are currently accessible from the query editors in Dashboards and Explore.
- You can save a maximum of 1000 queries.
- Users with the Viewer role who have access to Explore can use saved queries, but can't write them.
- If you have multiple queries open in Explore and you edit one of them by way of the **Edit in Explore** function in the **Saved queries** drawer, the edited query replaces your open queries in Explore.

### Special data sources

Grafana also includes three special data sources: **Grafana**, **Mixed**, and **Dashboard**.
For details, refer to [Data sources](ref:data-sources)

## Navigate the Queries tab {#navigate-the-query-tab}

A panel's **Queries** tab consists of the following elements:

- **Data source selector** - Selects the data source to query.
  For more information about data sources, refer to [Data sources](ref:data-sources).
- **Query options** - Sets maximum data retrieval parameters and query execution time intervals.
- **Query inspector button** - Opens the query inspector panel, where you can view and optimize your query.
- **Query editor list** - The list of queries you've written. Each query can be expanded or collapsed.
- **Expressions** - Uses the expression builder to create alert expressions.
  For more information about expressions, refer to [Use expressions to manipulate data](ref:use-expressions-to-manipulate-data).

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-queries-tab2-v11.6.png" max-width="750px" alt="The Query tab of the panel editor" >}}

## Add a query

A query returns data that Grafana visualizes in dashboard panels.
When you create a panel, Grafana automatically selects the default data source.

To add a query, follow these steps:

1. Hover the cursor over any part of the panel to which you're adding a query to display the menu icon in the top-right corner.
1. Click the menu and select **Edit**.
1. In the panel editor, click the **Queries** tab.
1. Click the **Data source** drop-down menu and select a data source.

   If you're creating a new dashboard, you'll be prompted to select a data source when you add the first panel.

1. Click **Query options** to configure the maximum number of data points you need.

   For more information about query options, refer to [Query options](#query-options).

1. To add a query, do one of the following:
   - Write or construct a query in the query language of your data source.
   - Click **+ Add from saved queries** to add a previously saved query.
   - If you've already written a query, you can click the **Replace with saved query** icon to use a previously saved query instead.

1. (Optional) To save the query for reuse, click the **Save query** icon.

   {{< admonition type="note" >}}
   [Saved queries](#saved-queries) is currently in [public preview](https://grafana.com/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

   This feature is only available on Grafana Enterprise and Grafana Cloud.
   {{< /admonition >}}

1. Click **Run queries**.

Grafana queries the data source and visualizes the data.

## Manage queries

Grafana organizes queries in collapsible query rows.
Each query row contains a query editor and is identified with a letter (A, B, C, and so on).

You can:

<!-- prettier-ignore-start -->
| Icon    | Description                                  |
| ------- | -------------------------------------------- |
| {{< figure src="/static/img/docs/queries/query-editor-help-7-4.png" max-width="30px" max-height="30px" alt="Help icon" >}} | Toggles query editor help. If supported by the data source, click this icon to display information on how to use the query editor or provide quick access to common queries. |
| {{< figure src="/media/docs/grafana/panels-visualizations/create-recorded-query-icon.png" max-width="30px" max-height="30px" alt="Create recorded query icon" >}} | Create [recorded queries](ref:recorded-queries) so you can see trends over time by taking a snapshot of a data point on a set interval (Enterprise and Cloud only). |
| {{< figure src="/media/docs/grafana/panels-visualizations/save-to-query-icon.png" max-width="30px" max-height="30px" alt="Save query icon" >}} | Save query. Saves the query so it can be reused. Access saved queries by clicking **+ Add saved query**. For more information, refer to [Saved queries](#saved-queries) (Enterprise and Cloud only). |
| {{< figure src="/static/img/docs/queries/duplicate-query-icon-7-0.png" max-width="30px" max-height="30px" alt="Duplicate icon" >}} | Copies a query. Duplicating queries is useful when working with multiple complex queries that are similar and you want to either experiment with different variants or do minor alterations. |
| {{< figure src="/static/img/docs/queries/hide-query-icon-7-0.png" max-width="30px" max-height="30px" alt="Hide icon" >}} | Hides a query. Grafana does not send hidden queries to the data source. |
| {{< figure src="/static/img/docs/queries/remove-query-icon-7-0.png" max-width="30px" max-height="30px" alt="Remove icon">}} | Removes a query. Removing a query permanently deletes it, but sometimes you can recover deleted queries by reverting to previously saved versions of the panel. |
| {{< figure src="/static/img/docs/queries/query-drag-icon-7-2.png" max-width="30px" max-height="30px" alt="Drag icon" >}} | Reorders queries. Change the order of queries by clicking and holding the drag icon, then drag queries where desired. The order of results reflects the order of the queries, so you can often adjust your visual results based on query order. |
<!-- prettier-ignore-end -->

## Query options

Click **Query options** next to the data source selector to see settings for the selected data source.
Changes you make here affect only queries made in this panel.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-query-options-v11.6.png" max-width="750px" alt="Data source query options" >}}

Grafana sets defaults that are shown in dark gray text.
Changes are displayed in white text.
To return a field to the default setting, delete the white text from the field.

Panel data source query options include:

- **Max data points** - If the data source supports it, this sets the maximum number of data points for each series returned.
  If the query returns more data points than the max data points setting, then the data source reduces the number of points returned by aggregating them together by average, max, or another function.

  You can limit the number of points to improve query performance or smooth the visualized line.
  The default value is the width (or number of pixels) of the graph, because you can only visualize as many data points as the graph panel has room to display.

  With streaming data, Grafana uses the max data points value for the rolling buffer.
  Streaming is a continuous flow of data, and buffering divides the stream into chunks.
  For example, Loki streams data in its live tailing mode.

- **Min interval** - Sets a minimum limit for the automatically calculated interval, which is typically the minimum scrape interval.
  If a data point is saved every 15 seconds, you don't benefit from having an interval lower than that.
  You can also set this to a higher minimum than the scrape interval to retrieve queries that are more coarse-grained and well-functioning.

  {{< admonition type="note" >}}
  The **Min interval** corresponds to the min step in Prometheus. Changing the Prometheus interval can change the start and end of the query range because Prometheus aligns the range to the interval. Refer to [Min step](https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#min-step) for more details.
  {{< /admonition >}}

- **Interval** - Sets a time span that you can use when aggregating or grouping data points by time.

  Grafana automatically calculates an appropriate interval that you can use as a variable in templated queries.
  The variable is measured in either seconds (`$__interval`) or milliseconds (`$__interval_ms`).

  Intervals are typically used in aggregation functions like sum or average.
  For example, this is a Prometheus query that uses the interval variable: `rate(http_requests_total[$__interval])`.

  This automatic interval is calculated based on the width of the graph.
  As the user zooms out on a visualization, the interval grows, resulting in a more coarse-grained aggregation.
  Likewise, if the user zooms in, the interval decreases, resulting in a more fine-grained aggregation.

  For more information, refer to [Global variables](ref:global-variables).

- **Relative time** - Overrides the relative time range for individual panels, which causes them to be different than what is selected in the dashboard time picker in the top-right corner of the dashboard.
  You can use this to show metrics from different time periods or days on the same dashboard.

  {{< admonition type="note">}}
  Panel time overrides have no effect when the dashboard's time range is absolute.
  {{< /admonition >}}

  | Example          | Relative time field |
  | ---------------- | ------------------- |
  | Last 5 minutes   | `now-5m`            |
  | The day so far   | `now/d`             |
  | Last 5 days      | `now-5d/d`          |
  | This week so far | `now/w`             |
  | Last 2 years     | `now-2y/y`          |

{{< docs/play title="Time range override" url="https://play.grafana.org/d/000000041/" >}}

- **Time shift** - Overrides the time range for individual panels by shifting its start and end relative to the time picker.
  For example, you can shift the time range for the panel to be two hours earlier than the dashboard time picker.

  {{< admonition type="note">}}
  Panel time overrides have no effect when the dashboard's time range is absolute.
  {{< /admonition >}}

  | Example              | Time shift field |
  | -------------------- | ---------------- |
  | Last entire week     | `1w/w`           |
  | Two entire weeks ago | `2w/w`           |
  | Last entire month    | `1M/M`           |
  | This entire year     | `1d/y`           |
  | Last entire year     | `1y/y`           |

- **Cache timeout** - _(Visible only if available in the data source)_ Overrides the default cache timeout if your time series store has a query cache.
  Specify this value as a numeric value in seconds.
