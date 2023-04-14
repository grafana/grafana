---
aliases:
  - ../features/dashboard/dashboards/
  - ../panels/working-with-panels/organize-dashboard/
  - ../reference/dashboard_folders/
  - ../reference/export_import/
  - ../reference/timerange/
  - ../troubleshooting/troubleshoot-dashboards/
  - dashboard-folders/
  - dashboard-manage/
  - export-import/
keywords:
  - grafana
  - dashboard
  - dashboard folders
  - folder
  - folders
  - import
  - export
  - troubleshoot
  - time range
  - scripting
menuTitle: Manage dashboards
title: Manage dashboards
weight: 8
---

# Manage dashboards

A dashboard is a set of one or more [panels]({{< relref "../../panels-visualizations/" >}}) that visually presents your data in one or more rows.

For more information about creating dashboards, refer to [Add and organize panels](../add-organize-panels).

This topic includes techniques you can use to manage your Grafana dashboards, including:

- [Creating and managing dashboard folders](#create-and-manage-dashboard-folders)
- [Exporting and importing dashboards](#export-and-import-dashboards)
- [Organizing dashboards](#organize-a-dashboard)
- [Troubleshooting dashboards](#troubleshoot-dashboards)

## Create a dashboard folder

Folders help you organize and group dashboards, which is useful when you have many dashboards or multiple teams using the same Grafana instance.

**Before you begin:**

- Ensure that you have Grafana Admin or Super Admin permissions. For more information about dashboard permissions, refer to [Dashboard permissions]({{< relref "../../administration/roles-and-permissions/#dashboard-permissions" >}}).

**To create a dashboard folder:**

1. Sign in to Grafana.
1. Click **Dashboards** in the left-side menu.
1. On the Dashboards page, click **New** and select **New folder** in the dropdown.
1. Enter a unique name and click **Create**.

When you save a dashboard, you can either select a folder for the dashboard to be saved in or create a new folder.

## Manage dashboards

On the Dashboards page, you can:

- create a folder
- create a dashboard
- move dashboards into folders
- delete multiple dashboards
- navigate to a folder page where you can assign folder and dashboard permissions

### Dashboard folder page

You can complete the following tasks on a dashboard folder page:

- Move or delete dashboards in a folder
- Rename a folder (available on the Settings tab)
- Assign permissions to folders (which are inherited by the dashboards in the folder)

To navigate to the dashboard folder page, hover over the name of the folder and click **Go to folder** in the dashboard search result list or on the Dashboards page.

### Dashboard permissions

You can assign permissions to a folder. Any permissions you assign are inherited by the dashboards in the folder. An Access Control List (ACL) is used where **Organization Role**, **Team**, and a **User** can be assigned permissions.

For more information about dashboard permissions, refer to [Dashboard permissions]({{< relref "../../administration/roles-and-permissions/#dashboard-permissions" >}}).

## Export and import dashboards

You can use the Grafana UI or the [HTTP API]({{< relref "../../developers/http_api/dashboard/#create-update-dashboard" >}}) to export and import dashboards.

### Export a dashboard

The dashboard export action creates a Grafana JSON file that contains everything you need, including layout, variables, styles, data sources, queries, and so on, so that you can later import the dashboard.

1. Click **Dashboards** in the left-side menu.
1. Open the dashboard you want to export.
1. Click the **Share** icon.
1. Click **Export**.
1. Click **Save to file**.

Grafana downloads a JSON file to your local machine.

#### Make a dashboard portable

If you want to export a dashboard for others to use, you can add template variables for things like a metric prefix (use a constant variable) and server name.

A template variable of the type `Constant` will automatically be hidden in the dashboard, and will also be added as a required input when the dashboard is imported.

### Import a dashboard

1. Click **Dashboards** in the left-side menu.
1. Click **New** and select **Import** in the dropdown menu.
1. Perform one of the following steps:

   - Upload a dashboard JSON file
   - Paste a [Grafana.com](https://grafana.com) dashboard URL
   - Paste dashboard JSON text directly into the text area

<!--{{< figure src="/static/img/docs/v70/import_step2_grafana.com.png"  max-width="700px" >}}
-->

The import process enables you to change the name of the dashboard, pick the data source you want the dashboard to use, and specify any metric prefixes (if the dashboard uses any).

### Discover dashboards on Grafana.com

Find dashboards for common server applications at [Grafana.com/dashboards](https://grafana.com/dashboards).

{{< figure src="/media/docs/grafana/dashboards/screenshot-gcom-dashboards.png" >}}

## Troubleshoot dashboards

This section provides information to help you solve common dashboard problems.

### Dashboard is slow

- Are you trying to render dozens (or hundreds or thousands) of time-series on a graph? This can cause the browser to lag. Try using functions like `highestMax` (in Graphite) to reduce the returned series.
- Sometimes the series names can be very large. This causes larger response sizes. Try using `alias` to reduce the size of the returned series names.
- Are you querying many time-series or for a long range of time? Both of these conditions can cause Grafana or your data source to pull in a lot of data, which may slow it down.
- It could be high load on your network infrastructure. If the slowness isn't consistent, this may be the problem.

### Dashboard refresh rate issues

By default, Grafana queries your data source every 30 seconds. Setting a low refresh rate on your dashboards puts unnecessary stress on the backend. In many cases, querying this frequently isn't necessary because the data isn't being sent to the system such that changes would be seen.

We recommend the following:

- Do not enable auto-refreshing on dashboards, panels, or variables unless you need it. Users can refresh their browser manually, or you can set the refresh rate for a time period that makes sense (every ten minutes, every hour, and so on).
- If it is required, then set the refresh rate to once a minute. Users can always refresh the dashboard manually.
- If your dashboard has a longer time period (such as a week), then you really don't need automated refreshing.

#### Handling or rendering null data is wrong or confusing

Some applications publish data intermittently; for example, they only post a metric when an event occurs. By default, Grafana graphs connect lines between the data points. This can be very deceiving.

In the picture below we have enabled:

- Points and 3-point radius to highlight where data points are actually present.
- **Connect null values\* is set to **Always\*\*.

{{< figure src="/static/img/docs/troubleshooting/grafana_null_connected.png" max-width="1200px" >}}

In this graph, we set graph to show bars instead of lines and set the **No value** under **Standard options** to **0**. There is a very big difference in the visuals.

{{< figure src="/static/img/docs/troubleshooting/grafana_null_zero.png" max-width="1200px" >}}

### More examples

You can find more examples in `public/dashboards/` directory of your Grafana installation.
