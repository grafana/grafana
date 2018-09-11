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

In the top right, you have the master Dashboard time picker (it's in between the 'Zoom out' and the 'Refresh' links).

1. `Current time range & refresh interval`: This shows the current dashboard time and refresh interval. It also acts as the menu button to toggle the time range controls.
2. `Quick ranges`: Quick ranges are preset values to choose a relative time. At this time, quick ranges are not configurable, and will appear on every dashboard.
3. `Time range`: The time range section allows you to mix both explicit and relative ranges. The explicit time range format is `YYYY-MM-DD HH:MM:SS`
4. `Refreshing every:` When enabled, auto-refresh will reload the dashboard at the specified time range. Auto-refresh is most commonly used with relative time ranges ending in `now`, so new data will appear when the dashboard refreshes.

These settings apply to all Panels in the Dashboard (except those with Panel Time Overrides enabled)

## Time Units

The following time units are supported: `s (seconds)`, `m (minutes)`, `h (hours)`, `d (days)`, `w (weeks)`, `M (months)`, `y (years)`. The minus operator allows you to step back in time, relative to now. If you wish to display the full period of the unit (day, week, month, etc...), append `/$unit` to the end.

Take a look at some examples to seen these concepts in practice:

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

Users often ask, [when will then be now](https://www.youtube.com/watch?v=VeZ9HhHU86o)? Grafana offers the ability to override the `now` value on a per dashboard basis. Most commonly, this feature is used to accommodate known delays in data aggregation to avoid null values.

## Panel time overrides & timeshift

You can override the relative time range for individual panels, causing them to be different than what is selected in the Dashboard time picker in the upper right. This allows you to show metrics from different time periods or days at the same time.

{{< docs-imagebox img="/img/docs/v50/panel_time_override.png" max-width="500px" >}}

You control these overrides in panel editor mode and the tab `Time Range`.

{{< docs-imagebox img="/img/docs/v50/time_range_tab.png" max-width="500px" >}}

When you zoom or change the Dashboard time to a custom absolute time range, all panel overrides will be disabled. The panel relative time override is only active when the dashboard time is also relative. The panel timeshift override is always active, even when the dashboard time is absolute.

The `Hide time override info` option allows you to hide the override info text that is by default shown in the
upper right of a panel when overridden time range options.

Note: You can only override the dashboard time with relative time ranges. Absolute time ranges are not available.
