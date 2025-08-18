---
labels:
  products:
    - cloud
    - oss
  stage:
    - experimental
_build:
  list: false
noindex: true
title: Create a dynamic dashboard
description: Create and edit a dynamic dashboard
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

# Create and edit dynamic dashboards

{{< admonition type="caution" >}}

Dynamic dashboards is an [experimental](https://grafana.com/docs/release-life-cycle/) feature. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. To get early access to this feature, request it through [this form](https://docs.google.com/forms/d/e/1FAIpQLSd73nQzuhzcHJOrLFK4ef_uMxHAQiPQh1-rsQUT2MRqbeMLpg/viewform?usp=dialog).

**Do not enable this feature in production environments as it may result in the irreversible loss of data.**

{{< /admonition >}}

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
1. In the edit pane, enter the dashboard title and description.

   {{< figure src="/media/docs/grafana/dashboards/screenshot-new-dashboard-v12.png" max-width="750px" alt="New dashboard" >}}

1. Under **Panel layout**, choose one of the following options:

   - **Custom** - Position and size panels manually. The default selection.
   - **Auto grid** - Panels are automatically resized to create a uniform grid based on the column and row settings.

1. Click **+ Add visualization**.
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

   {{< figure src="/media/docs/grafana/dashboards/screenshot-select-visualization-v12.png" max-width="350px" alt="Visualization selector" >}}

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

   Alternatively, click **Back to dashboard** if you want to see your changes applied to the dashboard first. Then click **Save** when you're ready.

1. Enter a title and description for your dashboard if you haven't already or have Grafana create them using [generative AI features](ref:generative-ai-features).
1. Select a folder, if applicable.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. To add more panels to the dashboard, click **Back to dashboard** and at the bottom-left corner of the dashboard, click **+ Add panel**.

   {{< figure src="/media/docs/grafana/dashboards/screenshot-add-panel-v12.png" max-width="500px" alt="Add panel button" >}}

1. (Optional) In the edit pane, enter a title and description for the panel and set the panel transparency and repeat options, if applicable.
1. Click **Configure** in either the edit pane or on the panel to the configuration process.
1. When you've saved all the changes you want to make to the dashboard, click **Back to dashboard**.
1. Toggle off the edit mode switch.

{{< admonition type="caution" >}}

Dynamic dashboards is an [experimental](https://grafana.com/docs/release-life-cycle/) feature. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. To get early access to this feature, request it through [this form](https://docs.google.com/forms/d/e/1FAIpQLSd73nQzuhzcHJOrLFK4ef_uMxHAQiPQh1-rsQUT2MRqbeMLpg/viewform?usp=dialog).

**Do not enable this feature in production environments as it may result in the irreversible loss of data.**

{{< /admonition >}}

## Group panels

To help create meaningful sections in your dashboard, you can group panels into rows or tabs.
Rows and tabs let you break up big dashboards or make one dashboard out of several smaller ones.
You can nest tabs and rows within each other or themselves.
Also, tabs are included in the dashboard URL.

The following sections describe the configuration options for adding tabs and rows.
While grouping is meant for multiple panels, you can start a grouping with just one panel.

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Toggle on the edit mode switch.
1. At the bottom-left corner of the dashboard, click **Group panels**.
1. Select **Group into row** or **Group into tab**.

   A dotted line surrounds the panels and the **Row** or **Tab** edit pane is displayed on the right side of the dashboard.

1. Set the [grouping configuration options](#grouping-configuration-options).
1. When you're finished, click **Save** at the top-right corner of the dashboard.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.

### Grouping configuration options

The following table describes the options you can set for a row.

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Title                    | Title of the row or tab. |
| Fill screen              | Toggle the switch on to make the row fill the screen. Only applies to rows. |
| Hide row header          | Toggle the switch on to hide the header. In edit mode, the row header is visible, but crossed out with the hidden icon next to it. Only applies to rows. |
| Group layout             | Select the grouping option, between **Rows** and **Tabs**. Only available when there's a nested grouping and applies to the nested grouping. |
| Panel layout             | Select whether panels are sized and positioned manually, **Custom**, or automatically, **Auto grid**. Only available when a grouping contains panels. |
| Repeat options > [Repeat by variable](#configure-repeat-options) | Configure the dashboard to dynamically add rows or tabs based on the value of a variable. |
| Show / hide rules > [Row/Tab visibility](#configure-showhide-rules) | Control whether or not rows or tabs are displayed based on variables or a time range. |

<!-- prettier-ignore-end -->

## Configure repeat options

<!-- previous heading "Configure repeating rows" -->

You can configure Grafana to dynamically add panels, rows, or tabs to a dashboard based on the value of that variable.
Variables dynamically change your queries across all rows in a dashboard.

This only applies to queries that include a multi-value variable.

<!-- To see an example of repeating rows, refer to [Dashboard with repeating rows](https://play.grafana.org/d/000000153/repeat-rows).
The example shows that you can also repeat rows if you have variables set with `Multi-value` or `Include all values` selected.
Might be good to update this Play example -->

To configure repeats, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Toggle on the edit mode switch.

   The **Dashboard** edit pane opens on the right side of the dashboard.

1. Click in the panel, row, or tab you want to work with to bring it into focus and display the associated options in the edit pane.
1. Expand the **Repeat options** section.
1. Select the **Repeat by variable**.
1. For panels only, set the following options:

   - Under **Repeat direction**, choose one of the following:

     - **Horizontal** - Arrange panels side-by-side. Grafana adjusts the width of a repeated panel. You can’t mix other panels on a row with a repeated panel.
     - **Vertical** - Arrange panels in a column. The width of repeated panels is the same as the original, repeated panel.

   - If you selected **Horizontal**, select a value in the **Max per row** drop-down list to control the maximum number of panels that can be in a row.

1. (Optional) To provide context to dashboard users, add the variable name to the panel, row, or tab title.
1. When you've finished setting the repeat option, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Toggle off the edit mode switch.

### Repeating rows and the Dashboard special data source

<!-- is this next section still true? -->

If a row includes panels using the special [Dashboard data source](ref:built-in-special-data-sources)&mdash;the data source that uses a result set from another panel in the same dashboard&mdash;then corresponding panels in repeated rows will reference the panel in the original row, not the ones in the repeated rows.

For example, in a dashboard:

- `Row 1` includes `Panel 1A` and `Panel 1B`
- `Panel 1B` uses the results from `Panel 1A` by way of the `-- Dashboard --` data source
- Repeating row, `Row 2`, includes `Panel 2A` and `Panel 2B`
- `Panel 2B` references `Panel 1A`, not `Panel 2A`

## Configure show/hide rules

You can configure panels, rows, and tabs to be shown or hidden based on rules.
For example, you might want to set a panel to be hidden if there's no data returned by a query or a tab to only be shown based on a variable being present.

{{< admonition type="note" >}}
You can only configure show/hide rules for panels when the dashboard is using the **Auto grid** panel layout.
{{< /admonition >}}

To configure show/hide rules, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Toggle on the edit mode switch.

   The **Dashboard** edit pane opens on the right side of the dashboard.

1. Click in the panel, row, or tab you want to work with to bring it into focus and display the associated options in the edit pane.
1. Expand the **Show / hide rules** section.
1. Select **Show** or **Hide** to set whether the panel, row, or tab is shown or hidden based on the rules outcome.
1. Click **+ Add rule**.
1. Select a rule type:

   - **Query result** - Show or hide a panel based on query results. Choose from **Has data** and **No data**. For panels only.
   - **Template variable** - Show or hide the panel, row, or tab dynamically based on the variable value. Select a variable and operator and enter a value.
   - **Time range less than** - Show or hide the panel, row, or tab if the dashboard time range is shorter than the selected time frame. Select or enter a time range.

1. Configure the rule.
1. Under **Match rules**, select one of the following:

   - **Match all** - The panel, row, or tab is shown or hidden only if _all_ the rules are matched.
   - **Match any** - The panel, row, or tab is shown or hidden if _any_ of the rules are matched.

   This option is only displayed if you add multiple rules.

1. When you've finished setting rules, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Toggle off the edit mode switch.

{{< admonition type="caution" >}}

Dynamic dashboards is an [experimental](https://grafana.com/docs/release-life-cycle/) feature. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. To get early access to this feature, request it through [this form](https://docs.google.com/forms/d/e/1FAIpQLSd73nQzuhzcHJOrLFK4ef_uMxHAQiPQh1-rsQUT2MRqbeMLpg/viewform?usp=dialog).

**Do not enable this feature in production environments as it may result in the irreversible loss of data.**

{{< /admonition >}}

## Edit dashboards

When the dashboard is in edit mode, the edit pane that opens displays options associated with the part of the dashboard that it's in focus.
For example, if you click in the area of a panel, row, or tab, that area comes into focus and the edit pane shows the options for that area:

{{< figure src="/media/docs/grafana/dashboards/screenshot-edit-pane-focus-v12.png" max-width="750px" alt="Dashboard with a panel in focus" >}}

- For rows and tabs, all of the available options are in the edit pane.
- For panels, high-level options are in the edit pane and further configuration options are in the **Edit panel** view.
- For dashboards, high-level options are in the edit pane and further configuration options are in the **Settings** page.

To edit dashboards, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Toggle on the edit mode switch.

   The **Dashboard** edit pane opens on the right side of the dashboard.

1. Click in the area you want to work with to bring it into focus and display the associated options in the edit pane.
1. Do one of the following:

   - For rows or tabs, make the required changes using the edit pane.
   - For panels, update the panel title, description, repeat options or show/hide rules in the edit pane. For more changes, click **Configure** and continue in **Edit panel** view.
   - For dashboards, update the dashboard title, description, grouping or panel layout. For more changes, click the settings (gear) icon in the top-right corner.

1. When you've finished making changes, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Toggle off the edit mode switch.

### Undo and redo

When a dashboard is in edit mode, you can undo and redo changes you've made using the buttons on the toolbar:

{{< figure src="/media/docs/grafana/dashboards/screenshot-undo-redo-icons-v12.0.png" max-width="500px" alt="Undo and redo buttons" >}}

When you've made a change and hover the cursor over the buttons, the tooltip displays the change you're about to undo or redo.
Also, you can continue undoing or redoing as many changes as you need:

{{< video-embed src="/media/docs/grafana/dashboards/screenrecord-undo-redo-v12.0.mp4" >}}

The undo and redo buttons are only available at the dashboard level and only apply to changes made there, such as dashboard layout and grouping and high-level dashboard or panel updates.
They aren't visible and don't apply when you're configuring a panel or making changes in the dashboard settings.

{{< admonition type="note" >}}
Not all dashboard edit actions can be undone or redone yet.
{{< /admonition >}}

## Move or resize a panel

<!-- previous headings Move a panel & Resize a panel -->

When you're dashboard has a **Custom** layout, you can resize or move a panel to any location on the dashboard.

To move or resize, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Toggle on the edit mode switch.
1. Do one of the following:

   - Click the panel title and drag the panel to the new location.
   - Click and drag the lower-right corner of the panel to change the size of the panel.

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Toggle off the edit mode switch.

## Navigate using the dashboard outline

The dashboard **Outline** provides a tree-like structure that shows you all of the parts of your dashboard and their relationships to each other including panels, rows, tabs, and variables.
The outline also lets you quickly navigate the dashboard so that you don't have to spend time finding a particular element to work with it.
By default, the outline is collapsed except for the part that's currently in focus.

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-outline-v12.png" max-width="750px" alt="Dashboard with outline open showing panel in focus" >}}

To navigate the dashboard using the outline, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Toggle on the edit mode switch.

   The **Dashboard** edit pane opens on the right side of the dashboard.

1. In the edit pane, expand the **Outline** section.
1. Expand the outline to find the dashboard part to which you want to navigate.
1. Click the tree item to navigate that part of the dashboard.

## Copy a dashboard

To make a copy of a dashboard, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Toggle on the edit mode switch.
1. Click the **Save** drop-down and select **Save as copy**.
1. (Optional) Specify the name, folder, description, and whether or not to copy the original dashboard tags for the copied dashboard.

   By default, the copied dashboard has the same name as the original dashboard with the word "Copy" appended and is in the same folder.

1. Click **Save**.

{{< admonition type="caution" >}}

Dynamic dashboards is an [experimental](https://grafana.com/docs/release-life-cycle/) feature. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. To get early access to this feature, request it through [this form](https://docs.google.com/forms/d/e/1FAIpQLSd73nQzuhzcHJOrLFK4ef_uMxHAQiPQh1-rsQUT2MRqbeMLpg/viewform?usp=dialog).

**Do not enable this feature in production environments as it may result in the irreversible loss of data.**

{{< /admonition >}}
