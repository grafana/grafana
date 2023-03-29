---
aliases:
  - add-organize-panels/
keywords:
  - panel
  - dashboard
  - create
menuTitle: Create a dashboard
title: Create a dashboard
weight: 1
---

## Create a dashboard

Dashboards and panels allow you to show your data in visual form. Each panel needs at least one query to display a visualization.

**Before you begin:**

- Ensure that you have the proper permissions. For more information about permissions, refer to [About users and permissions]({{< relref "../../../administration/roles-and-permissions/" >}}).
- Identify the dashboard to which you want to add the panel.
- Understand the query language of the target data source.
- Ensure that data source for which you are writing a query has been added. For more information about adding a data source, refer to [Add a data source]({{< relref "../../../administration/data-source-management#add-a-data-source" >}}) if you need instructions.

**To create a dashboard**:

1. Click **Dashboards** in the left-side menu.
1. Click **New** and select **New Dashboard**.
1. On the empty dashboard, click **Add visualization**.
1. In the first line of the **Query** tab, click the dropdown list and select a data source.
1. Write or construct a query in the query language of your data source.

   For more information about data sources, refer to [Data sources]({{< relref "../../../datasources/" >}}) for specific guidelines.

1. In the visualization list, select a visualization type.

   ![Visualization selector](/media/docs/grafana/dashboards/screenshot-select-visualization-9-5.png)

   Grafana displays a preview of your query results with the visualization applied.

   For more information about individual visualizations, refer to [Visualizations options]({{< relref "../../../panels-visualizations/visualizations/" >}}).

1. Refer to the following documentation for ways you can adjust panel settings.

   While not required, most visualizations need some adjustment before they properly display the information that you need.

   - [Configure value mappings]({{< relref "../../../panels-visualizations/configure-value-mappings" >}})
   - [Visualization-specific options]({{< relref "../../../panels-visualizations/visualizations/" >}})
   - [Override field values]({{< relref "../../../panels-visualizations/configure-overrides/" >}})
   - [Configure thresholds]({{< relref "../../../panels-visualizations/configure-thresholds/" >}})
   - [Configure standard options]({{< relref "../../../panels-visualizations/configure-standard-options/" >}})

1. When you've finished editing your panel, click **Save** in the top right corner.
1. Enter a name for your dashboard and select a folder, if applicable.
1. Click **Save**.

<!-- this part doesn't make sense for a first time dashboard creation - this interaction only happens when you update an existing dashboard
   Notes can be helpful if you need to revert the dashboard to a previous version. -->

## Configure repeating rows

You can configure Grafana to dynamically add panels or rows to a dashboard based on the value of a variable. Variables dynamically change your queries across all rows in a dashboard. For more information about repeating panels, refer to [Configure repeating panels]({{< relref "../../../panels-visualizations/configure-panel-options/#configure-repeating-panels" >}}).

To see an example of repeating rows, refer to [Dashboard with repeating rows](https://play.grafana.org/d/000000153/repeat-rows). The example shows that you can also repeat rows if you have variables set with `Multi-value` or `Include all values` selected.

**Before you begin:**

- Ensure that the query includes a multi-value variable.

**To configure repeating rows:**

1. Click **Dashboards** in the left-side menu.
1. Navigate to the dashboard you want to work on.
1. At the top of the dashboard, click **Add** and select **Row** in the dropdown.

   If the dashboard is empty, you can just click the **Add row** option in the middle of the dashboard.

1. Hover over the row title and click the cog icon.
1. In the **Row Options** dialog box, add a title and select the variable for which you want to add repeating rows.
1. Click **Update**.

> **Note:** To provide context to dashboard users, add the variable to the row title.

## Move a panel

You can place a panel on a dashboard in any location.

1. Click **Dashboards** in the left-side menu.
1. Navigate to the dashboard you want to work on.
1. Click the panel title and drag the panel to the new location.

## Resize a panel

You can size a dashboard panel to suits your needs.

1. Click **Dashboards** in the left-side menu.
1. Navigate to the dashboard you want to work on.
1. To adjust the size of the panel, click and drag the lower-right corner of the panel.
