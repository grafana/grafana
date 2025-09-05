---
keywords:
  - explore
  - loki
  - logs
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Query management in Explore
weight: 10
refs:
  saved-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#saved-queries
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#saved-queries
---

# Query management in Explore

Grafana Explore provides a variety of tools to help manage your queries.

{{< admonition type="note" >}}
For help with debugging queries, Explore allows you to investigate query requests and responses, as well as query statistics, via the Query inspector. Refer to [Query inspector in Explore](/docs/grafana/<GRAFANA_VERSION>/explore/explore-inspector/) for more information.
{{< /admonition >}}

## Query history

Query history contains the list of queries that you created in Explore. This history is stored in the Grafana database and isn't shared with other users. The retention period for a query history is **two weeks**. Queries older than two weeks are automatically deleted.

{{< admonition type="note" >}}
Starred queries aren't subject to the two-week retention period and aren't deleted.
{{< /admonition >}}

To view your query history:

1. Go to the Explore page.
1. Click **Query history**.

The Query history pane opens at the bottom of the page, and contains the following tabs:

- **Query history tab-** Contains a history of all your queries, with options for searching and managing them.
- **Starred tab -** Contains all of your starred queries.
- **Settings tab-** Provides customizable options for your query history.

### Query history tab

The Query history depicts a history of your queries for the past two weeks, unless the query is starred, which means it doesn't get deleted. For each individual query, you can:

- Run and re-run the query.
- Create and/or edit a comment.
- Copy a query to the clipboard.
- Copy a shortened link with the query to the clipboard.
- Delete a query.
- Star a query.
- Add a query from your history to your [saved queries](ref:saved-queries).

By default, query history shows you newest queries first. Click the sort box in the upper right to change to **Oldest first** to older queries first. You can search your queries using keywords.

### Query history Starred tab

All starred queries are displayed in the **Starred** tab. This gives quick access to key or favorite queries without having to rewrite them.

You also have the option to switch the data source and run a starred query.

#### Filter query history

Filter query history in both the **Query history** and **Starred** tabs by data source name:

1. Click the **Filter queries for specific data source(s)** field.
1. Select the data source in the dropdown by which you want to filter your history. You can select multiple data sources.

{{< admonition type="note" >}}
Queries with the **Mixed** data source appear only when filtering for "Mixed" and not when filtering by individual data source.
{{< /admonition >}}

You can also filter queries by date using the vertical slider:

- Drag the bottom circle to adjust the start date.
- Drag the top circle to adjust the end date.

#### Search in query history

Use **Search queries** in both the **Query history** and **Starred** tabs to search your query history and comments using keywords.

1. Click in the **Search queries** field.
1. Type the keyword(s) or term you are want to search for in search field.

### Query history Settings tab

You can customize your query history in the **Settings** tab.

Toggle **Change the default active tab from "Query history" to "Starred"** to make the **Starred tab** the default active tab.

{{< admonition type="note" >}}
Query history settings are global, and applied to both panels in split mode.
{{< /admonition >}}

<!-- All queries that have been starred in the Query history tab are displayed in the Starred tab. This allows you to access your favorite queries faster and to reuse these queries without typing them from scratch. -->
