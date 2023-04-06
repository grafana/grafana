---
aliases:
  - ../features/dashboard/dashboards/
  - ../reference/search/
  - dashboard-ui/
  - dashboard-ui/dashboard-header/
  - dashboard-ui/dashboard-row/
  - search/
  - shortcuts/
  - time-range-controls/
keywords:
  - dashboard
  - search
  - shortcuts
menuTitle: Use dashboards
title: Use dashboards
weight: 1
---

# Use dashboards

This topic provides an overview of dashboard features and shortcuts, and describes how to use dashboard search.

## Dashboard feature overview

The dashboard user interface provides a number of features that you can use to customize the presentation of your data.

The following image and descriptions highlights all dashboards features.

{{< figure src="/static/img/docs/v91/dashboard-features/dashboard-features.png" width="700px" >}}

- (1) **Grafana home**: Click the Grafana home icon to be redirected to the home page configured in the Grafana instance.
- (2) **Dashboard title**: When you click the dashboard title you can search for dashboard contained in the current folder.
- (3) **Share dashboard or panel**: Use this option to share the current dashboard by link or snapshot. You can also export the dashboard definition from the share modal.
- (4) **Add a new panel**: Use this option to add a panel, dashboard row, or library panel to the current dashboard.
- (5) **Dashboard settings**: Use this option to change dashboard name, folder, and tags and manage variables and annotation queries. For more information about dashboard settings, refer to [Modify dashboard settings]({{< relref "../build-dashboards/modify-dashboard-settings/" >}}).
- (6) **Time picker dropdown**: Click to select relative time range options and set custom absolute time ranges.
  - You can change the **Timezone** and **fiscal year** settings from the time range controls by clicking the **Change time settings** button.
  - Time settings are saved on a per-dashboard basis.
- (7) **Zoom out time range**: Click to zoom out the time range. For more information about how to use time range controls, refer to [Common time range controls]({{< relref "#common-time-range-controls" >}}).
- (8) **Refresh dashboard**: Click to immediately trigger queries and refresh dashboard data.
- (9) **Refresh dashboard time interval**: Click to select a dashboard auto refresh time interval.
- (10) **View mode**: Click to display the dashboard on a large screen such as a TV or a kiosk. View mode hides irrelevant information such as navigation menus. For more information about view mode, refer to [How to Create Kiosks to Display Dashboards on a TV](https://grafana.com/blog/2019/05/02/grafana-tutorial-how-to-create-kiosks-to-display-dashboards-on-a-tv/).
- (11) **Dashboard panel**: The primary building block of a dashboard is the panel. To add a new panel, dashboard row, or library panel, click **Add panel**.
  - Library panels can be shared among many dashboards.
  - To move a panel, drag the panel header to another location.
  - To resize a panel, click and drag the lower right corner of the panel.
- (12) **Graph legend**: Change series colors, y-axis and series visibility directly from the legend.
- (13) **Search**: Click **Search** to search for dashboards by name or panel title.
- (14) **Dashboard row**: A dashboard row is a logical divider within a dashboard that groups panels together.
  - Rows can be collapsed or expanded allowing you to hide parts of the dashboard.
  - Panels inside a collapsed row do not issue queries.
  - Use [repeating rows]({{< relref "../build-dashboards/create-dashboard/#configure-repeating-rows" >}}) to dynamically create rows based on a template variable.

## Keyboard shortcuts

Grafana has a number of keyboard shortcuts available. Press `?` or `h` on your keyboard to display all keyboard shortcuts available in your version of Grafana.

- `Ctrl+S`: Saves the current dashboard.
- `f`: Opens the dashboard finder / search.
- `d+k`: Toggle kiosk mode (hides the menu).
- `d+e`: Expand all rows.
- `d+s`: Dashboard settings.
- `Ctrl+K`: Opens the command palette.
- `Esc`: Exits panel when in fullscreen view or edit mode. Also returns you to the dashboard from dashboard settings.

**Focused panel**

By hovering over a panel with the mouse you can use some shortcuts that will target that panel.

- `e`: Toggle panel edit view
- `v`: Toggle panel fullscreen view
- `ps`: Open Panel Share Modal
- `pd`: Duplicate Panel
- `pr`: Remove Panel
- `pl`: Toggle panel legend

## Set dashboard time range

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

### Control the time range using a URL

You can control the time range of a dashboard by providing the following query parameters in the dashboard URL:

- `from`: Defines the lower limit of the time range, specified in `ms`, `epoch`, or [relative time]({{< relref "#relative-time-range" >}})
- `to`: Defines the upper limit of the time range, specified in `ms`, `epoch`, or [relative time]({{< relref "#relative-time-range" >}})
- `time` and `time.window`: Defines a time range from `time-time.window/2` to `time+time.window/2`. Both parameters should be specified in `ms`. For example `?time=1500000000000&time.window=10000` results in 10s time range from 1499999995000 to 1500000005000
