---
aliases:
  - ../dashboards/add-organize-panels/
  - ../dashboards/dashboard-create/
  - ../features/dashboard/dashboards/
  - ../panels/add-panels-dynamically/about-repeating-panels-rows/
  - ../panels/add-panels-dynamically/configure-repeating-panels/
  - ../panels/add-panels-dynamically/configure-repeating-rows/
  - ../panels/working-with-panels/
  - ../panels/working-with-panels/add-panel/
  - ../panels/working-with-panels/navigate-inspector-panel/
  - ../panels/working-with-panels/navigate-panel-editor/
  - add-organize-panels/
keywords:
  - panel
  - dashboard
  - dynamic
  - add
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Panel editor
title: Panel editor
description: Learn about the features of the panel editor
weight: 20
refs:
  transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
  the-overview-of-grafana-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
  table:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
  add-a-query:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#add-a-query
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#add-a-query
---

# Panel editor

In the panel editor, you can update all the elements of a visualization including the data source, queries, time range, and visualization display options.

![Panel editor](/media/docs/grafana/panels-visualizations/screenshot-panel-editor-view.png)

This following sections describe the areas of the Grafana panel editor.

## Panel header

The header section lists the dashboard in which the panel appears and the following controls:

- **Discard:** Discards changes you have made to the panel since you last saved the dashboard.
- **Save:** Saves changes you made to the panel.
- **Apply:** Applies changes you made and closes the panel editor, returning you to the dashboard. You'll have to save the dashboard to persist the applied changes.

## Visualization preview

The visualization preview section contains the following options:

- **Table view:** Convert any visualization to a table so you can see the data. Table views are helpful for troubleshooting. This view only contains the raw data. It doesn't include transformations you might have applied to the data or the formatting options available in the [Table](ref:table) visualization.
- **Fill:** The visualization preview fills the available space. If you change the width of the side pane or height of the bottom pane the visualization changes to fill the available space.
- **Actual:** The visualization preview has the exact size as the size on the dashboard. If not enough space is available, the visualization scales down preserving the aspect ratio.
- **Time range controls:** **Default** is either the browser local timezone or the timezone selected at a higher level.

## Data section

The data section contains tabs where you enter queries, transform your data, and create alert rules (if applicable).

- **Query tab:** Select your data source and enter queries here. For more information, refer to [Add a query](ref:add-a-query). When you create a new dashboard, you'll be prompted to select a data source before you get to the panel editor. You set or update the data source in existing dashboards using the drop-down in the **Query** tab.
- **Transform tab:** Apply data transformations. For more information, refer to [Transform data](ref:transform-data).
- **Alert tab:** Write alert rules. For more information, refer to [the overview of Grafana Alerting](ref:the-overview-of-grafana-alerting).

## Panel display options

The display options section contains tabs where you configure almost every aspect of your data visualization.
