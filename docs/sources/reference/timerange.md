----
page_title: Time Range options
page_description: Time range user guide
page_keywords: grafana, time range, guide, documentation
---

# Time Range Controls

Grafana provides numerous ways to manage the time ranges of the data being visualized, both at the Dashboard-level and the Panel-level.

<img class="no-shadow" src="/img/v1/time_range_controls.png">

In the top right, you have the master Dashboard time picker (it's in between the 'Zoom out' and the 'Refresh' links).

From this dropdown you can:

1. Specify an exact time range (eg. "October 13 12:01 to October 14 12:05)
2. Choose a relative time (eg. "Last 15 minutes","Last 1 week")
3. Configure auto-refresh options

All of this applies to all Panels in the Dashboard (except those with Panel Time Overrides enabled)

## Customize relative time and auto auto-refresh options

It's possible to customize the options displayed for relative time and the auto-refresh options.

From Dashboard settings, click the Timepicker tab. From here you can specify the relative and auto refresh intervals. The Timepicker tab settings are saved on a per Dashboard basis.  Entries are comma separated and accept a number followed by one of the following units: `s (seconds)`, `m (minutes)`, `h (hours)`, `d (days)`, `w (weeks)`, `M (months)`, `y (years)`.

<img class="no-shadow" src="/img/v2/TimePicker-TimeOptions.png">


## Panel time overrides & timeshift

In Grafana v2.x you can now override the relative time range for individual panels, causing them to be different than what is selected in the Dashboard time picker in the upper right. You can also add a time shift to individual panels. This allows you to show metrics from different time periods or days at the same time.

<img class="no-shadow" src="/img/v2/panel_time_override.jpg">

You control these overrides in panel editor mode and the new tab `Time Range`.

<img class="no-shadow" src="/img/v2/time_range_tab.jpg">

When you zoom or change the Dashboard time to a custom absolute time range, all panel overrides will be disabled. The panel relative time override is only active when the dashboard time is also relative. The panel timeshift override however is always active, even when the dashboard time is absolute.

The `Hide time override info` option allows you to hide the the override info text that is by default shown in the
upper right of a panel when overridden time range options.

Currently you can only override the dashboard time with relative time ranges, not absolute time ranges. 
