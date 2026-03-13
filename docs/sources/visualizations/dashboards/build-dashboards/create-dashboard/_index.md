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
image_maps:
  - key: sidebar-toolbar
    src: /media/docs/grafana/dashboards/screenshot-edit-sidebar-v12.4.png
    alt: An annotated image of the sidebar and toolbar
    points:
      - x_coord: 96
        y_coord: 17
        content: |
          **Dashboard options**

          Click the icon to open the side bar. Edit mode only.
      - x_coord: 96
        y_coord: 25
        content: |
          **Feedback**

          Submit feedback on the new editing experience. Edit mode only.
      - x_coord: 96
        y_coord: 33
        content: |
          **Export**

          Click to display [export](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/share-dashboards-panels/#export-dashboards) options.
      - x_coord: 96
        y_coord: 41
        content: |
          **Content outline**

          Navigate a dashboard using the [Content outline](#navigate-using-the-content-outline).
      - x_coord: 96
        y_coord: 49
        content: |
          **Dashboard insights**

          View [dashboard analytics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/assess-dashboard-usage/) including information about users, activity, and query counts.
---

# Create dashboards

Dashboards and panels allow you to show your data in visual form.
Each panel needs at least one query to display a visualization.

**Before you begin:**

- Ensure that you have the proper permissions. For more information about permissions, refer to [About users and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/).
- Understand the query language of the target data source.

## Create a dashboard

To create a dashboard, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click **New** and select **New Dashboard**.
1. Click the **Add new element** icon (blue plus sign) and click or drag a panel onto the dashboard.

   {{< figure src="/media/docs/grafana/dashboards/screenshot-add-panel-v12.4.png" max-width="750px" alt="New dashboard" >}}

1. On the new panel, click **Configure**.

   The **Edit panel** view opens with the default data source for your instance preselected.

1. If you want to change the panel data source, in the **Queries** tab, click the **Data source** drop-down list and do one of the following:
   - Select one of your existing data sources.
   - Click **Open advanced data source picker** to select one of the Grafana [built-in special data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#special-data-sources) or to configure a new data source (Admins only).

   For more information about data sources, refer to [Data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/) for specific guidelines.

1. To create a query, do one of the following:
   - Write or construct a query in the query language of your data source.
   - Open the **Saved queries** drop-down menu and click **Replace query** to reuse a [saved query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries).

1. (Optional) To [save the query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#save-a-query) for reuse, open the **Saved queries** drop-down menu and click the **Save query** option.

   {{< admonition type="note" >}}
   [Saved queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries) is currently in [public preview](https://grafana.com/docs/release-life-cycle/) in Grafana Enterprise and Grafana Cloud only.
   {{< /admonition >}}

1. Click **Refresh** to query the data source.
1. Select a suggested visualization or click **All visualizations** and select one from the full list.

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-viz-suggestion-v13.0.png" max-width="350px" alt="Visualization selector" >}}

   Grafana displays a preview of your query results with the visualization applied.

   For more information about configuring individual visualizations, refer to [Visualizations options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/visualizations/).

1. Click **Refresh** to query the data source.
1. Under **Panel options**, enter a title and description for the panel or have Grafana create them using [generative AI features](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards).
1. Refer to the following documentation for ways you can adjust panel settings.

   While not required, most visualizations need some adjustment before they properly display the information that you need.
   - [Configure value mappings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-value-mappings/)
   - [Visualization-specific options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/visualizations/)
   - [Override field values](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-overrides/)
   - [Configure thresholds](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-thresholds/)
   - [Configure standard options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-standard-options/)

1. When you've finished editing the panel, click **Save**.
1. Enter a title and description for the dashboard if you haven't already or have Grafana create them using [generative AI features](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards).
1. Select a folder, if applicable.
1. Click **Save**
1. Click **Back to dashboard**.
1. (Optional) Continue building the dashboard by doing one or more of the following:

   - Select the panel you just created and click **Configure** in the sidebar to continue panel setup.
   - Click the **Add new element** icon and select **Panel**. You can also hover your mouse on the dashboard to display the **Add panel** button. This is helpful if you want to ensure that you add a new panel within a grouping.
   - Click the **Add new element** icon and select [Variable](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/dashboard-controls/#add-variables), [Annotation query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/dashboard-controls/#add-annotation-queries), or [Links](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/dashboard-controls/#add-dashboard-links).
   - Click **Group panels** on the dashboard and choose from **Group into row** or **Group into tab**. For more information on groupings, refer to [Panel groupings](#panel-groupings).
   - Click the **Dashboard options** icon to open the sidebar and access [panel layout options](#panel-layouts).

1. When you've finished making changes, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## Dashboard edit

Now that you've created a basic dashboard, you can augment it with more options.
You can make several updates without leaving the dashboard by using the sidebar, which is explained in the next section.

### The sidebar and toolbar

The _sidebar_ allows you to make changes without leaving the dashboard, by displaying options associated with the part of the dashboard that's in focus.
The _toolbar_ is next to the sidebar, and it includes options that are useful to have available all the time.

The following image shows the parts of the sidebar and the toolbar.
Hover your cursor over the numbers to display descriptions of the toolbar options (descriptions also follow the image):

{{< image-map key="sidebar-toolbar" >}}

{{< admonition type="note" >}}
The toolbar is displayed in both edit and view mode, but the **Dashboard options** and **Feedback** icons aren't available in view mode.
{{< /admonition >}}

When the dashboard is in edit mode, you can dock and undock.
The following table describes how the sidebar behaves when docked or undocked:

| Undocked | Docked |
| --------- | ---------|
| The sidebar opens when you click a dashboard element, and closes if no element is selected | Sidebar stays open regardless of where you click |
| Panels can be hidden by the sidebar | Panels resize to the space left available by the sidebar |
| Dashboard options are only displayed in the sidebar when you click the **Dashboard options** icon | Dashboard options are displayed in the sidebar when you click the dashboard canvas |

When you dock the sidebar, even if you close it, it remains docked the next time you open it.
This choice persists when you change it.

{{< video-embed src="/media/docs/grafana/dashboards/screenrecord-edit-side-v12.4.mp4" >}}

You can also resize the sidebar and toolbar.
You can only resize the toolbar when the sidebar is closed, however, you can do so in view or edit mode.
Your resizing changes persist until you change them.

The available configuration options in the sidebar differ depending on the selected dashboard element:

- Dashboards: High-level options are in the sidebar and further configuration options are in the **Settings** page.
- Groupings (rows and tabs): All configuration options are available in the sidebar.
- Panels: High-level options are in the sidebar and further configuration options are in the **Edit panel** view.

### Navigate using the content outline

The **Content outline** provides a tree-like structure that shows you all the parts of the dashboard and their relationships to each other, including panels, rows, tabs, and variables.
The outline also lets you quickly navigate the dashboard and is available in both view and edit modes (note that variables are only included in edit mode).

{{< figure src="/media/docs/grafana/dashboards/screenshot-content-outline-v12.4.png" max-width="750px" alt="Dashboard with outline open" >}}

To navigate the dashboard using the outline, follow these steps:

1. Navigate to the dashboard you want to view or update.
1. In the right toolbar, click the **Content outline** icon to open it.
1. Expand the outline to find the part of the dashboard you want to view or update.
1. Click the tree item to navigate that part of the dashboard.

### Edit a dashboard

To edit a dashboard, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the part of the dashboard you want to update to open the sidebar, or click the **Dashboard options** icon to open it.

   If the dashboard is large, open the **Content outline** and use it to navigate to the part of the dashboard you want to update.

1. Do one of the following:
   - Update an existing dashboard element
   - Click the **Add new element** icon in the toolbar.

1. Change the dashboard as needed.
1. When you've finished making changes, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Back to dashboard**, if needed.
1. Click **Exit edit**

## Panel layouts

<!---should this be called dashboard layouts-->

Panel layouts control the size and arrangement of panels in the dashboard.
There are two panel layout options:

- **Custom**: You can position and size panels individually. This is the default selection for a new dashboard. **Show/hide rules** are not supported.
- **Auto grid**: Panels resize and fit automatically to create a uniform grid. You can't make manual changes to this layout. **Show/hide rules** are supported.

You can use both layouts in row or tab groupings.

### Auto grid layout

In the auto grid layout, panels are automatically sized and positioned as you add them.
There are default parameters to constrain the layout, and you can update these to have more control over the display:

- **Min column width**: Choose from **Standard**, **Narrow**, **Wide**, or **Custom**, for which you can enter the minimum width in pixels.
- **Max columns**: Set a number up to 10.
- **Row height**: Choose from **Standard**, **Short**, **Tall**, and **Custom**, for which you can enter the row height in pixels.
- **Fill screen**: Toggle the switch on to have the panel fill the entire height of the screen. If the panel is in a row, the **Fill screen** toggle for the row must also be enabled (refer to [grouping configuration options](#grouping-configuration-options)).

### Update panel layout

To update the panel layout, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the dashboard or the grouping that contains the panel layout you want to update.
1. Click the **Dashboard options** icon to open the sidebar, if needed.
1. Under **Layout**, select **Custom** or **Auto grid**.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**

## Configure repeat options

You can configure Grafana to dynamically add panels, rows, or tabs to a dashboard based on the value of a variable.
Variables dynamically change your queries across all panels, rows, or tabs in a dashboard.

This only applies to queries that include a multi-value variable.

To configure repeats, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the panel, row, or tab you want to update to open the sidebar, or click the **Dashboard options** icon to open it.

   If the dashboard is large, open the **Content outline** and use it to navigate to the part of the dashboard you want to update.

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

If a row includes panels using the special [Dashboard data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#special-data-sources)&mdash;the data source that uses a result set from another panel in the same dashboard&mdash;then corresponding panels in repeated rows will reference the panel in the original row, not the ones in the repeated rows.
The same behavior applies to tabs.

For example, in a dashboard:

- `Row 1` includes `Panel 1A` and `Panel 1B`
- `Panel 1B` uses the results from `Panel 1A` by way of the `-- Dashboard --` data source
- Repeating row, `Row 2`, includes `Panel 2A` and `Panel 2B`
- `Panel 2B` references `Panel 1A`, not `Panel 2A`

## Show/hide rules

You can configure panels, rows, and tabs to be shown or hidden based on rules.
For example, you can set a panel to be hidden if there's no data returned by a query or a tab to only be shown if a specific variable value is present.

There are three types of show/hide rules to choose from:

- [Query result](#query-result-rule)
- [Template variable](#template-variable-rule)
- [Time range less than](#time-range-less-than-rule)

For steps on how to create show/hide rules, refer to [Configure show/hide rules](#configure-showhide-rules).

{{< admonition type="note" >}}
You can only configure show/hide rules for panels in the **Auto grid** layout. Set the panel layout at the dashboard, row, or tab-level.
{{< /admonition >}}

### Query result rule

Show or hide a panel based on whether or not the query returns any results.
The rule provides **Has data** and **No data** options, so you can choose to show or hide the panel based on the presence or absence of data.

For example, if you have a dashboard with several panels and only want panels that return data to appear, set the rule as follows:

- Panel visibility > Show
- Query result > Has data

Alternatively, you might also want to troubleshoot a dashboard with several panels to see which ones contain broken queries that aren't returning any results.
In this case, you'd set the rule as follows:

- Panel visibility > Show
- Query result > No data

### Template variable rule

Show or hide a panel, row, or tab dynamically based on the variable value.
You can select any variable that's configured for the dashboard and choose from the following operators for maximum flexibility:

- Equals
- Not equals
- Matches (regular expression values)
- Not matches (regular expression values)

You can [add more variables](#add-variables) if you need to without leaving the dashboard.

### Time range less than rule

Show or hide a panel, row, or tab if the dashboard time range is shorter than the selected time range.
This ensures that as you change the time range of the dashboard, you only see data relevant to that time period.

For example, a dashboard is tracking adoption of a feature over time has the following setup:

- Dashboard time range is **Last 7 days**
- One panel tracks weekly stats
- One panel tracks daily stats

For the panel tracking weekly stats, a rule is set up to hide it if the dashboard time range is less than 7 days.
For the panel tracking daily stats, a rule is set up to hide it if the dashboard time range is less 24 hours.
This configuration ensures that these time-based panels are only displayed when enough time has passed to make them relevant.

For this rule type, you can select time ranges from **5 minutes** to **5 years**.

### Configure show/hide rules

To configure show/hide rules, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the panel, row, or tab you want to update to open the sidebar, or click the **Dashboard options** icon to open it.

   If the dashboard is large, open the **Content outline** and use it to navigate to the part of the dashboard you want to update.

1. Expand the **Show / hide rules** section.
1. Select **Show** or **Hide** to set whether the panel, row, or tab is shown or hidden based on the rules outcome.
1. Click **+ Add rule**.
1. Select a rule type:
   - **Query result**: Show or hide a panel based on query results. Choose from **Has data** and **No data**.
   - **Template variable**: Show or hide the panel, row, or tab dynamically based on the variable value. Select a variable and operator and enter a value.
   - **Time range less than**: Show or hide the panel, row, or tab if the dashboard time range is shorter than the selected time range. Select a time range from **5 minutes** to **5 years**.

1. If you've configured more than rule, under **Match rules**, select one of the following:
   - **Match all**: The panel, row, or tab is shown or hidden only if _all_ the rules are matched.
   - **Match any**: The panel, row, or tab is shown or hidden if _any_ of the rules are matched.

   This option is only displayed if you add multiple rules.

1. When you've finished setting rules, click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**

Hidden panels, rows, or tabs aren't visible when the dashboard is in view mode.
In edit mode, hidden dashboard elements are displayed with an icon or overlay indicating this.

## Move a panel

To move a panel, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Navigate to the panel you want to move.

   If the dashboard is large, open the **Content outline** and use it to navigate to the panel.

1. Click the panel title and drag the panel to another row or tab, or to a new position on the dashboard.

   If the dashboard has groupings, you can only move the panel to another grouping.

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**

## Resize a panel

When your dashboard or grouping has a **Custom** layout, you can manually resize a panel.

To resize a panel, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Navigate to the panel you want to resize.

   If the dashboard is large, open the **Content outline** and use it to navigate to the panel.

1. Click and drag the lower-right corner of the panel to change the size of the panel.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## Copy or duplicate dashboard elements

You can copy and paste or duplicate the following dashboard elements:

- Panels
- Rows
- Tabs

To copy or duplicate dashboard elements, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the panel, row, or tab you want to update to open the sidebar, or click the **Dashboard options** icon to open it.

   If the dashboard is large, open the **Content outline** and use it to navigate to the part of the dashboard you want to update.

1. In the top-corner of the sidebar, click the **Copy or Duplicate** icon and do one of the following:
   - Click **Copy**.
   - Click **Duplicate**. The duplicated element is added next to the original one. Proceed to step 6.

1. If you selected **Copy**, navigate to the part of the dashboard where you want to add the copied element, and click **Paste panel**, **Paste row**, or **Paste tab**.
1. Update the copied or duplicated element if needed.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**

## Copy a dashboard

To make a copy of a dashboard, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Save** drop-down list and select **Save as copy**.
1. (Optional) Specify the name, folder, description, and whether or not to copy the original dashboard tags for the copied dashboard.

   By default, the copied dashboard has the same name as the original dashboard with the word "Copy" appended and is in the same folder.

1. Click **Save**.
