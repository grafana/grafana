+++
title = "Time Range"
keywords = ["grafana", "dashboard", "documentation", "time range"]
type = "docs"
[menu.docs]
name = "Time Range"
parent = "dashboard_features"
weight = 7
+++


# Time Range Controls

Grafana provides numerous ways to manage the time ranges of the data being visualized, both at the Dashboard-level and the Panel-level.

<img class="no-shadow" src="/img/docs/v50/timepicker.png" width="700px">

The two controls for time visualization are available in the top right:

1. **Current time range**: This shows the current dashboard time. You can click on it to change it.
2. **Refresh interval**: This shows the current refresh interval for the current dashboard. You can click on it to change
   it. This feature is especially useful for always-on displays so that the most recent data is always shown.

These settings apply to all Panels in the Dashboard (except those with Panel Time Overrides enabled)

## Time Units

The following time units are supported: `s (seconds)`, `m (minutes)`, `h (hours)`, `d (days)`, `w (weeks)`, `M (months)`, `y (years)`. The minus operator allows you to step back in time, relative to now. If you wish to display the full period of the unit (day, week, month, etc...), append `/$unit` to the end.

Take a look at some examples to see these concepts in practice:

Example Relative Range | From: | To:
-------------- | ----- | ---
Last 5 minutes | `now-5m` | `now`
The day so far | `now/d` | `now`
This week | `now/w` | `now/w`
Week to date | `now/w` | `now`
Previous Month | `now-1M/M` | `now-1M/M`


## Dashboard Time Options

There are two settings available in the Dashboard Settings General tab, allowing customization of the auto-refresh intervals and the definition of `now`.

<img class="no-shadow" src="/img/docs/v50/time_options.png" width="500px">

### Auto-Refresh Options

It's possible to customize the options displayed for relative time and the auto-refresh options.

From Dashboard settings, click the Timepicker tab. From here you can specify the relative and auto-refresh intervals. The Timepicker tab settings are saved on a per Dashboard basis.  Entries are comma separated and accept any valid time unit.

### Defining Now

Grafana offers the ability to override the `now` value on a per dashboard basis. Most commonly, this feature is used to accommodate known delays in data aggregation to avoid null values.

### Time zone options
Starting in version 7.0, you can override the time zone used to display date and time values in a dashboard. 

With this feature, you can specify the local time zone of the service or system that you are monitoring. This can be helpful when monitoring a system or service that operates across several time zones.

Apart from the standard [ISO 8601 time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) you can select the following options:

* **Default**: The default selected time zone for the user profile or organization is used. If no time zone is specified for the user profile or the organization, then `Local browser time` is used.
* **Local browser time**: The time zone configured for the viewing user browser is used. This is usually the same time zone as set on the computer.

## Panel time overrides and timeshift

You can override the relative time range for individual panels, causing them to be different than what is selected in the Dashboard time picker in the upper right. This allows you to show metrics from different time periods or days at the same time.

{{< docs-imagebox img="/img/docs/v50/panel_time_override.png" max-width="500px" >}}

You control these overrides in panel editor mode and the tab `Time Range`.

{{< docs-imagebox img="/img/docs/v50/time_range_tab.png" max-width="500px" >}}

When you zoom or change the Dashboard time to a custom absolute time range, all panel overrides will be disabled. The panel relative time override is only active when the dashboard time is also relative. The panel timeshift override is always active, even when the dashboard time is absolute.

The `Hide time override info` option allows you to hide the override info text that is by default shown in the
upper right of a panel when overridden time range options.

**Note:** You can only override the dashboard time with relative time ranges. Absolute time ranges are not available.

## Controlling time range using URL
Time range of a dashboard can be controlled by providing following query parameters in dashboard URL:

- `from` - defines lower limit of the time range, specified in ms epoch
- `to` - defines upper limit of the time range, specified in ms epoch
- `time` and `time.window` - defines a time range from `time-time.window/2` to `time+time.window/2`. Both params should be specified in ms. For example `?time=1500000000000&time.window=10000` will result in 10s time range from 1499999995000 to 1500000005000
