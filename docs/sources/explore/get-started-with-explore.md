---
aliases:
  -
keywords:
  - explore
  - loki
  - logs
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Get started with Explore
refs:
    saved-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#saved-queries
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#saved-queries
weight: 5
---

# Get started with Explore

{{< shared id="explore-overview" >}}

Explore is your gateway for querying, analyzing, and aggregating data in Grafana. It allows you to visually explore and iterate until you develop a working query or set of queries for building visualizations and conducting data analysis. If your data source supports graph and table data, there's no need to create a dashboard, as Explore can display the results in both formats. This facilitates quick, detailed, real-time data analysis.

With Explore you can:

- Create visualizations to integrate into your dashboards.
- Create queries using mixed data sources.
- Create multiple queries within a single interface.
- Understand the shape of your data across various data sources.
- Perform real time data exploration and analysis.

Key features include:

- Query editor, based on specific data source, to create and iterate queries.
- [Query history](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/query-management/) to track and maintain your queries.
- [Query inspector](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/explore-inspector/) to help troubleshoot query performance.

{{< /shared >}}

Watch the following video to get started using Explore:

{{< youtube id="1q3YzX2DDM4" >}}

## Before you begin

In order to access Explore, you must have either the `editor` or `administrator` basic role or the `data sources explore` role. Refer to [Role and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/) for more information on what each role can access.

Refer to [Role-based access control (RBAC)](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/) in Grafana Enterprise to understand how you can manage Explore with role-based permissions.

## Explore elements

Explore consists of a toolbar, outline, query editor, the ability to add multiple queries, a query history and a query inspector.

- **Outline** - Keeps track of the queries and visualization panels created in Explore. Refer to [Content outline](#content-outline) for more detail.

- **Toolbar** - Provides quick access to frequently used tools and settings.
  - **Data source picker** - Select a data source from the dropdown menu, or use absolute time.
  - **Split** - Click to compare visualizations side by side. Refer to [Split and compare](#split-and-compare) for additional detail.
  - **Add** - Click to add your exploration to a dashboard. You can also use this to declare an incident,create a forecast, detect outliers and to run an investigation.
  - **Time picker** - Select a time range form the time picker. You can also enter an absolute time range. Refer to [Time picker](#time-picker) for more information.
  - **Run query** - Click to run your query.

- **Query editor** - Interface where you construct the query for a specific data source. Query editor elements differ based on data source. In order to run queries across multiple data sources you need to select **Mixed** from the data source picker.

- **+ Add query** - Add additional queries.
- **+ Add saved query** - Add a [saved query](ref:saved-queries) (Grafana Enterprise and Cloud only). Even if you've already written a query, you can click the **Replace with saved query** icon to use a previously saved query instead. If you've created a query that you want to use again, save it by clicking the save icon on the query editor. Saved queries is in [public preview](https://grafana.com/docs/release-life-cycle/).
- **Query history** - Query history contains the list of queries that you created in Explore. Refer to [Query history](/docs/grafana/<GRAFANA_VERSION>/explore/query-management/#query-history) for detailed information on working with your query history.
- **Query inspector** - Provides detailed statistics regarding your query. Inspector functions as a kind of debugging tool that "inspects" your query. It provides query statistics under **Stats**, request response time under **Query**, data frame details under **{} JSON**, and the shape of your data under **Data**. Refer to [Query inspector in Explore](/docs/grafana/latest/explore/explore-inspector/) for additional information.

## Access Explore

To access Explore:

1. Click on **Explore** in the left side menu.

   To start with an existing query from a dashboard panel, select the Explore option from the Panel menu in the upper right. This opens an Explore page with the panel's query, enabling you to tweak or iterate the query outside your dashboard.

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-panel-menu-10.1.png" class="docs-image--no-shadow" caption="Panel menu with Explore option" >}}

1. Select a data source from the drop-down in the upper left.

1. Using the query editor provided for the specific data source, begin writing your query. Each query editor differs based on each data source's unique elements.

Some query editors provide a **Kick start your query** option, which gives you a list of basic pre-written queries. Refer to [Use query editors](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#use-query-editors) to see how to use various query editors. For general information on querying data sources in Grafana, refer to [Query and transform data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/).

Based on specific data source, certain query editors allow you to select the label or labels to add to your query. Labels are fields that consist of key/value pairs representing information in the data. Some data sources allow for selecting fields.

1. Click **Run query** in the upper right to run your query.

## Content outline

The content outline is a side navigation bar that keeps track of the queries and visualizations you created in Explore. It allows you to navigate between them quickly.

The content outline works in a split view, with a separate outline generated for each pane.

To open the content outline:

1. Click the Outline button in the top left corner of the Explore screen.

You can then click on any panel icon in the content outline to navigate to that panel.

## Split and compare

The split view enables easy side-by-side comparison of visualizations or simultaneous viewing of related data on a single page.

To open the split view:

1. Click the split button to duplicate the current query and split the page into two side-by-side queries.
1. Run and re-run queries as often as needed.

You can select a different data source, or different metrics and label filters for the new query, allowing you to compare the same query across two different servers or compare the staging environment with the production environment.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-explore-split-10.1.png" max-width= "950px" caption="Screenshot of Explore screen split" >}}

You can also link the time pickers for both panels by clicking on one of the time-sync buttons attached to the time pickers. When linked, changing the time in one panel automatically updates the other, keeping the start and end times synchronized. This ensures that both split panels display data for the same time interval.

Click **Close** to quit split view.

## Time picker

Use the time picker to select a time range for your query. The default is **last hour**. You can select a different option from the dropdown or use an absolute time range. You can also change the timezone associated with the query, or use a fiscal year.

1. Click **Change time settings** to change the timezone or apply a fiscal year.

Refer to [Set dashboard time range](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#set-dashboard-time-range) for more information on absolute and relative time ranges. You can also [control the time range using a URL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#control-the-time-range-using-a-url).

## Mixed data source

Select **Mixed** from the data source dropdown to run queries across multiple data sources in the same panel. When you select Mixed, you can select a different data source for each new query that you add.

## Share Explore URLs

When using Explore, the URL in the browser address bar updates as you make changes to the queries. You can share or bookmark this URL.

{{< admonition type="note" >}}
Explore may generate long URLs, which some tools, like messaging or videoconferencing applications, might truncate due to fixed message lengths. In such cases, Explore displays a warning and loads a default state.
If you encounter issues when sharing Explore links in these applications, you can generate shortened links. See [Share shortened link](#share-shortened-link) for more information.
{{< /admonition >}}

### Generate Explore URLs from external tools

Because Explore URLs have a defined structure, you can build a URL from external tools and open it in Grafana. The URL structure is:

```
http://<grafana_url>/explore?panes=<panes>&schemaVersion=<schema_version>&orgId=<org_id>
```

where:

- `org_id` is the organization ID
- `schema_version` is the schema version (should be set to the latest version which is `1`)
- `panes` is a URL-encoded JSON object of panes, where each key is the pane ID and each value is an object matching the following schema:

```
{
  datasource: string; // the pane's root datasource UID, or `-- Mixed --` for mixed datasources
  queries: {
    refId: string; // an alphanumeric identifier for this query, must be unique within the pane, i.e. "A", "B", "C", etc.
    datasource: {
      uid: string; // the query's datasource UID ie: "AD7864H6422"
      type: string; // the query's datasource type-id, i.e: "loki"
    }
    // ... any other datasource-specific query parameters
  }[]; // array of queries for this pane
  range: {
    from: string; // the start time, in milliseconds since epoch
    to: string; // the end time, in milliseconds since epoch
  }
}
```

{{< admonition type="note" >}}
The `from` and `to` also accept relative ranges defined in [Time units and relative ranges](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#time-units-and-relative-ranges).
{{< /admonition >}}

## Share shortened link

{{< admonition type="note" >}}
Available in Grafana 7.3 and later versions.
{{< /admonition >}}

The Share shortened link capability allows you to create smaller and simpler URLs of the format `/goto/:uid` instead of using longer URLs with query parameters. To create a shortened link to the executed query, click the **Share** option in the Explore toolbar.

A shortened link that's not accessed automatically gets deleted after a [configurable period](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#short_links), which defaults to seven days. However, if the link is accessed at least once, it will not be deleted.

### Share shortened links with absolute time

{{< admonition type="note" >}}
Available in Grafana 10.3 and later versions.
{{< /admonition >}}

Shortened links have two options: relative time (e.g., from two hours ago to now) or absolute time (e.g., from 8am to 10am). By default, sharing a shortened link copies the selected time range, whether it's relative or absolute.

To create a short link with an absolute time:

1. Click the dropdown button next to the share shortened link button.
1. Select one of the options under **Time-Sync URL Links**.

This ensures that anyone receiving the link will see the same data you see, regardless of when they open it. Your selected time range will remain unaffected.

## Next steps

Now that you are familiar with Explore you can:

- [Build dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/)
- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)
- [Work with logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/)
- [Work with traces](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/)
- [Create and use correlations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/correlations-editor-in-explore/)
