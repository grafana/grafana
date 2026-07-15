---
keywords:
  - explore
  - query editor
  - mixed data source
  - saved queries
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Query editor in Explore
weight: 5
image_maps:
  - key: query-editor
    src: /media/docs/grafana/panels-visualizations/screenshot-query-editor-imagemap-v13.1.png
    alt: An annotated image of the Grafana panel query editor
    points:
      - x_coord: 1
        y_coord: 50
        content: |
          **Sidebar**

          The sidebar displays queries, expressions, and transformations as color-coded cards with visual indicators for state, like error, hidden, and disabled, while a footer tracks your total item count.
      - x_coord: 13
        y_coord: 8
        content: |
          **Data/Alerts buttons**

          Click the buttons to move between data pipeline and related alerts. In **Alerts**, you have the option to start creating a alert rule.
      - x_coord: 24
        y_coord: 8
        content: |
          **Stacked view icon**

          The [stacked view](#navigate-the-query-editor) displays all of your queries, expressions, and transformations in a single list in the editor pane.
      - x_coord: 18
        y_coord: 94
        content: |
          **Multi-select**

          Click **Select...** in the sidebar footer to enter multi-select mode, then check the items you want to work with so you can take bulk actions. You can also press the `Shift` key while you click to select a range. If all items in your selection are queries, you can change the data source for all of them at once.
      - x_coord: 3.5
        y_coord: 27
        content: |
          **Queries & expressions**

          The list of queries and expressions you've written. Click a card in the sidebar to display that query or expression in the editor pane on the right. Click the blue plus sign to add a new query, add a saved query, or an expression. For more information about expressions, refer to [Use expressions to manipulate data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/expression-queries/).
      - x_coord: 3.5
        y_coord: 69
        content: |
          **Transformations**

          The list of all the transformations you've added. Click the blue plus sign to add a new transformation.
      - x_coord: 99
        y_coord: 50
        content: |
          **Editor pane**
      - x_coord: 46
        y_coord: 8
        content: |
          **Data source selector**

          Select the data source to query. For more information about data sources, refer to [Data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/).
      - x_coord: 51
        y_coord: 8
        content: |
          **Query name editor**

          The workspace for creating and configuring queries, expressions, and transformations. It displays the selected item from the sidebar and provides controls to edit configuration, switch between available editing modes, configuring options, and running queries to inspect results.
      - x_coord: 96
        y_coord: 27
        content: |
          **Builder/Code modes**

          Click the button to switch between builder and code editor modes when creating queries for some data sources.
      - x_coord: 33
        y_coord: 87
        content: |
          **Query options**

          Click **Query options** in the footer of the editor pane to access options set maximum data retrieval parameters and query execution time intervals.
      - x_coord: 90.5
        y_coord: 87
        content: |
          **Query inspector button**

          Click **Query inspector** in the footer of the editor pane to open the query inspector panel, where you can view and optimize your query.
---

# Query editor in Explore

Each data source's query editor provides a customized user interface that helps you write queries that take advantage of its unique capabilities.

Because of the differences between query languages, each data source query editor looks and functions differently.
Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-query-editor-v13.1.png" max-width="750px" alt="The Prometheus query editor" >}}
<!-- TODO: replace -->

For details on a specific data source's unique query editor features, refer to its documentation:

- For data sources included with Grafana, refer to [Built-in core data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#built-in-core-data-sources), which links to each core data source's documentation.
- For data sources installed as plugins, refer to the documentation for the plugin.
  - Data source plugins in the Grafana [plugin catalog](/grafana/plugins/) link to or include their documentation in their catalog listings.
    For details about the plugin catalog, refer to [Plugin management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/).
  - For links to Grafana Enterprise data source plugin documentation, refer to the [Enterprise plugins index](/docs/plugins/).

## Query syntax

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

## Special data sources

Grafana also includes three special data sources: **Grafana**, **Mixed**, and **Dashboard**.
For details, refer to [Data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/)

## Saved queries

{{< admonition type="note" >}}
Saved queries is only available on Grafana Enterprise and Grafana Cloud.
{{< /admonition >}}

You can save queries that you've created so they can be reused by you and others in your organization.
This helps users across your organization find insights in Explore without having to create their own queries or know a query language.
It also helps you avoid having several users build the same queries for the same data sources multiple times.

Saved queries are supported in:

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

{{< figure src="/media/docs/grafana/dashboards/screenshot-saved-queries-v13.0.png" max-width="750px" alt="List of saved queries" >}}

You can access saved queries three ways:

- Press `Ctrl + K` or `Cmd + K` to open the command palette and search "Saved queries".
- Click **Saved queries > Replace query** in the query editor.
- At the bottom of the query editor, click **Add from saved queries**.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-add-save-reuse-query-v13.1.png" max-width="750px" alt="Access saved queries" >}}
<!-- TODO: replace -->

Clicking **Add from saved queries** adds an additional query, while clicking **Replace query** updates your configured query.

From the **Saved queries** dialog box, you can:

- Search for queries by data source name, query content, title, or description.
- Sort queries alphabetically or by creation date.
- Filter by data source name, author name, and tags. The tag filter uses the `OR` operator, while the others use the `AND` operator. Use the **Remember filters** switch to persist your filter selections across sessions in your local storage.
- Star queries so that they appear in the **Starred queries** filter view.
- Duplicate or delete a saved query.
- Edit a query title, description, or tags.
- Click **Edit** at the bottom of the dialog box to update the body of a query.

You can apply all the same search, filter, and sort options in the **Starred queries** filter view.

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

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-save-query-v13.1.png" max-width="750px" alt="Save a query" >}}
   <!-- TODO: replace -->

1. In the **Saved queries** dialog box, enter a title for the query that makes it easier to find later.
1. (Optional) Enter a description and relevant tags.
1. Click **Save**.

### Variables in saved queries

<!-- is this section applicable to Explore? -->

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
- You can save a maximum of 1000 queries.
- If you have multiple queries open in Explore and you edit one of them by way of the **Edit in Explore** function in the **Saved queries** dialog box, the edited query replaces your open queries in Explore.

## Add a query

To add a query, follow these steps:

1. If you want use a data source that's not the default one, click the data source drop-down menu in the toolbar and make a selection.

    If you want to use multiple data sources, select the **Mixed** data source at this step. The query editor displays a secondary data source picker.

1. To create a query, do one of the following:
   - Write or construct a query in the query language of your data source.
   - Click **Replace** to reuse a saved query.

   {{< admonition type="note" >}}
   [Saved queries](#saved-queries) is only available on Grafana Enterprise and Grafana Cloud.
   {{< /admonition >}}

1. (Optional) To [save the query](#save-a-query) for reuse, click the **Save** in the editor pane.
1. (Optional) At the bottom of the query editor, click **Add query** or **Add from saved queries** to add more queries as needed.
1. Click the **Run query** icon in the toolbar.

Grafana queries the data source.
If the data source supports graph and table data, Explore displays the results in the **Graph**.

## Manage queries

The following table describes actions you can take for each query:

<!-- prettier-ignore-start -->
| Icon    | Description                                  |
| ------- | -------------------------------------------- |
| {{< figure src="/media/docs/grafana/panels-visualizations/replace-query-icon-v13.1.png" max-width="30px" max-height="30px" alt="Replace query icon" >}} | [Saved query](#saved-queries) options. Open the drop-down list and choose from **Save query** or **Replace query**.(Enterprise and Cloud only). |
| {{< figure src="/static/img/docs/queries/query-editor-help-7-4.png" max-width="30px" max-height="30px" alt="Help icon" >}} | Toggles query editor help. If supported by the data source, click this icon to display information on how to use the query editor or provide quick access to common queries. Click the **More query actions** menu to access this option. |
| {{< figure src="/media/docs/grafana/panels-visualizations/create-recorded-query-icon.png" max-width="30px" max-height="30px" alt="Create recorded query icon" >}} | Create [recorded queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/) so you can see trends over time by taking a snapshot of a data point on a set interval (Enterprise and Cloud only). |
| {{< figure src="/static/img/docs/queries/duplicate-query-icon-7-0.png" max-width="30px" max-height="30px" alt="Duplicate icon" >}} | Copies a query. Duplicating queries is useful when working with multiple complex queries that are similar and you want to either experiment with different variants or do minor alterations. Click the **More query actions** menu to access this option. |
| {{< figure src="/static/img/docs/queries/hide-query-icon-7-0.png" max-width="30px" max-height="30px" alt="Hide icon" >}} | Hides a query. Grafana does not send hidden queries to the data source. |
| {{< figure src="/static/img/docs/queries/remove-query-icon-7-0.png" max-width="30px" max-height="30px" alt="Remove icon">}} | Removes a query. Removing a query permanently deletes it, but sometimes you can recover deleted queries by reverting to previously saved versions of the panel. |
<!-- prettier-ignore-end -->
