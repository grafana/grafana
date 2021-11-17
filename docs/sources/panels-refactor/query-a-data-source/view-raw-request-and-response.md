+++
title = "View raw request and response source data"
weight = 1
+++

# View raw request and response source data

### Inspect raw query results

View raw query results in a table. This is the data returned by the query with transformations applied and before the panel applies field options or field option overrides.

In the inspector click the **Data** tab or in the panel menu click **Inspect > Data**.

If your panel contains multiple queries or queries multiple nodes, then you have additional options.

- **Select result -** Choose which result set data you want to view.
- **Transform data**

  - **Join by time -** View raw data from all your queries at once, one result set per column. Click a column heading to reorder the data.

  View raw query results in a table with field options and options overrides applied:

  1. Open the **Data** tab in panel inspector.
  1. Click on **Data display options** above the table.
  1. Click on **Apply field configuration** toggle button.

From another source...

You can click **Query inspector** to open the Query tab of the panel inspector where you can see the query request sent by the panel and the response.

Click **Refresh** to see the full text of the request sent by this panel to the server.

> **Note:** You need to add at least one query before the Query inspector can return results.

For more information about the panel inspector, refer to [Inspect a panel]({{< relref "inspect-panel.md" >}}).
