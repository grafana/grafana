---
aliases:
  - features/explore/
keywords:
  - explore
  - loki
  - logs
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Explore
weight: 90
---

# Explore

Explore is your starting point for analyzing, querying and aggregating data in Grafana. It helps you visually explore and iterate until you have a working query or set of queries with which to start building visualizations and doing data analysis. You don't need to create a dashboard if your data source supports graph and table data, as Explore shows the results as both graph or table. This allows for detailed real-time data analysis. 

Explore consists of a toolbar, a query editor, the ability to add multiple queries, a query history and a query inspector that provides detailed statistics about your query.

- **Toolbar** - Provides an Outline and quick access to frequently used tools and settings.

- **Query editor** - Interface where you construct the query for a specific data source. Query editor elements differ based on data source. In order to run queries across multiple data sources you need to select **Mixed** from the data source picker.

- **+Add query** - Add additional queries.

- **Query inspector** - Provides detailed statistics regarding your query. Inspector functions as a kind of debugging tool that "inspects" your query. It provides query statistics under **Stats**, request response time under **Query**, data frame details under **{} JSON**, and the shape of your data under **Data**.




See also:

- [Query management in Explore]({{< relref "query-management/" >}})
- [Logs integration in Explore]({{< relref "logs-integration/" >}})
- [Trace integration in Explore]({{< relref "trace-integration/" >}})
- [Explore metrics]({{< relref "explore-metrics/" >}})
- [Correlations Editor in Explore]({{< relref "correlations-editor-in-explore/" >}})
- [Inspector in Explore]({{< relref "explore-inspector/" >}})





Insert screenshot 



## Get started with Explore

{{< youtube id="1q3YzX2DDM4" >}}

In order to access Explore, you must have either the `editor` or `administrator` role, unless the [`viewers_can_edit` option]({{< relref "../setup-grafana/configure-grafana/#viewers_can_edit" >}}) is enabled. Refer to [About users and permissions]({{< relref "../administration/roles-and-permissions/" >}}) for more information on what each role has access to.

{{% admonition type="note" %}}
If you are using Grafana Cloud, open a [support ticket in the Cloud Portal](/profile/org#support) to enable the `viewers_can_edit` option.
{{% /admonition %}}

{{% admonition type="note" %}}
Refer to [Role-based access Control]({{< relref "../administration/roles-and-permissions/access-control/" >}}) in Grafana Enterprise to understand how you can manage Explore with role-based permissions.
{{% /admonition %}}

To access Explore:

1. Click on **Explore** in the left side menu.

   An empty Explore page opens.

   Alternately to start with an existing query in a dashboard panel, choose the Explore option from the Panel menu in the upper right. This opens an Explore page with the query from the panel and allows you to tweak or iterate the query outside of your dashboard.

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-panel-menu-10.1.png" class="docs-image--no-shadow" max-width= "650px" caption="Screenshot of the panel menu including the Explore option" >}}

1. Select a data source from the drop-down in the upper left.
1. Using the query editor provided for the specific data source, begin writing your query. Each query editor differs based on each data source's unique elements. Some query editors provide a **Kick start your query** option, which gives you a list of basic pre-written queries. Refer to [Use query editors](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#use-query-editors) to see how to use various query editors. For general information on querying data sources in Grafana, refer to [Query and transform data](/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/).
1. Click **Run query** in the upper right to run your query.

## Split and compare

The split view provides an easy way to compare visualizations side-by-side or to look at related data together on one page.

To open the split view:

1. Click the split button to duplicate the current query and split the page into two side-by-side queries.

It is possible to select another data source for the new query which for example, allows you to compare the same query for two different servers or to compare the staging environment to the production environment.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-explore-split-10.1.png" max-width= "950px" caption="Screenshot of Explore screen split" >}}

In split view, timepickers for both panels can be linked (if you change one, the other gets changed as well) by clicking on one of the time-sync buttons attached to the timepickers. Linking of timepickers helps with keeping the start and the end times of the split view queries in sync. It ensures that you’re looking at the same time interval in both split panels.

To close the newly created query, click on the Close Split button.

## Content outline

The content outline is a side navigation bar that keeps track of the queries and visualization panels you created in Explore. It allows you to navigate between them quickly.

The content outline also works in a split view. When you are in split view, the content outline is generated for each pane.

To open the content outline:

1. Click the Outline button in the top left corner of the Explore screen.

You can then click on any panel icon in the content outline to navigate to that panel.

## Share Explore URLs

When using Explore, the URL in the browser address bar updates as you make changes to the queries. You can share or bookmark this URL.

{{% admonition type="note" %}}
Explore may generate relatively long URLs, some tools, like messaging or videoconferencing apps, may truncate messages to a fixed length. In such cases Explore will display a warning message and load a default state. If you encounter issues when sharing Explore links in such apps, you can generate shortened links. See [Share shortened link](#share-shortened-link) for more information.
{{% /admonition %}}

### Generating Explore URLs from external tools

Because Explore URLs have a defined structure, you can build a URL from external tools and open it in Grafana. The URL structure is:

```
http://<grafana_url>/explore?panes=<panes>&schemaVersion=<schema_version>&orgId=<org_id>
```

where:

- `org_id` is the organization ID
- `schema_version` is the schema version (should be set to the latest version which is `1`)
- `panes` is a url-encoded JSON object of panes, where each key is the pane ID and each value is an object matching the following schema:

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

{{% admonition type="note" %}}
The `from` and `to` also accept relative ranges defined in [Time units and relative ranges]({{< relref "../dashboards/use-dashboards/#time-units-and-relative-ranges" >}}).
{{% /admonition %}}

## Share shortened link

{{% admonition type="note" %}}
Available in Grafana 7.3 and later versions.
{{% /admonition %}}

The Share shortened link capability allows you to create smaller and simpler URLs of the format /goto/:uid instead of using longer URLs with query parameters. To create a shortened link to the executed query, click the **Share** option in the Explore toolbar.

A shortened link that is not accessed will automatically get deleted after a [configurable period](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#short_links) (defaulting to seven days). If a link is used at least once, it won't be deleted.

### Sharing shortened links with absolute time

{{% admonition type="note" %}}
Available in Grafana 10.3 and later versions.
{{% /admonition %}}

Short links have two options: keeping relative time (for example, from two hours ago to now) or absolute time (for example, from 8am to 10am). Sharing a shortened link by default will copy the time range selected, relative or absolute. Clicking the dropdown button next to the share shortened link button and selecting one of the options under "Time-Sync URL Links" will allow you to create a short link with the absolute time - meaning anyone receiving the link will see the same data you are seeing, even if they open the link at another time. This will not affect your selected time range.
