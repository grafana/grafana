---
title: Inspector in Explore
weight: 400
---

# Inspector in Explore

The inspector helps you understand and troubleshoot your queries. You can inspect the raw data, export that data to a comma-separated values (CSV) file, export log results in TXT format, and view query requests.

## Inspector UI

The inspector has following tabs:

- **Stats tab -** Shows how long your query takes and how much it returns.
- **Query tab -** Shows you the requests to the server sent when Grafana queries the data source.
- **JSON tab -** Allows you to view and copy the data JSON and data frame structure JSON.
- **Data tab -** Shows the raw data returned by the query.
- **Error tab -** Shows the error. Only visible when query returns error.

## Inspector tasks

You can perform a variety of tasks in the Explore inspector.

### Open the Inspector

1. Run the query you would like to inspect.
1. Click the **Inspector** button.

The inspector pane opens on the bottom of the screen.

### Inspect raw query results

You can view raw query results, that is the data returned by the query in a table.

In the **Inspector** tab, click the **Data** tab.

For multiple queries or for queries multiple nodes, there are additional options.

- **Show data frame:** Select the result set data you want to view.
- **Series joined by time:** View the raw data from all of your queries at once, one result set per column. You can click a column heading to sort the data.

### Download raw query results as CSV

Grafana generates a CSV file in your default browser download location. You can open it in the viewer of your choice.

1. In the **Inspector** tab, raw query results following instructions in (### Inspect raw query results).
1. Refine query settings until you can see the raw data that you want to export.
1. Click **Download CSV**.

In order to download a CSV file specifically formatted for Excel, expand **Data options** and then enable the **Download for Excel** toggle before you click the **Download CSV** option.

### Download log results as TXT

Grafana generates a TXT file in your default browser download location. You can open it in the viewer of your choice.

1. Open the inspector.
1. Inspect the log query results as described above.
1. Click **Download logs**.

### Download trace results

Based on the data source type, Grafana generates a JSON file for the trace results in one of the supported formats: Jaeger, Zipkin, or OTLP formats.

1. Open the inspector.
1. Inspect the trace query results [as described above](#inspect-raw-query-results).
1. Click **Download traces**.

### Inspect query performance

The Stats tab displays statistics that tell you how long your query takes, how many queries you send, and the number of rows returned. This information can help you troubleshoot your queries, especially if any of the numbers are unexpectedly high or low.

1. Open the inspector.
1. Navigate to the **Stats** tab.

Statistics are displayed in read-only format.

### View JSON model

You can explore and export data as well as data frame JSON models.

1. In the Inspector panel, click the **JSON** tab.
1. From the Select source dropdown, choose one of the following options:
   - **Data -** Displays a JSON object representing the data that was returned to Explore.
   - **DataFrame structure -** Displays the raw result set.
1. You can expand or collapse portions of the JSON to view separate sections. You can also click the **Copy to clipboard** option to copy JSON body and paste it into another application.

### View raw request and response to data source

1. Open the panel inspector and then click the **Query** tab.
1. Click **Refresh**.

Grafana sends the query to the server and displays the result. You can drill down on specific portions of the query, expand or collapse all of it, or copy the data to the clipboard to use in other applications.
