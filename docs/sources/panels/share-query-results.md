+++
title = "Share query results"
type = "docs"
[menu.docs]
identifier = "share-query-results"
parent = "panels"
weight = 310
+++

# Share query results between panels

Grafana let you use the query result from one panel for any other panel in the dashboard. Sharing query results across panels reduces the number of queries made to your data source, which can improve the performance of your dashboard.

The Dashboard data source lets you select a panel in your dashboard that contains the queries ‌you want to share the results for. Instead of sending a separate query for each panel, Grafana sends one query and other panels use the query results to construct visualizations.

This strategy can drastically reduce the number of queries being made when you for example have several panels visualizing the same data.

To share data source queries with another panel:

1. [Create a dashboard]({{< relref "../getting-started/getting-started.md#create-a-dashboard" >}}).
1. [Add a panel]({{< relref "add-a-panel.md" >}}) to the dashboard.
1. Change the title to "Source panel". You'll use this panel as a source for the other panels.
Define the [query]({{< relref "queries.md" >}}) or queries that will be shared. If you don't have a data source available at the moment, then you can use the **Grafana** data source, which returns a random time series that you can use for testing.
1. Add a second panel and select the **Dashboard** data source in the query editor.
1. In the **Use results from panel list**, select the first panel you created.

All queries defined in the source panel are now available to the new panel. Queries made in the source panel can be shared with multiple panels.

You can click on any of the queries to go to the panel where they are defined.
