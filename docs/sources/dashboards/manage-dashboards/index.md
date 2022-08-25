---
aliases:
  - /docs/grafana/latest/dashboards/dashboard-manage/
  - /docs/grafana/latest/features/dashboard/dashboards/
  - /docs/grafana/latest/dashboards/dashboard-folders/
  - /docs/grafana/latest/reference/dashboard_folders/
  - /docs/grafana/latest/dashboards/export-import/
  - /docs/grafana/latest/reference/export_import/
  - /docs/grafana/latest/troubleshooting/troubleshoot-dashboards/
  - /docs/grafana/latest/dashboards/time-range-controls/
  - /docs/grafana/latest/reference/timerange/
  - /docs/grafana/latest/panels/working-with-panels/organize-dashboard/
  - /docs/grafana/latest/dashboards/manage-dashboards/
title: Manage dashboards
menuTitle: Manage dashboards
weight: 8
eywords:
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
---

# Manage dashboards

A dashboard is a set of one or more [panels]({{< relref "../../panels/" >}}) that visually presents your data in one or more rows.

For more information about creating dashboards, refer to [Add and organize panels](../add-organize-panels).

This topic includes techniques you can use to manage your Grafana dashboards, including:

- [Creating and managing dashboard folders](#create-and-manage-dashboard-folders)
- [Exporting and importing dashboards](#export-and-import-dashboards)
- [Configuring dashboard time range controls](#configure-dashboard-time-range-controls)
- [Organizing dashboards](#organize-a-dashboard)
- [Troubleshooting dashboards](#troubleshoot-dashboards)

## Create a dashboard folder

Folders help you organize and group dashboards, which is useful when you have many dashboards or multiple teams using the same Grafana instance.

**Before you begin:**

- Ensure that you have Grafana Admin or Super Admin permissions. For more information about dashboard permissions, refer to [Dashboard permissions]({{< relref "../../administration/roles-and-permissions/#dashboard-permissions" >}}).

**To create a dashboard folder:**

1. Sign in to Grafana and on the side menu, click **Dashboards > New folder**.
1. Enter a unique name and click **Create**.

When you save a dashboard, you can either select a folder for the dashboard to be saved in or create a new folder.

## Manage dashboards

{{< figure src="/static/img/docs/v50/manage_dashboard_menu.png" max-width="300px" class="docs-image--right" >}}

On the **Manage dashboards and folders** page, you can:

- create a folder
- create a dashboard
- move dashboards into folders
- delete multiple dashboards
- navigate to a folder page where you can assign folder and dashboard permissions

### Dashboard folder page

You can complete the following tasks on the **Dashboard Folder** page:

- Move or delete dashboards in a folder
- Rename a folder (available under the **Settings** tab)
- Assign permissions to folders (which are inherited by the dashboards in the folder)

To navigate to the dashboard folder page, click the cog appears when you hover over a folder in the dashboard search result list or the **Manage dashboards and folders** page.

### Dashboard permissions

You can assign permissions to a folder. Any permissions you assign are inherited by the dashboards in the folder. An Access Control List (ACL) is used where **Organization Role**, **Team** and a **User** can be assigned permissions.

For more information about dashboard permissions, refer to [Dashboard permissions]({{< relref "../../administration/roles-and-permissions/#dashboard-permissions" >}}).

## Export and import dashboards

You can use the Grafana UI or the [HTTP API]({{< relref "../../developers/http_api/dashboard/#create-update-dashboard" >}}) to export and import dashboards.

### Export a dashboard

The dashboard export action creates a Grafana JSON file that contains everything you need, including layout, variables, styles, data sources, queries, and so on, so that you can later import the dashboard.

1. Open the dashboard you want to export.
2. Click the **Share** icon.
3. Click **Export**.
4. Click **Save to file**.

Grafana downloads a JSON file to your local machine.

{{< figure src="/static/img/docs/export/export-modal.png" max-width="800px" >}}

#### Make a dashboard portable

If you want to export a dashboard for others to use, you can add template variables for things like a metric prefix (use a constant variable) and server name.

A template variable of the type `Constant` will automatically be hidden in the dashboard, and will also be added as a required input when the dashboard is imported.

### Import a dashboard

1. Click **Dashboards > Import** in the side menu.

   {{< figure src="/static/img/docs/v70/import_step1.png" max-width="700px" >}}

1. Perform one of the following steps:

   - Upload a dashboard JSON file
   - Paste a [Grafana.com](https://grafana.com) dashboard URL
   - Paste dashboard JSON text directly into the text area

{{< figure src="/static/img/docs/v70/import_step2_grafana.com.png"  max-width="700px" >}}

The import process enables you to change the name of the dashboard, pick the data source you want the dashboard to use, and specify any metric prefixes (if the dashboard uses any).

### Discover dashboards on Grafana.com

Find dashboards for common server applications at [Grafana.com/dashboards](https://grafana.com/dashboards).

{{< figure src="/static/img/docs/v50/gcom_dashboard_list.png" max-width="700px" >}}

## Configure dashboard time range controls

Grafana provides several ways to manage the time ranges of the data being visualized, for dashboard, panels and also for alerting.

This section describes supported time units and relative ranges, the common time controls, dashboard-wide time settings, and panel-specific time settings.

### Time units and relative ranges

Grafana supports the following time units: `s (seconds)`, `m (minutes)`, `h (hours)`, `d (days)`, `w (weeks)`, `M (months)`, `Q (quarters)` and `y (years)`.

The minus operator enables you to step back in time, relative to now. If you want to display the full period of the unit (day, week, month, etc...), append `/<time unit>` to the end. To view fiscal periods, use `fQ (fiscal quarter)` and `fy (fiscal year)` time units.

The plus operator enables you to step forward in time, relative to now. For example, you can use this feature to look at predicted data in the future.

The following table provides example relative ranges:

| Example relative range | From:       | To:         |
| ---------------------- | ----------- | ----------- |
| Last 5 minutes         | `now-5m`    | `now`       |
| The day so far         | `now/d`     | `now`       |
| This week              | `now/w`     | `now/w`     |
| This week so far       | `now/w`     | `now`       |
| This month             | `now/M`     | `now/M`     |
| This month so far      | `now/M`     | `now`       |
| Previous Month         | `now-1M/M`  | `now-1M/M`  |
| This year so far       | `now/Y`     | `now`       |
| This Year              | `now/Y`     | `now/Y`     |
| Previous fiscal year   | `now-1y/fy` | `now-1y/fy` |

#### Note about Grafana Alerting

For Grafana Alerting, we do not support the following syntaxes at this time.

- now+n for future timestamps.
- now-1n/n for "start of n until end of n" because this is an absolute timestamp.

### Common time range controls

The dashboard and panel time controls have a common UI.

<img class="no-shadow" src="/static/img/docs/time-range-controls/common-time-controls-7-0.png" max-width="700px">

The following sections define common time range controls.

#### Current time range

The current time range, also called the _time picker_, shows the time range currently displayed in the dashboard or panel you are viewing.

Hover your cursor over the field to see the exact time stamps in the range and their source (such as the local browser).

<img class="no-shadow" src="/static/img/docs/time-range-controls/time-picker-7-0.png" max-width="300px">

Click the current time range to change it. You can change the current time using a _relative time range_, such as the last 15 minutes, or an _absolute time range_, such as `2020-05-14 00:00:00 to 2020-05-15 23:59:59`.

<img class="no-shadow" src="/static/img/docs/time-range-controls/change-current-time-range-7-0.png" max-width="900px">

#### Relative time range

Select the relative time range from the **Relative time ranges** list. You can filter the list using the input field at the top. Some examples of time ranges include:

- Last 30 minutes
- Last 12 hours
- Last 7 days
- Last 2 years
- Yesterday
- Day before yesterday
- This day last week
- Today so far
- This week so far
- This month so far

#### Absolute time range

You can set an absolute time range in the following ways:

- Type values into the **From** and **To** fields. You can type exact time values or relative values, such as `now-24h`, and then click **Apply time range**.
- Click in the **From** or **To** field. Grafana displays a calendar. Click the day or days you want to use as the current time range and then click **Apply time range**.

This section also displays recently used absolute ranges.

#### Zoom out (Cmd+Z or Ctrl+Z)

Click the **Zoom out** icon to view a larger time range in the dashboard or panel visualization.

#### Zoom in (only applicable to graph visualizations)

Click and drag to select the time range in the visualization that you want to view.

#### Refresh dashboard

Click the **Refresh dashboard** icon to immediately run every query on the dashboard and refresh the visualizations. Grafana cancels any pending requests when you trigger a refresh.

By default, Grafana does not automatically refresh the dashboard. Queries run on their own schedule according to the panel settings. However, if you want to regularly refresh the dashboard, then click the down arrow next to the **Refresh dashboard** icon and then select a refresh interval.

### Dashboard time settings

Time settings are saved on a per-dashboard basis.

You can change the **Timezone** and **fiscal year** settings from the time range controls by clicking the **Change time settings** button.

For more advanced time settings, click the **Dashboard settings** (gear) icon at the top of the page. Then navigate to the **Time Options** section of the **General** tab.

- **Timezone:** Specify the local time zone of the service or system that you are monitoring. This can be helpful when monitoring a system or service that operates across several time zones.
  - **Default:** The default selected time zone for the user profile, team, or organization is used. If no time zone is specified for the user profile, a team the user is a member of, or the organization, then Grafana uses local browser time.
  - **Local browser time:** The time zone configured for the viewing user browser is used. This is usually the same time zone as set on the computer.
  - Standard [ISO 8601 time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), including UTC.
- **Auto-refresh:** Customize the options displayed for relative time and the auto-refresh options. Entries are comma separated and accept any valid time unit.
- **Now delay:** Override the `now` time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.
- **Hide time picker:** Select this option if you do not want Grafana to display the time picker.

### Panel time overrides and timeshift

In [Query options]({{< relref "../../panels/query-options/" >}}), you can override the relative time range for individual panels, which causes them to be different than what is selected in the dashboard time picker located in the upper right. This enables you to show metrics from different time periods or days at the same time.

> **Note:** Panel time overrides have no effect when the time range for the dashboard is absolute.

### Control the time range using a URL

You can control the time range of a dashboard by providing the following query parameters in the dashboard URL:

- `from`: Defines the lower limit of the time range, specified in `ms`, `epoch`, or [relative time]({{< relref "#relative-time-range" >}})
- `to`: Defines the upper limit of the time range, specified in `ms`, `epoch`, or [relative time]({{< relref "#relative-time-range" >}})
- `time` and `time.window`: Defines a time range from `time-time.window/2` to `time+time.window/2`. Both parameters should be specified in `ms`. For example `?time=1500000000000&time.window=10000` results in 10s time range from 1499999995000 to 1500000005000

## Organize a dashboard

You can place any panel in any location you want and controls its size. The changes you make impact other users of the dashboard.

**Before you begin:**

- Ensure that you sign in to Grafana with Editor permissions

**To organize a dashboard**:

1. Hover your cursor over the panel, and click-and-drag the panel to its new location.

1. To resize a panel, click the zoom in (+) and zoom out (-) icons.

![](/static/img/docs/animated_gifs/drag_drop.gif)

### Tips and shortcuts

- Click the graph title and in the dropdown menu quickly duplicate the panel.
- Click the colored icon in the legend to change a series color or the y-axis.
- Click series name in the legend to hide series.
- Ctrl/Shift/Meta + click legend name to hide other series.
- Hover your cursor over a panel and press `e` to open the panel editor.
- Hover your cursor over a panel and press `v` to open the panel in full screen view.

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
