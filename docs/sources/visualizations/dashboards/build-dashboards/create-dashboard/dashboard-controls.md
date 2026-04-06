---
aliases:
keywords:
  - panel
  - dashboard
  - create
  - dynamic dashboard
  - filters and group-by
  - filters and groupings
  - annotations
  - variables
  - dashboard links
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

In the **Dashboard controls** section of the sidebar, you can add filters and groupings, variables, annotation queries, and dashboard links without leaving the dashboard.

<!-- screenshot here? -->

## Add filters and groupings

To add a filter or grouping, follow these steps:

{{< docs/list >}}

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Add new element** icon (blue plus sign) and select **Filters and Group by**.

<!-- shared snippet here -->

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

{{< /docs/list >}}

<!-- vale Grafana.Spelling = NO -->

{{< admonition type="note" >}}
In the dashboard schema, the **Filter and Group by** control is still referred to as `"kind": "AdhocVariable"`.
{{< /admonition >}}

<!-- vale Grafana.Spelling = YES -->

## Add variables

To add a variable, follow these steps:

<!-- vale Grafana.Spelling = NO -->

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

<!-- vale Grafana.Spelling = YES -->

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
The sidebar includes collapsible sections for variables, annotations, and links, including hidden controls that aren't otherwise visible on the dashboard. The **Variables** section includes filters and groupings:

<!-- screenshot here -->

To manage dashboard controls, follow these steps:

1. Click the **Dashboard options** icon in the sidebar.
1. In the sidebar, expand the appropriate collapsible section.
1. Do one or more of the following:

   - **Edit**: Click **Select** on the control to open the sidebar so you can make updates.
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
