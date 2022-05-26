---
aliases:
  - /docs/sources/panels/query-a-data-source/add-a-query/
title: Add a query
weight: 30
---

# Add a query

A query returns data that Grafana visualizes in dashboards. When you create a panel, Grafana automatically selects the default data source.

## Before you begin

- [Add a data source](../../../datasources/add-a-data-source).
- Ensure that you know the query language of the data source.
- [Add a panel]({{< relref "../working-with-panels/add-panel.md" >}}).

**To add a query**:

1. Edit the panel to which you are adding a query.
1. Click the **Query** tab.
1. Click the **Data source** drop-down menu and select a data source.
1. Click **Query options** to configure the maximum number of data points returned by the query and how frequently you want the query to request data from the data source.

   For more information about query options, refer to [Reference: Query options]({{< relref "../reference-query-options.md" >}}).

1. Write the query.

1. Click **Apply**.

The system queries the data source and presents the data in the visualization.
