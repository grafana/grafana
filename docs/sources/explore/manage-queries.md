+++
title = "Manage queries"
keywords = ["explore", "loki", "logs"]
aliases = ["/docs/grafana/latest/features/explore/query-management"]
weight = 10
+++

# Manage queries

Explore provides tools to store, describe, share, and organize queries.

## Query history

The query history lists queries you've previously used in Explore. The history is local to your browser and is not shared.

### View query history

To open and interact with your history, click the **Query history** button in Explore.

Query history lets you view the history of your querying. For each individual query, you can:

- Run a query.
- Create and/or edit a comment.
- Copy a query to the clipboard.
- Copy a shortened link with the query to the clipboard.
- Star a query.

### Manage favorite queries

All queries that you have starred in the Query history tab are displayed in the Starred list, to help you access and reuse your favorite queries faster.

### Sort query history

By default, query history shows you the most recent queries.

To sort your history by date or by data source name in ascending or descending order:

1. Click the **Sort queries by** field.
1. Select one of the following options:
   - Newest first
   - Oldest first
   - Data source A-Z
   - Data source Z-A

> **Note:** If you are in [split mode]({{< relref "visualize-a-query.md" >}}), Explore applies the chosen sorting mode only to the active panel.

### Filter query history

To filter the query history in the Query history and Starred tabs by data source name:

1. Click the **Filter queries for specific data source(s)** field.
1. Select the data source for which you would like to filter your history. You can select multiple data sources.

To filter queries by date range using the slider in the **Query history** tab, drag the two handles of the vertical slider.

- Dragging the top handle adjusts the start date.
- Dragging the bottom handle, adjusts the end date.

> **Note:** If you are in [split mode]({{< relref "visualize-a-query.md" >}}), Explore filters queries only to the currently active panel.

### Search in query history

You can search in your history across queries and your comments. Search is possible for queries in the Query history tab and Starred tab.

1. Click the **Search queries** field.
1. Type the term you are searching for into search field.

### Query history settings

You can customize the query history in the Settings tab. Options are described in the table below.

| Setting                                                       | Default value                           |
| ------------------------------------------------------------- | --------------------------------------- |
| Period of time for which Grafana will save your query history | 1 week                                  |
| Change the default active tab                                 | Query history tab                       |
| Only show queries for data source currently active in Explore | True                                    |
| Clear query history                                           | Permanently deletes all stored queries. |

> **Note:** Query history settings are global, and applied to both panels in split mode.
