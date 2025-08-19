---
aliases:
  - ../dashboards/add-organize-panels/
  - ../dashboards/dashboard-create/
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
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/
  the-overview-of-grafana-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  table:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/table/
  add-a-query:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#add-a-query
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#add-a-query
  saved-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#saved-queries
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#saved-queries
---

# Panel editor

In the panel editor, you can update all the elements of a visualization including the data source, queries, time range, and visualization display options.

![Panel editor](/media/docs/grafana/panels-visualizations/screenshot-panel-editor-v11.6.png)

This following sections describe the areas of the Grafana panel editor.

## Panel header

The header section lists the dashboard in which the panel appears and the following controls:

- **Back to dashboard** - Return to the dashboard with changes applied, but not yet saved.
- **Discard panel changes** - Discard changes you have made to the panel since you last saved the dashboard.
- **Save dashboard** - Save your changes to the dashboard.

## Visualization preview

The visualization preview section contains the following options:

- **Table view** - Convert any visualization to a table so you can see the data. Table views are helpful for troubleshooting. This view only contains the raw data. It doesn't include transformations you might have applied to the data or the formatting options available in the [Table](ref:table) visualization.
- **Time range controls** - **Default** is either the browser local timezone or the timezone selected at a higher level.
- **Refresh** - Query the data source.

## Data section

The data section contains tabs where you enter queries, transform your data, and create alert rules (if applicable).

- **Queries**
  - Select your data source. You can also set or update the data source in existing dashboards using the drop-down menu in the **Queries** tab.
  - [Add queries](ref:add-a-query). Write or construct a query in the query language of your data source or click **+ Add saved query** to add a previously [saved query](ref:saved-queries) (Grafana Enterprise and Cloud only). Even if you've already written a query, you can click the **Replace with saved query** icon to use a previously saved query instead. To use again in other dashboards, save it by clicking the save icon on the query editor. Saved queries is in [public preview](https://grafana.com/docs/release-life-cycle/).
- **Transformations** - Apply data transformations. For more information, refer to [Transform data](ref:transform-data).
- **Alert** - Write alert rules. For more information, refer to [the overview of Grafana Alerting](ref:the-overview-of-grafana-alerting).

## Panel display options

The display options section contains tabs where you configure almost every aspect of your data visualization.
