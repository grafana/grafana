---
aliases:
  - /docs/grafana/latest/panels/add-panels-dynamically/about-repeating-panels-rows/
  - /docs/grafana/latest/panels/add-panels-dynamically/configure-repeating-rows/
  - /docs/grafana/latest/panels/add-panels-dynamically/configure-repeating-panels/
  - /docs/grafana/latest/panels/add-panels-dynamically/
  - /docs/grafana/latest/panels/repeat-panels-or-rows/
  - /docs/grafana/latest/panels/working-with-panels/add-title-and-description/
  - /docs/grafana/latest/panels/working-with-panels/view-json-model/
  - /docs/grafana/latest/panels/configure-panels/
title: Configure panels
menuTitle: Configure panels
weight: 150
keywords:
  - panel
  - dynamic
  - rows
  - add
  - title
  - description
  - JSON model
---

# Configure panels

You can configure Grafana to dynamically add panels or rows to a dashboard. A dynamic panel (or row) is a panel that the system creates based on the value of a variable. Variables dynamically change your queries across all panels in a dashboard.

You can see examples in the following dashboards:

- [Prometheus repeat](https://play.grafana.org/d/000000036/prometheus-repeat)
- [Repeated Rows Dashboard](https://play.grafana.org/d/000000153/repeat-rows)

## Configure repeating rows

As seen above with the panels you can also repeat rows if you have variables set with `Multi-value` or
`Include all value` selection option.

**Before you begin:**

- Ensure that the query includes a multi-value variable.

**To configure repeating rows**:

1. On the dashboard home page, click **Add panel**.

1. On the **Add a panel** dialog box, click **Add a new row**.

1. Hover over the row title and click the cog icon.

1. On the `Row Options` configuration panel, select the variable for which you want to add repeating rows.

> To help provide context to dashboard users, add the variable to the row title.

## Configure repeating panels

For queries that return multiple values for a variable, you can configure Grafana to dynamically add panels based on those values.

> **Note:** Repeating panels require variables to have one or more items selected; you cannot repeat a panel zero times to hide it.

**Before you begin:**

- Ensure that the query includes a multi-value variable.

**To configure repeating panels:**

1. Edit the panel you want to repeat.

1. On the display options pane, expand **Panel options > Repeat options**.

1. Select a `direction`.

   - Choose `horizontal` to arrange panels side-by-side. Grafana adjusts the width of a repeated panel. Currently, you cannot mix other panels on a row with a repeated panel.
   - Choose `vertical` to arrange panels in a column. The width of repeated panels is the same as the original, repeated panel.

1. To propagate changes to all panels, reload the dashboard.

## Add a title and description to a panel

Add a title and description to a panel to share with users any important information about the visualization. For example, use the description to document the purpose of the visualization.

1. Open a panel.

1. In the panel display options pane, locate the **Panel options** section.

1. Enter a **Title**.

   Text entered in this field is displayed at the top of your panel in the panel editor and in the dashboard.

   You can use [variables you have defined]({{< relref "../../variables/" >}}) in either field, but not [global variables]({{< relref "../../variables/variable-types/global-variables/" >}}).

1. Write a description of the panel and the data you are displaying.

   Text entered in this field is displayed in a tooltip in the upper left corner of the panel.

   You can use [variables you have defined]({{< relref "../../variables/" >}}) in either field, but not [global variables]({{< relref "../../variables/variable-types/global-variables/" >}}).

   ![](/static/img/docs/panels/panel-options-8-0.png)

## View a panel JSON model

Explore and export panel, panel data, and data frame JSON models.

1. Open the panel inspector and then click the **JSON** tab or in the panel menu click **Inspect > Panel JSON**.

1. In Select source, choose one of the following options:

   - **Panel JSON -** Displays a JSON object representing the panel.
   - **Panel data -** Displays a JSON object representing the data that was passed to the panel.
   - **DataFrame structure -** Displays the raw result set with transformations, field configuration, and overrides configuration applied.

1. You can expand or collapse portions of the JSON to explore it, or you can click **Copy to clipboard** and paste the JSON in another application.
