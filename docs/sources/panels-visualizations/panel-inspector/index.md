---
aliases:
  - /docs/grafana/latest/panels/working-with-panels/navigate-inspector-panel/
  - /docs/grafana/latest/panels-visualizations/panel-inspector/
title: The panel inspect view
weight: 1200
---

# The panel inspect view

The panel inspect view, which you can open via the panel menu, helps you understand and troubleshoot your panels. You can inspect the raw data for any Grafana panel, export that data to a comma-separated values (CSV) file, view query requests, and export panel and data JSON.

> **Note:** Not all panel types include all tabs. For example, dashboard list panels do not have raw data to inspect, so they do not display the Stats, Data, or Query tabs.

The panel inspector consists of the following options:

1. The panel inspector displays Inspect: <NameOfPanelBeingInspected> at the top of the pane. Click the arrow in the upper right corner to expand or reduce the pane.

2. **Data tab -** Shows the raw data returned by the query with transformations applied. Field options such as overrides and value mappings are not applied by default.

3. **Stats tab -** Shows how long your query takes and how much it returns.

4. **JSON tab -** Allows you to view and copy the panel JSON, panel data JSON, and data frame structure JSON. This is useful if you are provisioning or administering Grafana.

5. **Query tab -** Shows you the requests to the server sent when Grafana queries the data source.

6. **Error tab -** Shows the error. Only visible when query returns error.

## Download query data

In the **Data\*** tab you can download the query results as CSV.
