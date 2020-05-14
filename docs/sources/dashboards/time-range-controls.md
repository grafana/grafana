+++
title = "Time range controls"
keywords = ["grafana", "dashboard", "documentation", "time range"]
type = "docs"
[menu.docs]
aliases = ["/docs/grafana/latest/reference/timerange/"]
name = "Time range controls"
parent = "dashboards"
weight = 7
+++

# Time range controls

Grafana provides several ways to manage the time ranges of the data being visualized, both at the dashboard level and the panel level. 

This page describes supported time units and relative ranges, the common time controls, dashboard-wide time settings, and panel-specific time settings.

## Time units and relative ranges

The following time units are supported: `s (seconds)`, `m (minutes)`, `h (hours)`, `d (days)`, `w (weeks)`, `M (months)`, and `y (years)`. 

The minus operator allows you to step back in time, relative to now. If you wish to display the full period of the unit (day, week, month, etc...), append `/$unit` to the end.

Here are some examples:

Example relative range | From: | To:
-------------- | ----- | ---
Last 5 minutes | `now-5m` | `now`
The day so far | `now/d` | `now`
This week | `now/w` | `now/w`
Week to date | `now/w` | `now`
Previous Month | `now-1M/M` | `now-1M/M`

## Common time range controls

The dashboard and panel time controls have a common user interface (UI).

<img class="no-shadow" src="/img/docs/time-range-controls/common-time-controls-7-0.png" max-width="700px">

The options are defined below.

### Current time range

The current time range, also called the _time picker_, shows the time range currently displayed in the dashboard or panel you are viewing.

Hover your curser over the field to see the exact time stamps in the range and their source (such as the local browser).

<img class="no-shadow" src="/img/docs/time-range-controls/time-picker-7-0.png" max-width="300px">

To change the current time range, click the down arrow next to the current time range. You can change the current time using a _relative time range_, such as the last 15 minutes, or an _absolute time range_, such as `now-45h`.

<img class="no-shadow" src="/img/docs/time-range-controls/change-current-time-range-7-0.png" max-width="900px">

### Relative time range

Select the relative time range from the **Relative time ranges** list. Some examples of time ranges are:

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

### Absolute time range

Set an absolute time range one of two ways:

- Type values into the **From** and **To** fields. You can type exact time values or relative values, such as `now-24h`, and then click **Apply time range**.
- Click in the **From** or **To** field. Grafana displays a calender. Click the day or days you want to use as the current time range and then click **Apply time range**.

This section also displays recently used absolute ranges.

### Zoom out (Cmd+Z or Ctrl+Z)

Click the **Zoom out** icon to view a larger time range in the dashboard or panel visualization.

### Zoom in (not shown in UI)

Click and drag to select the time range in the visualization that you want to view.

### Refresh dashboard

Click the **Refresh dashboard** icon to immediately run every query on the dashboard and refresh the visualizations.

By default, Grafana does not automatically refresh the dashboard. Queries run on their own schedule according to the panel settings. However, if you want to to regularly refresh the dashboard, then click the down arrow next to the **Refresh dashboard** icon and then select a refresh interval.

## Dashboard time settings

Time settings are saved on a per-dashboard basis.

To access the dashboard time settings, click the **Dashboard settings** (gear) icon at the top of the screen. The settings are in the **Time Options** section of the General tab.

- **Timezone -** Specify the local time zone of the service or system that you are monitoring. This can be helpful when monitoring a system or service that operates across several time zones.
  - **Default -**: The default selected time zone for the user profile or organization is used. If no time zone is specified for the user profile or the organization, then Grafana uses local browser time.
  - **Local browser time -** The time zone configured for the viewing user browser is used. This is usually the same time zone as set on the computer.
  - Standard [ISO 8601 time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), including UTC.
- **Auto-refresh -** Customize the options displayed for relative time and the auto-refresh options. Entries are comma separated and accept any valid time unit.
- **Now delay now- -** Override the `now` value by entering a time delay. Most commonly, this feature is used to accommodate known delays in data aggregation to avoid null values.
- **Hide time picker -** Select this option if you do not want Grafana to display the time picker.

## Panel time overrides and timeshift

In [Query options]({{< relref "queries.md#query-options" >}}), you can override the relative time range for individual panels, causing them to be different than what is selected in the dashboard time picker in the upper right. This allows you to show metrics from different time periods or days at the same time.

## Control the time range using a URL

Time range of a dashboard can be controlled by providing following query parameters in the dashboard URL:

- `from` - defines lower limit of the time range, specified in ms epoch
- `to` - defines upper limit of the time range, specified in ms epoch
- `time` and `time.window` - defines a time range from `time-time.window/2` to `time+time.window/2`. Both params should be specified in ms. For example `?time=1500000000000&time.window=10000` will result in 10s time range from 1499999995000 to 1500000005000
