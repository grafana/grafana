---
aliases:
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
title: Dashboard controls
description: Add and manage a dashboard controls
weight: 200
---

# Dashboard controls

In the **Dashboard controls** section of the sidebar in add mode, you can add filters and group by keys, variables, annotation queries, and dashboard links without leaving the dashboard.

## Add filters and group by

<!-- vale Grafana.Spelling = NO -->

{{< admonition type="note" >}}
Filter and group by is currently in public preview.
Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

This feature replaces ad hoc filters, and extends them by adding grouping for Prometheus and Loki data sources.
However, in the dashboard schema, it is still referred to as `"kind": "AdhocVariable"`.

To use this feature, enable the `dashboardUnifiedDrilldownControls` feature toggle in your Grafana configuration file.
{{< /admonition >}}

<!-- vale Grafana.Spelling = YES -->

To add a filter and group by, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Add new element** icon (blue plus sign).
. Click **Filter and Group by**.
1. Enter a **Name** for the filter.
1. (Optional) In the **Label** field, enter the display name for the filter drop-down list.

   If you don't enter a display name, then the drop-down list label is the filter name.

1. (Optional) In the **Description** field, enter a description of the filter. The description appears as an info icon tooltip next to the filter name on the dashboard.

   Descriptions support links. You can use Markdown-style links (`[link text](https://example.com)`) or paste bare URLs (`https://example.com`). Only `http` and `https` URLs are rendered as clickable links—other protocols are displayed as plain text.

1. Choose a **Display** option:
   - **Above dashboard** - The filter drop-down list displays above the dashboard with the filter **Name** or **Label** value. This is the default.
   - **Above dashboard, label hidden** - The filter drop-down list displays above the dashboard, but without showing the name of the filter.
   - **Controls menu** - The filter is displayed in the dashboard controls menu instead of above the dashboard. The dashboard controls menu appears as a button in the dashboard toolbar.
   - **Hidden** - No filter drop-down list is displayed on the dashboard.

1. Under the **Filter options** section of the page, set the following options:

   | Option | Description |
   | ------ | ----------- |
   | Data source | Select a target data source in the drop-down list. You can also click **Open advanced data source picker** to see more options, including adding a data source (Admins only). For more information about data sources, refer to [Add a data source](ref:add-a-data-source). |
   | Default filters | Set a default key/value pair. Optional. In the dashboard filter control, the default value is indicated with an information icon. |
   | Enable group by | This option only appears if you selected a Prometheus or Loki data source. Toggle the switch on to enable data grouping. |
   | Default group by | Set a default key for the dashboard. Optional. In the dashboard filter control, the default value is indicated with an information icon. |
   | Use static key dimensions | To provide the filter dimensions as comma-separated values (CSV), toggle the switch on, and then enter the values in the space provided. Optional. |
   | Allow custom values | Toggle the switch on to allow dashboard users to add custom values to the filter and group by lists. Optional. |

1. Click **Save**.
1. Enter an optional description of your dashboard changes, and then click **Save**.
1. Click **Exit edit**.

{{< shared-snippet path="/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/index.md" id="filter-management" >}}

{{< shared-snippet path="/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/index.md" id="panel-filter" >}}

## Add variables

To add a variable, follow these steps:

{{< docs/list >}}

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click **+ Add variable** at the top of the dashboard or click the **Add new element** icon (blue plus sign) and select **Variable**.
1. Choose a variable type from the list.

{{< shared-snippet path="/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/index.md" id="add-variable" >}}

1. Complete the variable configuration. For more detailed configuration information, click the one of the following links to complete the steps for adding your selected variable type:

{{< column-list >}}

- [Query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-query-variable)
- [Custom](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-custom-variable)
- [Textbox](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-text-box-variable)
- [Constant](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-constant-variable)
- [Data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-data-source-variable)
- [Interval](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-an-interval-variable)
- [Switch](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-switch-variable)

{{< /column-list >}}

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

{{< /docs/list >}}

For more detailed information on variables, refer to the full [Variables documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/).

## Add annotation queries

To add an annotation query, follow these steps:

{{< docs/list >}}

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Add new element** icon (blue plus sign).
1. Click **Annotation query**.
1. Enter a name for the annotation query.

   This name is given to the toggle that allows you to enable/disable showing annotation events from this query.

{{< shared-snippet path="/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/annotate-visualizations/index.md" id="add-annotation-query" >}}

1. To add a query, do one of the following:
   - Click **Open query editor** to open **Annotation Query** dialog box and write or construct a query. The annotation query options are different for each data source. For information about annotations in a specific data source, refer to the specific [data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/) topic.
   - Click **Use saved query** to open a the **Saved queries** drawer and select a [saved query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries).

   {{< admonition type="note" >}}
   [Saved queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries) is currently in [public preview](https://grafana.com/docs/release-life-cycle/) in Grafana Enterprise and Grafana Cloud only.
   {{< /admonition >}}

1. (Optional) Click **Test annotation query** to ensure that the query is working properly.
1. Click **Close** when you've completed the query setup.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

{{< /docs/list >}}

For more detailed information about annotations, refer to the full [Annotations documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/annotate-visualizations/).

## Add links

For more detailed information on dashboard links, refer to the full [Dashboard links documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/manage-dashboard-links/).

### Add links to dashboards

To add a link to another dashboard at the top of your current dashboard, follow these steps:

{{< docs/list >}}

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Add new element** icon (blue plus sign).
1. Click **Link**.

{{< shared-snippet path="/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/manage-dashboard-links/index.md" id="add-dashboard-link" >}}

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

{{< /docs/list >}}

### Add a URL link to a dashboard

Add a link to a URL at the top of your current dashboard.
You can link to any available URL, including dashboards, panels, or external sites.
You can even control the time range to ensure the user is zoomed in on the right data in Grafana.

To add a URL link to your dashboard, follow these steps:

{{< docs/list >}}

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Add new element** icon (blue plus sign).
1. Click **Link**.

{{< shared-snippet path="/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/manage-dashboard-links/index.md" id="url-dashboard-link" >}}

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

{{< /docs/list >}}

## Manage dashboard controls

After you add dashboard controls, you can manage them from the dashboard options.
In this view, the sidebar includes collapsible sections for variables (including filter and group by), annotations, and links, including hidden controls that aren't otherwise visible on the dashboard:

{{< figure src="../screenshot-dashboard-controls-mgmt-2-v13.0.png" alt="Dashboard controls in the Dashboard options sidebar view" max-width="500px" >}}

To manage dashboard controls, follow these steps:

1. Click the **Dashboard options** icon in the sidebar.
1. In the sidebar, expand the appropriate collapsible section.
1. Do one or more of the following:
   - **Edit**: Click **Select** on the control to open it in the sidebar so you can make updates.
   - **Reorder**: Drag and drop controls to reorder them.
   - **Change display**: Drag and drop controls between sub-sections **Above dashboard**, **Controls menu**, and **Hidden** to update the control display option. Note that links can't be hidden.

   {{< admonition type="tip" >}}
   To get back to controls management from configuration, click the **Dashboard options** icon.
   {{< /admonition >}}

1. Make any other changes as needed.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.
