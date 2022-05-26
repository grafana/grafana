---
aliases:
  - /docs/sources/panels/query-a-data-source/download-raw-query-results/
title: Download raw query results
weight: 70
---

# Download raw query results

Grafana generates a CSV file that contains your data, including any transformations to that data. You can choose to view the data before or after the panel applies field options or field option overrides.

## Before you begin

- [Add a panel to a dashboard]({{< relref "../working-with-panels/add-panel.md" >}}).
- [Add a query]({{< relref "../query-a-data-source/add-a-query.md" >}}).

**To download raw query results**:

1. Edit the panel that contains the query data you want to download.
1. In the query editor, click **Query Inspector**.
1. Click **Data**.

   If your panel contains multiple queries or queries multiple nodes, then you have additional options.

   - **Select result**: Choose which result set data you want to view.
   - **Transform data**
   - **Join by time**: View raw data from all your queries at once, one result set per column. Click a column heading to reorder the data.

1. To see data before the system applies field overrides, click the **Formatted data** toggle.
1. To download a CSV file specifically formatted for Excel, click the **Download for Excel** toggle .
1. Click **Download CSV**.
