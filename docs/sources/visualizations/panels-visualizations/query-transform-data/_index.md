---
aliases:
  - ../../panels-visualizations/manage-queries/ # /docs/grafana/next/panels-visualizations/manage-queries/
  - ../../panels-visualizations/query-options/ # /docs/grafana/next/panels-visualizations/query-options/
  - ../../panels-visualizations/query-transform-data/ # /docs/grafana/next/panels-visualizations/query-transform-data/
  - ../../panels/expressions/ # /docs/grafana/next/panels/expressions/
  - ../../panels/inspect-panel/ # /docs/grafana/next/panels/inspect-panel/
  - ../../panels/queries/ # /docs/grafana/next/panels/queries/
  - ../../panels/query-a-data-source/ # /docs/grafana/next/panels/query-a-data-source/
  - ../../panels/query-a-data-source/about-queries/ # /docs/grafana/next/panels/query-a-data-source/about-queries/
  - ../../panels/query-a-data-source/add-a-query/ # /docs/grafana/next/panels/query-a-data-source/add-a-query/
  - ../../panels/query-a-data-source/manage-queries/ # /docs/grafana/next/panels/query-a-data-source/manage-queries/
  - ../../panels/query-a-data-source/navigate-query-tab/ # /docs/grafana/next/panels/query-a-data-source/navigate-query-tab/
  - ../../panels/query-options/ # /docs/grafana/next/panels/query-options/
  - ../../panels/reference-query-options/ # /docs/grafana/next/panels/reference-query-options/
  - ../../panels/share-query-results/ # /docs/grafana/next/panels/share-query-results/
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
keywords:
  - saved queries
  - reuse queries
  - saved query
  - reuse query
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

### Special data sources

Grafana also includes three special data sources: **Grafana**, **Mixed**, and **Dashboard**.
For details, refer to [Data sources](ref:data-sources)

## Saved queries

{{< admonition type="note" >}}
Saved queries is currently in [public preview](https://grafana.com/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

This feature is only available on Grafana Enterprise and Grafana Cloud. It will gradually roll out to all Grafana Cloud users with no action required. To try out this feature on Grafana Enterprise, enable the `queryLibrary` feature toggle.
{{< /admonition >}}

You can save queries that you've created so they can be reused by you and others in your organization.
This helps users across your organization create dashboards or find insights in Explore without having to create their own queries or know a query language.
It also helps you avoid having several users build the same queries for the same data sources multiple times.

Saved queries are available in:

- [Dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#create-a-dashboard)
- [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/explore/get-started-with-explore/#explore-elements)
- [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/annotate-visualizations/#add-new-annotation-queries)

Learn more about saved queries:

- [Saved queries dialog box](#saved-queries-dialog-box)
- [Roles, permission, and RBAC](#roles-permissions-and-rbac)
- [How to save a query](#save-a-query)
- [Variables in saved queries](#variables-in-saved-queries)
- [Known limitations](#known-limitations)

### Saved queries dialog box

The **Saved queries** dialog box gives you access to all the saved queries in your organization:

{{< figure src="/media/docs/grafana/dashboards/screenshot-saved-queries-v13.0.png" max-width="750px" alt="List of saved queries" caption="The **Saved queries** dialog box accessed from Dashboards" >}}

From here, you can:

- Search for queries by data source name, query content, title, or description.
- Sort queries alphabetically or by creation date.
- Filter by data source name, author name, and tags. The tag filter uses the `OR` operator, while the others use the `AND` operator.

  {{< admonition type="tip">}}
  Use the **Remember filters** switch to persist your filter selections across sessions in your local storage.
  {{< /admonition >}}

- Star queries so that they appear in the **Starred queries** filter view.
- Duplicate, or delete a saved query.
- Edit a query title, description, or tags.
- When you access the **Saved queries** dialog box from Explore, you can use the **Edit in Explore** option to edit the body of a query.

You can apply all the same search, filter, and sort options in the **Starred queries** filter view.

To access your saved queries, click **+ Add from saved queries** or open the **Saved queries** drop-down menu and click **Replace query** in the query editor:

{{< figure src="/media/docs/grafana/dashboards/screenshot-add-save-reuse-query-v13.0.png" max-width="750px" alt="Access saved queries" >}}

Clicking **+ Add from saved queries** adds an additional query, while clicking **Replace query** in the **Saved queries** drop-down menu updates your existing query.

{{< admonition type="tip">}}
When you select a query with a Loki, Mimir, Tempo, or Pyroscope data source, the **Saved queries** dialog box displays a **Drilldown** button.
Click the button to open the associated Drilldown app, while maintaining the context of the query.
Learn more about these apps in the [Drilldown documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/simplified-exploration/).
{{< /admonition >}}

### Roles, permissions, and RBAC

Saved queries support role-based access controls.
By default, saved queries have two RBAC roles:

- **Writer**: Create, update, and delete all saved queries.
- **Reader**: Reuse saved queries.

If you used saved queries prior to the addition of RBAC support in Grafana v12.4, Grafana user roles are mapped as follows:

- Admin > Writer
- Editor > Writer
- Viewer > Reader

### Save a query

To save a query you've created:

1. From the query editor, open the **Saved queries** drop-down menu and click the **Save query** option:

   {{< figure src="/media/docs/grafana/dashboards/screenshot-save-query-v13.0.png" max-width="750px" alt="Save a query" >}}

1. In the **Saved queries** dialog box, enter a title for the query that makes it easier to find later.
1. (Optional) Enter a description and relevant tags.
1. Click **Save**.

### Variables in saved queries

If a saved query includes variables, you can substitute the variables in the query without modifying it.
This is useful in environments where variable names or available values differ between dashboards.

You can map the original variables to either:

- A variable in your dashboard
- A custom value that you enter

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-saved-query-variable-v13.0.png" max-width="450px" alt="A saved query with substituted variables" >}}

Grafana applies your selections to the query before inserting it into the dashboard.
However, the substitutions only apply to the query when it's reused, and the original saved query remains unchanged.

{{< admonition type="note">}}
In Explore, you can map variables to custom values.
{{< /admonition >}}

### Known limitations

- No validation is performed when you save a query, so it's possible to save an invalid query. You should confirm the query is working properly before you save it.
- Saved queries are currently accessible from the query editors in Dashboards and Explore.
- You can save a maximum of 1000 queries.
- If you have multiple queries open in Explore and you edit one of them by way of the **Edit in Explore** function in the **Saved queries** dialog box, the edited query replaces your open queries in Explore.

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

1. To create a query, do one of the following:
   - Write or construct a query in the query language of your data source.
   - Open the **Saved queries** drop-down menu and click **Replace query** to reuse a saved query.

   {{< admonition type="note" >}}
   [Saved queries](#saved-queries) is currently in [public preview](https://grafana.com/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

   This feature is only available on Grafana Enterprise and Grafana Cloud.
   {{< /admonition >}}

1. (Optional) To [save the query](#save-a-query) for reuse, click the **Save query** option in the **Saved queries** drop-down menu.
1. (Optional) Click **+ Add query** or **Add from saved queries** to add more queries as needed.

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

The following sections describe the panel data source query options.

### Max data points

If the data source supports it, this sets the maximum number of data points for each series returned.

If the query returns more data points than the max data points setting, then the data source reduces the number of points returned by aggregating them together by average, max, or another function.

You can limit the number of points to improve query performance or smooth the visualized line.
The default value is the width (or number of pixels) of the graph, because you can only visualize as many data points as the graph panel has room to display.

Because the default is tied to the panel’s pixel width, the same dashboard will always show identical query results regardless of how large the panel appears on screen.
When you click View in the panel menu, the panel expands to fill the window.
This keeps the dashboard’s grid layout unchanged, while giving the panel more pixels to render.
With more pixels, Grafana requests fewer data points, which lowers the resolution and increases the step size between points.
As a result, the same query can return a less detailed series in view mode than when displayed inline in the dashboard.

To get a consistent query result in both views, set **Max data points** to a fixed value.
For example, if you set **Max data points** to `100`, Grafana requests at most 100 points regardless of the panel's pixel width, so the query resolution stays the same whether the panel is in the dashboard or in view mode.

With streaming data, Grafana uses the max data points value for the rolling buffer.
Streaming is a continuous flow of data, and buffering divides the stream into chunks.
For example, Loki streams data in its live tailing mode.

### Min interval

Sets a minimum limit for the automatically calculated interval, which is typically the minimum scrape interval.

If a data point is saved every 15 seconds, you don't benefit from having an interval lower than that.
You can also set this to a higher minimum than the scrape interval to retrieve queries that are more coarse-grained and well-functioning.

{{< admonition type="note" >}}
The **Min interval** corresponds to the min step in Prometheus. Changing the Prometheus interval can change the start and end of the query range because Prometheus aligns the range to the interval. Refer to [Min step](https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#min-step) for more details.
{{< /admonition >}}

### Interval

Sets a time span that you can use when aggregating or grouping data points by time.

Grafana automatically calculates an appropriate interval that you can use as a variable in templated queries.
The variable is measured in either seconds (`$__interval`) or milliseconds (`$__interval_ms`).

Intervals are typically used in aggregation functions like sum or average.
For example, this is a Prometheus query that uses the interval variable: `rate(http_requests_total[$__interval])`.

This automatic interval is calculated based on the width of the graph.
As the user zooms out on a visualization, the interval grows, resulting in a more coarse-grained aggregation.
Likewise, if the user zooms in, the interval decreases, resulting in a more fine-grained aggregation.

For more information, refer to [Global variables](ref:global-variables).

### Relative time

Overrides the relative time range for individual panels, which causes them to be different than what is selected in the dashboard time picker in the top-right corner of the dashboard.

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

### Time shift

Overrides the time range for individual panels by shifting its start and end relative to the time picker.

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

### Cache timeout

_(Visible only if available in the data source)_ Overrides the default cache timeout if your time series store has a query cache.

Specify this value as a numeric value in seconds.
