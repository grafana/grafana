----
page_title: Time Range options
page_description: Time range user guide
page_keywords: grafana, time range, guide, documentation
---

# Dashboard time picker

Grafana provides numerous ways to manage the time ranges of the data being visualized, both at the Dashboard-level and the Panel-level.

![](/img/v1/time_range_controls.png)

In the top right, you have the master Dashboard time picker (it's inbetween the 'Zoom out' and the 'Refresh' links).

From this dropdown you can:

1. Specify an exact time range (eg. "October 13 12:01 to October 14 12:05)
2. Choose a relative time (eg. "Last 15 minutes","Last 1 week")
3. Configure auto-refresh options

All of this applies to all Panels in the Dashboard (except those with Panel Time Overrides enabled)

## Customize relative time and auto auto-refresh options

It's possible to customize the options displayed for relative time and the auto-refresh options.

From Dashboard settings, click the Timepicker tab. From here you can specify the relative and auto refresh intervals. The Timepicker tab settings are saved on a per Dashboard basis.  Entries are comma separated and accept a number followed by one of the following units: s (seconds), m (minutes), h (hours), d (days), w (weeks), M (months), y (years).

![](/img/v1/timepicker_editor.png)

## Panel time override

In Grafana 2.0, it's now possible for individual Panels to override the Dashboard time picker. Please check out the [whats new in 2.0 guide](../../guides/whats-new-in-v2/) for further information
