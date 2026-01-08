---
aliases:
  - ../../../dashboards/build-dashboards/add-organize-panels/ # /docs/grafana/next/dashboards/build-dashboards/add-organize-panels/
  - ../../../dashboards/build-dashboards/create-dashboard/ # /docs/grafana/next/dashboards/build-dashboards/create-dashboard/
  - ../../../dashboards/build-dashboards/create-dynamic-dashboard/ # /docs/grafana/latest/dashboards/build-dashboards/create-dynamic-dashboard/
  - ./create-dynamic-dashboard/ # /docs/grafana/latest/visualizations/dashboards/build-dashboards/create-dynamic-dashboard/
keywords:
  - panel
  - dashboard
  - create
  - dynamic dashboard
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Create dashboards
description: Create and edit a dashboard
weight: 1
refs:
  built-in-special-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#special-data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/#special-data-sources
  visualization-specific-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/
  configure-standard-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-standard-options/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/
  configure-value-mappings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-value-mappings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-value-mappings/
  generative-ai-features:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards
  configure-thresholds:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-thresholds/
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
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/
  configure-repeating-panels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-panel-options/#configure-repeating-panels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-panel-options/#configure-repeating-panels
  override-field-values:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-overrides/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/
  saved-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#saved-queries
  save-query:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#save-a-query
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#save-a-query
---

# Create dashboards

{{< admonition type="note">}}
Dynamic dashboards is currently in public preview. Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

For information on the generally available dashboard creation experience, refer to the [documentation for the latest self-managed version of Grafana](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/create-dashboard/).
{{< /admonition >}}

Dashboards and panels allow you to show your data in visual form.
Each panel needs at least one query to display a visualization.

**Before you begin:**

- Ensure that you have the proper permissions. For more information about permissions, refer to [About users and permissions](ref:about-users-and-permissions).
- Identify the dashboard to which you want to add the panel.
- Understand the query language of the target data source.
- Ensure that data source for which you are writing a query has been added. For more information about adding a data source, refer to [Add a data source](ref:add-a-data-source) if you need instructions.

## Create a dashboard

To create a dashboard, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click **New** and select **New Dashboard**.
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
1. Enter a title and description for your dashboard if you haven't already or have Grafana create them using [generative AI features](ref:generative-ai-features).
1. Select a folder, if applicable.
1. Click **Save**
1. Click **Back to dashboard**.
1. (Optional) Continue building your dashboard by doing one or more of the following:

   - **+ Add panel**: Set panel options in the edit pane or click **Configure** to do full panel setup.
   - **+ Add variable**: Follow the steps to [add a variable to the dashboard](#add-variables).
   - **Group panels**: Choose from **Group into row** or **Group into tab**. For more information on groupings, refer to [Panel groupings](#panel-groupings).
   - **Dashboard options** icon: Open the edit pane to access [panel layout options](#panel-layouts) and the dashboard title and description.

1. When you've finished making changes, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**
1. Click **Exit edit**.

## Dashboard edit

Now that you've created a basic dashboard, you can augment it with more options.
You can make several updates without leaving the dashboard by using the edit pane, which is explained in the next section.

### The edit pane and sidebar

The _edit pane_ allows you to make changes without leaving the dashboard.
When the dashboard is in edit mode, the edit pane displays options associated with the part of the dashboard that's in focus.
For example, if you click in the area of a panel, row, or tab, that area comes into focus and the edit pane shows the options for it:

{{< figure src="/media/docs/grafana/dashboards/screenshot-edit-pane-focus-v12.png" max-width="750px" alt="Dashboard with a panel in focus" >}}

The _sidebar_ is on the right side of the edit pane, and it includes options that are useful to have available all the time.
The following image shows the parts of the edit pane and the sidebar:

<!-- screenshot here with annotations for sidebar options including which ones are only in edit mode

| Option | View mode | Edit mode |
| ------ | --------- | --------- |
| Settings | | x |
| Feedback | | x |
| Export | x | x |
| Content outline | x | x |
| Dashboard insights | x | x | -->

The sidebar includes the following options:

- Settings
- Feedback
- Export
- [Content outline](#navigate-using-the-content-outline)
- Dashboard insights

{{< admonition type="note" >}}
The sidebar is displayed in both edit and view mode, but the **Dashboard options** and **Feedback** options aren't available in view mode.
{{< /admonition >}}

You can dock, undock, and resize the edit pane.
When the edit pane is closed, you can resize the sidebar so the icon names are visible.

<!-- Screen recording here -->

All of the available configuration options for groupings (rows and tabs) are available in the edit pane.

- For panels, high-level options are in the edit pane and further configuration options are in the **Edit panel** view.
- For dashboards, high-level options are in the edit pane and further configuration options are in the **Settings** page.

### Navigate using the content outline

The **Content outline** provides a tree-like structure that shows you all of the parts of your dashboard and their relationships to each other including panels, rows, tabs, and variables.
The outline also lets you quickly navigate the dashboard so that you don't have to spend time finding a particular element to work with it.
By default, the outline is collapsed.

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-outline-v12.png" max-width="750px" alt="Dashboard with outline open showing panel in focus" >}}
<!-- update this -->

To navigate the dashboard using the outline, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to view or update.
1. In the right sidebar, click the **Content outline** icon to open it.
1. Expand the outline to find the part of the dashboard you want to view or update.
1. Click the tree item to navigate that part of the dashboard.

### Edit a dashboard

To edit a dashboard, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the part of the dashboard you want to work with to open the edit pane with the relevant options displayed or click **Dashboard options** to open the edit pane.

   If the dashboard is large, open the **Content outline** and use it to navigate to the part of the dashboard you want to update.

1. Update the dashboard as needed.
1. When you've finished making changes, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Back to dashboard** if needed.
1. Click **Exit edit**

## Panel layouts

There are two panel layout options available:

- **Custom**: You can position and size panels individually. This is the default selection. **Show/hide rules** are not supported.
- **Auto grid**: Panels resize and fit automatically to create a uniform grid. You can't make manual changes to this layout. **Show/hide rules** are supported.

Both layout options are supported in row and tab groupings.

### Auto grid layout

With the auto grid layout, the layout of the dashboard is automatically adjusted as you add panels.
There are default parameters to constrain the layout, and you can update these to have more control over the display:

- **Min column width**: Set the minimum width of the columns in the layout grid. Choose from **Standard**, **Narrow**, **Wide**, or **Custom**, for which you can enter the minimum width in pixels.
- **Max columns**: Set the maximum number of columns that layout can have up to 10.
- **Row height**: Set the height of the rows in the layout grid. Choose from **Standard**, **Short**, **Tall**, and **Custom**, for which you can enter the minimum width in pixels.
- **Fill screen**: Toggle the switch on to have the dashboard fill the entire screen, as shown in the following screen recording:

   {{< video-embed src="layout-fillscreen.mp4" >}}
   <!-- TBA -->

### Update panel layout

To update the panel layout, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Do one of the following:

   - If the panel layout you want to change isn't contained in a grouping, click the dashboard outside of a grouping, and then click the **Dashboard options** icon to open the edit pane.
   - Open the **Content outline** and use it to navigate to the grouping that contains the panel layout you want to update. Click the grouping to open the edit pane with the relevant options displayed.

1. Under **Layout**, select **Custom** or **Auto grid**.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**

## Panel groupings

To help create meaningful sections in your dashboard, you can group panels into rows or tabs.
Rows and tabs let you break up big dashboards or make one dashboard out of several smaller ones.

You can think of the dashboard as a series of nested containers: the dashboard is the largest container and it can contain panels, rows, or tabs.
Rows and tabs are the next largest containers, and they contain panels.

You can also nest:

- Rows in rows
- Rows in tabs
- Tabs in rows

You can nest up to two levels deep, which means your dashboard can have a maximum of four configuration levels:

- Dashboard
- Grouping 1 - Row or tab
- Grouping 2 - Row or tab
- Panels

When you choose the grouping type, row or tab, at Grouping 1-level, you can only add more of that grouping type at that level.
Inside of those groupings however, you have to freedom to add rows, tabs (as long as it's not a tab), and panels.

<!--maybe a video or screenshot with limitations here -->

Custom and auto grid panel layouts are supported for rows and tabs, so each of your groupings can have a different panel layout.

The following sections describe the configuration options and layouts for grouping panels into tabs and rows, as well as how to add and remove groupings.

### Grouping configuration options

The following table describes the options you can set for a row or tab.

<!-- prettier-ignore-start -->

| Option                   | Description                                                                 |
| -------------------------| --------------------------------------------------------------------------- |
| Title                    | Title of the row or tab.                                                    |
| Fill screen (rows only)  | Toggle the switch on to make the row fill the screen. Only applies to rows. |
| Hide row header (rows only) | Toggle the switch on to hide row headers in view mode. In edit mode, the row header is visible, but crossed out with the hidden icon next to it. |
| Layout                   | Select the layout. If the grouping contains another grouping, choose from **Rows** or **Tabs**. If the grouping contains panels, choose from **Custom** or **Auto grid**. For more information, refer to [Panel layouts](#panel-layouts) and [Grouping layouts](#grouping-layouts). |
| Repeat options > [Repeat by variable](#configure-repeat-options) | Configure the dashboard to dynamically add panels, rows, or tabs based on the value of a variable. |
| Show / hide rules > [Panel/Row/Tab visibility](#configure-showhide-rules) | Control whether or not panels, rows, or tabs are displayed based on variables or a time range. |

<!-- prettier-ignore-end -->

### Grouping layouts

When you have panels grouped into rows or tabs, the **Layout** options available depend on what element in the dashboard you have selected and the nesting level.

You can nest up to two levels deep, which means your dashboard can have a maximum of four configuration levels, with the following layout options:

- **Dashboard**: Layout options allow you to choose between rows or tabs.
- **Grouping 1 (outer)**: Layout options allow you to choose between rows or tabs.
- **Grouping 2 (inner)**: Layout options allow you to choose between custom and auto grid (refer to [Panel layouts](#panel-layouts)).
- **Panels**: No layout options

You can switch between rows and tabs or update the panel layout by selecting the parent container, or next level up, and changing the layout selection.

### Group panels

To group panels, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. On the dashboard beneath a panel, click **Group panels**.

   While grouping is typically used for multiple panels, you can start a grouping with just one panel.

1. Select **Group into row** or **Group into tab**.

   All of the panels on the dashboard are placed in the selected grouping type and a dotted blue line surrounds row or tab.
   The edit pane displays the relevant options.

1. Set the [grouping configuration options](#grouping-configuration-options) in the edit pane.
1. (Optional) Add a [nested grouping](#add-nested-groupings).
1. (Optional) Add other [groupings at the same level](#add-more-groupings-at-the-same-level).
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

#### Add nested groupings

To nest the panels in a second-level grouping, follow these steps:

1. In the existing first-level grouping, beneath the panels, click **Group panels**.
1. Click **Group into row** or **Group into tab** (**Group into tab** is only available if the parent grouping is a row).

   The new grouping is added inside the first grouping, and the panels are moved into the nested grouping.

1. Set the grouping configuration options.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

#### Add more groupings at the same level

To add more first-level groupings, follow these steps:

1. On the dashboard, outside the existing first-level grouping, click **New row** or **New tab** (only one option will be available).
1. Set the grouping configuration options.
1. Click **+ Add panel** to begin adding panels
1. Click **Group panels** beneath the panels to add a nested grouping, if needed (refer to the previous set of directions).
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

<!-- Screenshot here of a 2-level nest with area highlighted -->

### Ungroup panels

You can remove groupings from the dashboard at any time without losing your panels.
If you have nested groupings, removing the grouping closest to the dashboard level also automatically removes the grouping closest to the panels.

<!-- screenshot or recording here -->

To remove grouping, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. (Optional) Click the **Content outline** icon to quickly navigate to the grouping you want to remove.
1. Click the grouping to bring it into focus.

   A dotted blue line surrounds highlights the grouping.

1. Click **Ungroup rows** or **Ungroup tabs**.
1. Click **Save** at the top-right corner of the dashboard.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.

<!-- you gotta ungroup everything -->
Note that if you delete a grouping, then the panels are lost.

## Configure repeat options

You can configure Grafana to dynamically add panels, rows, or tabs to a dashboard based on the value of that variable.
Variables dynamically change your queries across all rows in a dashboard.

This only applies to queries that include a multi-value variable.

To configure repeats, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the panel, row, or tab you want to work with to open the edit pane with the relevant options displayed.

   If the dashboard is large, open the **Content outline** and use it to navigate to the panel, row, or tab.

1. Expand the **Repeat options** section.
1. Select the **Repeat by variable**.
1. For panels in a custom layout, set the following options:
   1. Under **Repeat direction**, choose one of the following:
      - **Horizontal** - Arrange panels side-by-side. Grafana adjusts the width of a repeated panel. You can’t mix other panels on a row with a repeated panel.
      - **Vertical** - Arrange panels in a column. The width of repeated panels is the same as the original, repeated panel.
   1. If you selected **Horizontal**, select a value in the **Max per row** drop-down list to control the maximum number of panels that can be in a row.

1. (Optional) To provide context to dashboard users, add the variable name to the panel, row, or tab title.
1. When you've finished setting the repeat option, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

### Repeating rows and tabs and the Dashboard special data source

If a row includes panels using the special [Dashboard data source](ref:built-in-special-data-sources)&mdash;the data source that uses a result set from another panel in the same dashboard&mdash;then corresponding panels in repeated rows will reference the panel in the original row, not the ones in the repeated rows.
The same behavior applies to tabs.

For example, in a dashboard:

- `Row 1` includes `Panel 1A` and `Panel 1B`
- `Panel 1B` uses the results from `Panel 1A` by way of the `-- Dashboard --` data source
- Repeating row, `Row 2`, includes `Panel 2A` and `Panel 2B`
- `Panel 2B` references `Panel 1A`, not `Panel 2A`

## Show/hide rules

You can configure panels, rows, and tabs to be shown or hidden based on rules.
For example, you might want to set a panel to be hidden if there's no data returned by a query, or for a tab to only be shown based on a variable being present.

There are three types of show/hide rules to choose from, which are described in the following sections:

- [Query result](#query-result-rule)
- [Template variable](#template-variable-rule)
- [Time range less than](#time-range-less-than-rule)

For steps on how to create show/hide rules, refer to [Configure show/hide rules](#configure-showhide-rules).

{{< admonition type="note" >}}
You can only configure show/hide rules for panels in the **Auto grid** layout. Set the panel layout at the dashboard, row, or tab-level.
{{< /admonition >}}

### Query result rule

Show or hide a panel based on whether or not the query returns any results.
The rule provides **Has data** and **No data** options, so you can choose to how or hide the panel based on the presence of data or no data.

For example, if you have a dashboard with several panels and only want panels that return data to appear, set the rule as follows:

- Panel visibility > Show
- Query result > Has data

You might also want to troubleshoot a dashboard with several panels to see which ones contain broken queries that aren't returning any results.
In this case, you'd set the rule as follows:

- Panel visibility > Show
- Query result > No data

### Template variable rule

Show or hide the panel, row, or tab dynamically based on the variable value.
You can select any variable that's configured for the dashboard and choose from the following operators for maximum flexibility:

- Equals
- Not equals
- Matches
- Not matches

You can add more variables on the fly without leaving the dashboard using the outline.
For more information, refer to [Add variables using the content outline](#add-variables-using-the-content-outline).

### Time range less than rule

Show or hide the panel, row, or tab if the dashboard time range is shorter than the selected time range.
This ensures that as you change the time range of the dashboard, you only see data relevant to that time period.

For example, a dashboard is tracking adoption of a feature over time with the following setup:

- The dashboard has a time of the **Last 7 days**.
- There are a set of panels that track weekly stats and a set that track daily stats.

For the panels that track weekly stats, a rule is set up to hide them if the dashboard time range is less than 7 days.
For the daily stats, a rule is set up to hide them if the dashboard time range is less 24 hours.
This configuration ensures that these time-sensitive panels are only displayed when enough time has passed to make them relevant.

For this rule type, you can select time ranges from **5 minutes** to **5 years**.

### Configure show/hide rules

To configure show/hide rules, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the panel, row, or tab you want to work with to open the edit pane with the relevant options displayed.

   If the dashboard is large, open the **Content outline** and use it to navigate to the panel, row, or tab.

1. Expand the **Show / hide rules** section.
1. Select **Show** or **Hide** to set whether the panel, row, or tab is shown or hidden based on the rules outcome.
1. Click **+ Add rule**.
1. Select a rule type:
   - **Query result** - Show or hide a panel based on query results. Choose from **Has data** and **No data**. For panels only.
   - **Template variable** - Show or hide the panel, row, or tab dynamically based on the variable value. Select a variable and operator and enter a value.
   - **Time range less than** - Show or hide the panel, row, or tab if the dashboard time range is shorter than the selected time range. Select a time range from **5 minutes** to **5 years**.

1. Configure the rule.

   If you've set a hide rule, the panel, row, or tab isn't visible when the dashboard is in view mode. In edit mode, an icon indicating the panel, row, or tab isn't visible is displayed on the dashboard element.

1. Under **Match rules**, select one of the following:
   - **Match all** - The panel, row, or tab is shown or hidden only if _all_ the rules are matched.
   - **Match any** - The panel, row, or tab is shown or hidden if _any_ of the rules are matched.

   This option is only displayed if you add multiple rules.

1. When you've finished setting rules, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**

## Move or resize a panel

When your dashboard has a **Custom** layout, you can manually resize or move a panel.
If the dashboard has rows or tabs, you can only move panels to other rows or tabs; panels can't be placed on the dashboard outside of a grouping.

To move or resize, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Navigate to the panel you want to move or resize.

   If the dashboard is large, open the **Content outline** and use it to navigate to the panel, row, or tab.

1. Do one of the following:
   - Click the panel title and drag the panel to another row or tab, or to a new position on the dashboard.
   - Click and drag the lower-right corner of the panel to change the size of the panel.

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**

## Add variables

To add variables without leaving the dashboard, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **+ Add variable** button at the top of the dashboard.
1. Choose a variable type from the list.
1. Set the options for the variable.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**

### Add variables using the content outline

You can also add variables without leaving the dashboard using the content outline.

To access the variables addition flow, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Content outline** icon to open it.
1. Click **Variables** in the outline.
1. Click **+ Add variable**.
1. Complete the rest of the steps to [add a variable without leaving the dashboard](#add-variables).

## Copy a dashboard

To make a copy of a dashboard, follow these steps:

1. Click **Dashboards** in the main menu.
1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Save** drop-down list and select **Save as copy**.
1. (Optional) Specify the name, folder, description, and whether or not to copy the original dashboard tags for the copied dashboard.

   By default, the copied dashboard has the same name as the original dashboard with the word "Copy" appended and is in the same folder.

1. Click **Save**.
