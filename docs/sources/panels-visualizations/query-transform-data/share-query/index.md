---
aliases:
  - ../../panels/query-a-data-source/share-query/
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Share query results
title: Share query results with another panel
description: Reduce the number of queries to your data source by sharing query results
weight: 60
refs:
  query:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#add-a-query
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#add-a-query
  create-a-dashboard:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/
---

# Share query results with another panel

Grafana lets you use the query result from one panel for any other panel in the dashboard. Sharing query results across panels reduces the number of queries made to your data source, which can improve the performance of your dashboard.

The Dashboard data source lets you select a panel in your dashboard that contains the queries ‌you want to share the results for. Instead of sending a separate query for each panel, Grafana sends one query and other panels use the query results to construct visualizations.

This strategy can drastically reduce the number of queries being made when you for example have several panels visualizing the same data.

1. [Create a dashboard](ref:create-a-dashboard).
1. Create a panel.
1. Change the panel title to "Source panel". You'll use this panel as a source for the other panels.
1. Define the [query](ref:query) or queries that you want share.

   If you don't have a data source available, use the **Grafana** data source, which returns a random time series that you can use for testing.

1. Add a new panel and select the **Dashboard** data source in the query editor.
1. In the **Use results from panel list**, select the first panel you created.

All queries defined in the source panel are now available to the new panel. Queries defined in the source panel can be shared with multiple panels.

You can click on any of the queries to go to the panel where they are defined.
