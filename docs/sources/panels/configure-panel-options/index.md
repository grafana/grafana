---
aliases:
  - /docs/grafana/latest/panels/add-panels-dynamically/
  - /docs/grafana/latest/panels/repeat-panels-or-rows/
  - /docs/grafana/latest/panels/working-with-panels/add-title-and-description/
  - /docs/grafana/latest/panels/working-with-panels/view-json-model/
  - /docs/grafana/latest/panels/configure-panel-options/
title: Configure panel options
menuTitle: Configure panel options
weight: 150
keywords:
  - panel
  - dynamic
  - add
  - title
  - description
  - JSON model
---

# Configure panel options

A Grafana panel is the user interface you use to define a data source query, and transform and format data that appears in visualizations.

A panel editor includes a query builder and a series of options that you can use to transform data and add information to your panels.

This topic describes how to:

- Open a panel for editing
- Add a panel title and description
- View a panel JSON model
- Add repeating rows and panels

## Edit a panel

After you add a panel to a dashboard, you can open it at any time to change change or update queries, add data transformation, and change visualization settings.

1. Open the dashboard that contains the panel you want to edit.

1. Click in the panel title and select **Edit**. To use a keyboard shortcut to open the panel, hover over the panel and press `e`.

   The panel opens in edit mode.

## Add a title and description to a panel

Add a title and description to a panel to share with users any important information about the visualization. For example, use the description to document the purpose of the visualization.

1. [Edit a panel](#edit-a-panel).

1. In the panel display options pane, locate the **Panel options** section.

1. Enter a **Title**.

   Text entered in this field appears at the top of your panel in the panel editor and in the dashboard.

1. Write a description of the panel and the data you are displaying.

   Text entered in this field appears in a tooltip in the upper-left corner of the panel.

   You can use [variables you have defined]({{< relref "../../dashboards/variables" >}}) in the **Title** and **Description** field, but not [global variables]({{< relref "../../dashboards/variables/add-template-variables/#global-variables" >}}).

   ![](/static/img/docs/panels/panel-options-8-0.png)

## View a panel JSON model

Explore and export panel, panel data, and data frame JSON models.

1. Open the dashboard that contains the panel.

1. Click in the panel title and select **Inspect > Panel JSON**.

1. In the **Select source** field, select one of the following options:

   - **Panel JSON:** Displays a JSON object representing the panel.
   - **Panel data:** Displays a JSON object representing the data that was passed to the panel.
   - **DataFrame structure:** Displays the raw result set with transformations, field configurations, and override configurations applied.

1. To explore the JSON, click `>` to expand or collapse portions of the JSON model.

## Configure repeating panels

You can configure Grafana to dynamically add panels or rows to a dashboard. A dynamic panel is a panel that the system creates based on the value of a variable. Variables dynamically change your queries across all panels in a dashboard. For more information about repeating rows, refer to [Configure repeating rows](../../dashboards/add-organize-panels/#configure-repeating-rows).

> **Note:** Repeating panels require variables to have one or more items selected; you cannot repeat a panel zero times to hide it.

To see an example of repeating panels, refer to [Prometheus dashboard with repeating panels](https://play.grafana.org/d/000000036/prometheus-repeat).

**Before you begin:**

- Ensure that the query includes a multi-value variable.

**To configure repeating panels:**

1. [Edit the panel](#edit-a-panel) you want to repeat.

1. On the display options pane, click **Panel options > Repeat options**.

1. Select a `direction`.

   - Choose `horizontal` to arrange panels side-by-side. Grafana adjusts the width of a repeated panel. Currently, you cannot mix other panels on a row with a repeated panel.
   - Choose `vertical` to arrange panels in a column. The width of repeated panels is the same as the original, repeated panel.

1. To propagate changes to all panels, reload the dashboard.
