---
description: Learn more about the Query inspector in Grafana Explore.
labels:
  products:
    - cloud
    - enterprise
    - oss
keywords:
  - Explore
title: Query inspector in Explore
weight: 40
---

# Query inspector in Explore

The Query inspector in Grafana Explore gives you detailed statistics regarding your query, which helps you understand and troubleshoot issues with your queries. Query inspector also lets you inspect raw data, export data to a comma-separated values (CSV) file, export log results in TXT format, and view query requests.

## Query inspector UI

To open Query inspector:

1. Go to the Explore page.
1. Run the query you would like to inspect.
1. Click **Query inspector**.

The Query inspector pane opens on the bottom of the Explore page, where you see the following tabs:

- **Stats tab -** Shows statistics regarding the query, including the amount of time it takes to run the query, data processing time and the amount of data returned.
- **Query tab -** Provides raw request and response data and time when Grafana queries the data source.
- **JSON tab -** Allows you to view and copy the JSON data and the JSON data frame structure.
- **Data tab -** Shows the raw data returned by the query. You can download the information to a CSV file.
- **Error tab -** Shows any errors. _Only visible if the query returns an error._

## Query inspector Stats tab

You can inspect query performance in the **Stats tab**, which displays statistics that tell you how long your query takes, how many queries you send, the number of rows returned and trace IDs. This information can help you troubleshoot your queries, especially if any of the numbers are unexpectedly high or low.

1. Open the inspector.
1. Click the **Stats tab**.

Statistics display in read-only format.

## Query inspector Query tab

View raw request and response in the Query tab.

1. Open the Query inspector and click the **Query tab**.
1. Click **Refresh**.

Grafana sends the query to the server and displays the result. You can drill down on specific portions of the query, expand or collapse all of it. Click **Copy to clipboard** to copy the data to use in other applications.

## Query inspector JSON tab

View data results as JSON and as data frame JSON models in the **JSON tab**.

1. Open the Query inspector and click the **JSON tab**.
1. Choose one of the following options from the **Select source** dropdown menu:
   - **Panel data -** Displays a JSON object representing the data retrieved by the visualization from Explore.
   - **DataFrame JSON (from query) -** Displays the raw data result set without transformations and field configuration applied.

## Query inspector Data tab

View, inspect and download raw query results in the **Data tab**.

1. Open the Query inspector and click the **Data** tab.
1. Click **Data options** to to view options under **Show data frame**.
1. Select a data results set from the dropdown menu.
1. For multiple queries or for queries multiple nodes, you can select **Series joined by time** from the dropdown to view the raw data from all of your queries at once, one result set per column. You can click any column heading to sort the data.
1. Toggle **Formatted data** to match the format in the panel.
1. Toggle **Download for Excel** to download a CSV file specifically formatted for Excel.
1. To download the results to a CSV file click **Download CSV** in the upper right of the Query inspector pane.

### Download log results as TXT

Based on the type of data source (Loki, for example), or when logs are present in the results set, Grafana generates a TXT file of log raw data results in your default browser download location. You can open it in the viewer of your choice.

1. Click **Query inspector**.
1. Click the **Data tab** to view log query results.
1. Click **Download logs**.

### Download trace results

Based on the data source type (Tempo, for example), Grafana generates a JSON file for trace results in one of these supported formats: Jaeger, Zipkin, or OTLP.

1. Click **Query inspector**.
1. Click the **Data tab** to view traces results.
1. Click **Download traces**.
