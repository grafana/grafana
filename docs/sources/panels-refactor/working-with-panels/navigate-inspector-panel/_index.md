+++
title = "Navigate the Grafana Inspector panel"
aliases = []
weight = 10
+++

# Navigate the Grafana Inspector panel

# Inspect a panel

The panel inspector helps you understand and troubleshoot your panels. You can inspect the raw data for any Grafana panel, export that data to a comma-separated values (CSV) file, view query requests, and export panel and data JSON.

## Panel inspector UI

The panel inspector displays Inspect: <NameOfPanelBeingInspected> at the top of the pane. Click the arrow in the upper right corner to expand or reduce the pane.

The panel inspector consists of following tabs:

- **Data tab -** Shows the raw data returned by the query with transformations applied. Field options such as overrides and value mappings are not applied by default.
- **Stats tab -** Shows how long your query takes and how much it returns.
- **JSON tab -** Allows you to view and copy the panel JSON, panel data JSON, and data frame structure JSON. This is useful if you are provisioning or administering Grafana.
- **Query tab -** Shows you the requests to the server sent when Grafana queries the data source.
- **Error tab -** Shows the error. Only visible when query returns error.

> **Note:** Not all panel types include all four tabs. For example, dashboard list panels do not have raw data to inspect, so they do not display the Stats, Data, or Query tabs.
