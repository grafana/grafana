+++
title = "Inspect a panel"
type = "docs"
[menu.docs]
identifier = "inspect-a-panel"
parent = "panels"
weight = 400
+++

# Inspect a panel

> **Note:** This documentation refers to a feature only available in Grafana 7.0+.

The panel inspector helps you understand and troubleshoot your panels. You can inspect the raw data for any Grafana panel, export that data to a comma-separated values (CSV) file, view query requests, and export panel and data JSON.

## Panel inspector UI

The panel inspector displays Inspect: <NameOfPanelBeingInspected> at the top of the pane. Click the arrow in the upper right corner to expand or reduce the pane.

The panel inspector consists of four tabs:

* **Data tab -** Shows the raw data returned by the query with transformations applied. Field options such as overrides and value mappings are not applied by default.
* **Stats tab -** Shows how long your query takes and how much it returns.
* **JSON tab -** Allows you to view and copy the panel JSON, panel data JSON, and data frame structure JSON. This is useful if you are provisioning or administering Grafana. 
* **Query tab -** Shows you the requests to the server sent when Grafana queries the data source. 

> **Note:** Not all panel types include all four tabs. For example, dashboard list panels do not have raw data to inspect, so they do not display the Stats, Data, or Query tabs.

## Panel inspector tasks
Tasks you can perform in the panel inspector are described below. 

### Open the panel inspector

You can inspect any panel that you can view.

1. In Grafana, navigate to the dashboard that contains the panel you want to inspect.
1. Click the title of the panel you want to inspect and then click **Inspect**.
   Or
   Hover your cursor over the panel title and then press **i**.

The panel inspector pane opens on the right side of the screen.

### Inspect raw query results

View raw query results in a table. This is the data returned by the query with transformations applied and before the panel applies field options or field option overrides. 

1. Open the panel inspector and then click the **Data** tab or in the panel menu click **Inspect > Data**.
1. If your panel contains multiple queries or queries multiple nodes, then you have additional options.
* **Select result -** Choose which result set data you want to view.
* **Transform data**
  - **Join by time -** View raw data from all your queries at once, one result set per column. Click a column heading to reorder the data.
  
  View raw query results in a table with field options and options overrides applied:
  1. Open the **Data** tab in panel inspector.
  1. Click on **Data display options** above the table.
  1. Click on **Apply field configuration** toggle button.

### Download raw query results as CSV

Grafana generates a CSV file in your default browser download location. You can open it in the viewer of your choice.

1. Open the panel inspector.
1. Inspect the raw query results as described above. Adjust settings until you see the raw data that you want to export.
1. Click **Download CSV**.
 
### Inspect query performance

The Stats tab displays statistics that tell you how long your query takes, how many queries you send, and the number of rows returned. This information can help you troubleshoot your queries, especially if any of the numbers are unexpectedly high or low.

1. Open the panel inspector.
1. Navigate to the Stats tab. 

Statistics are displayed in read-only format.

### View panel JSON model

Explore and export panel, panel data, and data frame JSON models.

1. Open the panel inspector and then click the **JSON** tab or in the panel menu click **Inspect > Panel JSON**.
1. In Select source, choose one of the following options:
   * **Panel JSON -** Displays a JSON object representing the panel.
   * **Panel data -** Displays a JSON object representing the data that was passed to the panel.
   * **DataFrame structure -** Displays the raw result set with transformations, field configuration, and overrides configuration applied.
1. You can expand or collapse portions of the JSON to explore it, or you can click **Copy to clipboard** and paste the JSON in another application. 

### View raw request and response to data source

1. Open the panel inspector and then click the **Query** tab or in the panel menu click **Inspect > Query**.
1. Click **Refresh**.

Grafana sends a query to the server to collect information and then displays the result. You can now drill down on specific portions of the query, expand or collapse all of it, or copy the data to the clipboard to use in other applications.
