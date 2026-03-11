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
description: Create and edit a dashboard
weight: 200
---

# Dashboard controls

Using the **Dashboard controls** section of the edit pane, you can add variables, annotation queries, and dashboard links without leaving the dashboard.

## Add variables

To add a variable, follow these steps:

<!-- vale Grafana.Spelling = NO -->

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click **+ Add variable** at the top of the dashboard or click the **Add new element** icon (blue plus sign) and select **Variable**.
1. Choose a variable type from the list.
1. Enter a **Name** for the variable. <!-- from Variables docs, maybe make a shared file -->
1. (Optional) In the **Label** field, enter the display name for the variable drop-down list.

   If you don't enter a display name, then the drop-down list label is the variable name.

1. Choose a **Display** option:
   - **Above dashboard** - The variable drop-down list displays above the dashboard with the variable **Name** or **Label** value. This is the default.
   - **Above dashboard, label hidden** - The variable drop-down list displays above the dashboard, but without showing the name of the variable.
   - **Controls menu** - The variable is displayed in the dashboard controls menu instead of above the dashboard. The dashboard controls menu appears as a button in the dashboard toolbar.
   - **Hidden** - No variable drop-down list is displayed on the dashboard. <!-- end of shared content -->

1. Complete the variable configuration. For more detailed configuration information, click the one of the following links to complete the steps for adding your selected variable type:

   - [Query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-query-variable)
   - [Custom](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-custom-variable)
   - [Textbox](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-text-box-variable)
   - [Constant](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-constant-variable)
   - [Data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-data-source-variable)
   - [Interval](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-an-interval-variable)
   - [Ad hoc filters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-ad-hoc-filters)
   - [Switch](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/#add-a-switch-variable)

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

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

{{< shared-snippet path="/docs/grafana/latest/visualizations/dashboards/build-dashboards/annotate-visualizations/index.md" id="add-annotation-query" >}}

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

## Add dashboard links

For more detailed information on dashboard links, refer to the full [Dashboard links documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/manage-dashboard-links/).

### Add links to dashboards

To add a link to another dashboard at the top of your current dashboard, follow these steps:

{{< docs/list >}}

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Add new element** icon (blue plus sign).
1. Click **Dashboard link**.

   The default link type is **Dashboards**.

{{< shared-snippet path="/docs/grafana/latest/visualizations/dashboards/build-dashboards/manage-dashboard-links/index.md" id="add-dashboard-link" >}}

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
1. Click **Dashboard link**.

{{< shared-snippet path="/docs/grafana/latest/visualizations/dashboards/build-dashboards/manage-dashboard-links/index.md" id="url-dashboard-link" >}}

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

{{< /docs/list >}}

## Add filters
