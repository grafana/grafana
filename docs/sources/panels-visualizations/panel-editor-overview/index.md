---
aliases:
  - ../dashboards/add-organize-panels/
  - ../dashboards/dashboard-create/
  - ../features/dashboard/dashboards/
  - ../panels/add-panels-dynamically/about-repeating-panels-rows/
  - ../panels/add-panels-dynamically/configure-repeating-panels/
  - ../panels/add-panels-dynamically/configure-repeating-rows/
  - ../panels/working-with-panels/add-panel/
  - ../panels/working-with-panels/navigate-inspector-panel/
  - ../panels/working-with-panels/navigate-panel-editor/
  - add-organize-panels/
keywords:
  - panel
  - dashboard
  - dynamic
  - rows
  - add
menuTitle: Panel editor overview
title: Panel editor overview
weight: 1
---

# Panel editor overview

![Panel editor](/media/docs/grafana/panels-visualizations/screenshot-panel-editor-view.png)

This section describes the areas of the Grafana panel editor.

1. Panel header: The header section lists the dashboard in which the panel appears and the following controls:

   - **Discard:** Discards changes you have made to the panel since you last saved the dashboard.
   - **Save:** Saves changes you made to the panel.
   - **Apply:** Applies changes you made and closes the panel editor, returning you to the dashboard. You will have to save the dashboard to persist the applied changes.

1. Visualization preview: The visualization preview section contains the following options:

   - **Table view:** Convert any visualization to a table so you can see the data. Table views are helpful for troubleshooting. This view only contains the raw data. It does not include transformations you might have applied to the data or the formatting options available in the [Table]({{< relref "../visualizations/table/" >}}) visualization.
   - **Fill:** The visualization preview fills the available space. If you change the width of the side pane or height of the bottom pane the visualization changes to fill the available space.
   - **Actual:** The visualization preview will have the exact size as the size on the dashboard. If not enough space is available, the visualization will scale down preserving the aspect ratio.
   - **Time range controls:** **Default** is either the browser local timezone or the timezone selected at a higher level.

1. Data section: The data section contains tabs where you enter queries, transform your data, and create alert rules (if applicable).

   - **Query tab:** Select your data source and enter queries here. For more information, refer to [Add a query]({{< relref "../query-transform-data/#add-a-query" >}}).
   - **Transform tab:** Apply data transformations. For more information, refer to [Transform data]({{< relref "../query-transform-data/transform-data/" >}}).
   - **Alert tab:** Write alert rules. For more information, refer to [Overview of Grafana 8 alerting]({{< relref "../../alerting/" >}}).

1. Panel display options: The display options section contains tabs where you configure almost every aspect of your data visualization.

## Open the panel inspect drawer

The inspect drawer helps you understand and troubleshoot your panels. You can view the raw data for any panel, export that data to a comma-separated values (CSV) file, view query requests, and export panel and data JSON.

To access the panel inspect drawer from the edit view, hover over any part of the panel to display the actions menu on the top right corner. Click the menu and select **Inspect**.

> **Note:** Not all panel types include all tabs. For example, dashboard list panels do not have raw data to inspect, so they do not display the Stats, Data, or Query tabs.

The panel inspector consists of the following options:

1. The panel inspect drawer displays opens a drawer on the right side. Click the arrow in the upper right corner to expand or reduce the drawer pane.

1. **Data tab -** Shows the raw data returned by the query with transformations applied. Field options such as overrides and value mappings are not applied by default.

1. **Stats tab -** Shows how long your query takes and how much it returns.

1. **JSON tab -** Allows you to view and copy the panel JSON, panel data JSON, and data frame structure JSON. This is useful if you are provisioning or administering Grafana.

1. **Query tab -** Shows you the requests to the server sent when Grafana queries the data source.

1. **Error tab -** Shows the error. Only visible when query returns error.
