+++
title = "Mute timings"
description = "Mute timings"
keywords = ["grafana", "alerting", "guide", "mute", "mute timings", "mute time interval"]
weight = 450
+++

# Mute timings

## Create a mute timing

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. Click **Notification policies**.
1. From the **Alertmanager** dropdown, select an external Alertmanager. By default, the Grafana Alertmanager is selected.
1. At the bottom of the page there will be a section titled **Mute timings**. Click the **Add mute timing** button.
1. You will be redirected to a form to create a [time interval](#time-intervals) to match against for your mute timing.
1. Click **Submit** to create the mute timing.

## Add mute timing to a notification policy

After a mute timing is created, you need to select the notification policies to add it to.

1. Identify the notification policy you would like to add the mute timing to and click the **Edit** button for that policy.
1. From the Mute Timings dropdown select the mute timings you would like to add to the route.
1. Click the **Save policy** button to save.

## Time intervals

A time interval is a definition for a moment in time. If an alert fires during this interval it will be suppressed. All fields are lists, and at least one list element must be satisfied to match the field. Fields also support ranges using `:` (ex: `monday:thursday`). The fields available for a time interval are:

- Time range: The time inclusive of the starting time and exclusive of the end time in UTC
- Days of the week: The day or range of days of the week. Example: `monday:thursday`
- Days of the month: The date 1-31 of a month. Negative values can also be used to represent days which begin at the end of the month. Example: `-1` for the last day of the month.
- Months: The months of the year in either numerical or the full calendar month. Example: `1, may:august`
- Years: The year or years for the interval. Example: `2021:2024`

If a field is left blank, any moment of time will match the field. For an instant of time to match a complete time interval, all fields must match. A mute timing can contain multiple time intervals.

## Example

If you wanted to create a time interval for the first Monday of the month, for the months of March, June, September, and December, between the hours of 12:00 and 24:00 UTC your time interval would be:

- Time range:
  - Start time: `12:00`
  - End time: `24:00`
- Days of the week: `monday`
- Months: `3, 6, 9, 12`
- Days of the month: `1:7`
