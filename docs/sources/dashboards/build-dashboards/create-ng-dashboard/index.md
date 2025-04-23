---
labels:
  products:
    - cloud
    - enterprise
    - oss
  stage:
    - experimental
menuTitle: Create a next gen dashboard
title: Create a next generation dashboard
description: Create and edit a next generation dashboard
weight: 900
refs:
  built-in-special-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#special-data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/#special-data-sources
  visualization-specific-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/
  configure-standard-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/
  configure-value-mappings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-value-mappings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-value-mappings/
  generative-ai-features:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards
  configure-thresholds:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-thresholds/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-thresholds/
  data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/
  add-a-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source
  about-users-and-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
  visualizations-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/
  configure-repeating-panels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-panel-options/#configure-repeating-panels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-panel-options/#configure-repeating-panels
  override-field-values:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/
---

# Create and edit next generation dashboards

{{< docs/experimental product="Next generation dashboards" featureFlag="dashboardNewLayouts" >}}

Dashboards and panels allow you to show your data in visual form. Each panel needs at least one query to display a visualization.

## Before you begin

- Ensure that you have the proper permissions. For more information about permissions, refer to [About users and permissions](ref:about-users-and-permissions).
- Identify the dashboard to which you want to add the panel.
- Understand the query language of the target data source.
- Ensure that data source for which you are writing a query has been added. For more information about adding a data source, refer to [Add a data source](ref:add-a-data-source) if you need instructions.

## Create a dashboard

To create a dashboard, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click **New** and select **New Dashboard**.
1. In the right side edit pane, enter the dashboard title and description.
1. Under **Panel layout** choose one of the following options:

   - **Custom** - Position and size each panel manually. Default selection.
   - **Auto grid** - Panels are resized to create a uniform grid based on the column and row settings.

1. Click **+ Add visualization**.

   ![Empty dashboard state](/media/docs/grafana/dashboards/empty-dashboard-10.2.png) <!-- replace screenshot, maybe add 2 captioned for each workflow -->

1. In the dialog box that opens, do one of the following:

   - Select one of your existing data sources.
   - Select one of the Grafana [built-in special data sources](ref:built-in-special-data-sources).
   - Click **Configure a new data source** to set up a new one (Admins only).

   {{< figure class="float-right"  src="/media/docs/grafana/dashboards/screenshot-data-source-selector-10.0.png" max-width="800px" alt="Select data source modal" >}}

   The **Edit panel** view opens with your data source selected.
   You can change the panel data source later using the drop-down in the **Query** tab of the panel editor if needed.

   For more information about data sources, refer to [Data sources](ref:data-sources) for specific guidelines.

1. Write or construct a query in the query language of your data source.
1. Click **Refresh** to query the data source.
1. In the visualization list, select a visualization type.

   ![Visualization selector](/media/docs/grafana/dashboards/screenshot-select-visualization-11-2.png)

   Grafana displays a preview of your query results with the visualization applied.

   For more information about configuring individual visualizations, refer to [Visualizations options](ref:visualizations-options).

1. Under **Panel options**, enter a title and description for your panel or have Grafana create them using [generative AI features](ref:generative-ai-features).
1. Refer to the following documentation for ways you can adjust panel settings.

   While not required, most visualizations need some adjustment before they properly display the information that you need.

   - [Configure value mappings](ref:configure-value-mappings)
   - [Visualization-specific options](ref:visualization-specific-options)
   - [Override field values](ref:override-field-values)
   - [Configure thresholds](ref:configure-thresholds)
   - [Configure standard options](ref:configure-standard-options)

1. When you've finished editing your panel, click **Save**.

   Alternatively, click **Back to dashboard** if you want to see your changes applied to the dashboard first. Then click **Save dashboard** when you're ready.

1. Enter a title and description for your dashboard if you haven't already or have Grafana create them using [generative AI features](ref:generative-ai-features).
1. Select a folder, if applicable.
1. Click **Save**.
1. To add more panels to the dashboard, click **Back to dashboard**.
   Then click **Add** in the dashboard header and select **Visualization** in the drop-down.

   ![Add drop-down](/media/docs/grafana/dashboards/screenshot-add-dropdown-11.2.png)

   When you add additional panels to the dashboard, you're taken straight to the **Edit panel** view.

1. When you've saved all the changes you want to make to the dashboard, click **Exit edit**.

   Now, when you want to make more changes to the saved dashboard, click **Edit** in the top-right corner.

## Group panels

You can group panels into rows or tabs, and you can nest tabs and rows within each other.
The following sections describe the configuration options for adding tabs and rows.
While grouping is meant for multiple panels, you can start grouping with even just one panel.

1. On the dashboard, toggle on the edit mode switch.
1. At the bottom-left corner of the dashboard, click **Group panels**.
1. Select **Group into row** or **Group into tab**.

   A dotted line surrounds the panels and the **Row** or **Tab** edit pane is displayed on the right side of the dashboard.

1. Set the [grouping configuration options](#grouping-configuration-options).
1. When you're finished, click **Save** at the top-right corner of the dashboard.
1.Click **Save**.

### Grouping configuration options

The following table describes the options you can set for a row.

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Title                    | Title of the row or tab. |
| Fill screen              | Toggle the switch on to make the row fill the screen. Only applies to rows. |
| Hide row header          | Toggle the switch on to hide the header. In edit mode, the row header is visible, but crossed out with the hidden icon next to it. Only applies to rows. |
| Group layout             | Select the grouping option, between **Rows** and **Tabs**. Only available when a grouping contains another grouping for use on the nested grouping.  |
| Panel layout             | Select the way panels are sized and positioned between **Custom** and **Auto grid**. Only available when a grouping contains panels. |
| Repeat options > [Repeat by variable](#configure-repeat-options) | Configure the dashboard to dynamically add rows or tabs based on the value of a variable. |
| Show / hide rules > [Row/Tab visibility](#configure-show--hide-rules) | Control whether or not rows or tabs are displayed based on variables or a time range. |

<!-- prettier-ignore-end -->

## Configure repeat options

<!-- previous heading "Configure repeating rows" -->

If you have a query that includes a multi-value variable, you can configure Grafana to dynamically add panels, rows, or tabs to a dashboard based on the value of that variable.
Variables dynamically change your queries across all rows in a dashboard.

<!-- To see an example of repeating rows, refer to [Dashboard with repeating rows](https://play.grafana.org/d/000000153/repeat-rows).
The example shows that you can also repeat rows if you have variables set with `Multi-value` or `Include all values` selected.
Might be good to update this Play example -->

To configure repeats, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to work on.
1. Toggle on the edit mode switch.

   The **Dashboard** edit pane opens on the right side of the dashboard.

1. Click in the area you want to edit to put it in focus and change the edit pane to that item.
1. Expand the **Repeat options** section.
1. Select the **Repeat by variable**.
1. For panels only, set the following options:

   - Under **Repeat direction**, choose one of the following:

     - **Horizontal** - Arrange panels side-by-side. Grafana adjusts the width of a repeated panel. You can’t mix other panels on a row with a repeated panel.
     - **Vertical** - Arrange panels in a column. The width of repeated panels is the same as the original, repeated panel.

   - If you selected **Horizontal**, select a value in the **Max per row** drop-down list to control the maximum number of panels that can be in a row.

1. When you've finished setting the repeat option, click **Save**.
1. Enter an optional description of your changes and click **Save**.

To provide context to dashboard users, add the variable to the row title.

### Repeating rows and the Dashboard special data source

<!-- is this still true? -->

If a row includes panels using the special [Dashboard data source](ref:built-in-special-data-sources)&mdash;the data source that uses a result set from another panel in the same dashboard&mdash;then corresponding panels in repeated rows will reference the panel in the original row, not the ones in the repeated rows.

For example, in a dashboard:

- `Row 1` includes `Panel 1A` and `Panel 1B`
- `Panel 1B` uses the results from `Panel 1A` by way of the `-- Dashboard --` data source
- Repeating row, `Row 2`, includes `Panel 2A` and `Panel 2B`
- `Panel 2B` references `Panel 1A`, not `Panel 2A`

## Configure Show / hide rules

You can configure panels, rows, and tabs to be shown or hidden based on rules.
For example, you might want to set a panel to be hidden if there's no data returned by a query, or you might want a tab to only be shown based on a variable value being present.

{{< admonition type="note" >}}
You can only configure show/hide rules for panels when the dashboard is using the **Auto grid** panel layout.
{{< /admonition >}}
<!-- why -->

To configure show/hide rules, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to work on.
1. Toggle on the edit mode switch.

   The **Dashboard** edit pane opens on the right side of the dashboard.

1. Click in the area you want to edit to put it in focus and change the edit pane to that item.
1. Expand the **Show / hide rules** section.
1. Select **Show** or **Hide** to determine the action that will be taken based on the rules set.
1. Click **+ Add rule**.
1. Select a rule type:

   - **Query result** - For panels only, show or hide a panel based on query results. Choose from **Has data** and **No data**.

   - **Template variable** - Show or hide the panel, row, or tab dynamically based on the variable value. Select a variable and operator and enter a value.

   - **Time range less than** - Show or hide the panel, row, or tab if the dashboard time range is shorter than the selected time frame. Select or enter a time range.

1. Configure the rule.
1. Under **Match rules**, select one of the following:

   - **Match all** - The panel, row, or tab is shown or hidden only if all the rules are matched.
   - **Match any** - The panel, row, or tab is shown or hidden if any of the rules are matched.

   This option is only displayed if you add multiple rules.

1. When you've finished setting rules, click **Save**.
1. Enter an optional description of your changes and click **Save**.

## Edit dashboards

When you're in edit mode in the dashboard, the edit pane that opens aligns with the part of the dashboard that it's in focus.
For example, if you click in the area of a panel, row, or tab, that area comes into focus and the edit pane shows the settings for that area:

<!-- screenshot here -->

For rows and tabs, all of the settings are in the edit pane.
For panels, high-level settings are in the edit pane and further configuration options are in the **Edit panel** view.
For dashboards, high-level settings are in the edit pane and further configuration options are in the **Settings** page.

To edit dashboards, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to work on.
1. Toggle on the edit mode switch.

   The **Dashboard** edit pane opens on the right side of the dashboard.

1. Click in the area you want to edit to put it in focus and change the edit pane to that item.
1. Do one of the following:

   - For rows or tabs, make the required changes using the edit pane.
   - For panels, update the panel title, description, repeat options or show/hide rules in the edit pane. For more changes, click **Configure** and continue in **Edit panel** view.
   - For dashboards, update the dashboard title, description, grouping or panel layout. For more changes, click the settings (gear) icon in the top-right corner.

1. When you've finished making the required changes, click **Save**.
1. Enter an optional description of your changes and click **Save**.

## Move or resize a panel

<!-- previous headings Move a panel & Resize a panel -->

When you're dashboard has a **Custom** layout, you can place a panel on a dashboard in any location.
To move or resize, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to work on.
1. Toggle on the edit mode switch.
1. Do one of the following:

   - Click the panel title and drag the panel to the new location.
   - Click and drag the lower-right corner of the panel to change the size of the panel.

1. Click **Save dashboard**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## Navigate using the dashboard outline

TBA

## Copy a dashboard

To copy a dashboard, follow these steps:

1. Click **Dashboards** in the main menu.
1. Open the dashboard you want to copy.
1. Click **Edit** in top-right corner.
1. Click the **Save dashboard** drop-down and select **Save as copy**.
1. (Optional) Specify the name, folder, description, and whether or not to copy the original dashboard tags for the copied dashboard.

   By default, the copied dashboard has the same name as the original dashboard with the word "Copy" appended and is in the same folder.

1. Click **Save**.