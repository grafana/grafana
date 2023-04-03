---
aliases:
  - ../notifications/mute-timings/
  - ../unified-alerting/notifications/mute-timings/
description: Mute timings
keywords:
  - grafana
  - alerting
  - guide
  - mute
  - mute timings
  - mute time interval
title: Create mute timings
weight: 700
---

# Create mute timings

A mute timing is a recurring interval of time when no new notifications for a policy are generated or sent. Use them to prevent alerts from firing a specific and reoccurring period, for example, a regular maintenance period.

Similar to silences, mute timings do not prevent alert rules from being evaluated, nor do they stop alert instances from being shown in the user interface. They only prevent notifications from being created.

You can configure Grafana managed mute timings as well as mute timings for an [external Alertmanager data source]({{< relref "/docs/grafana/latest/datasources/alertmanager" >}}). For more information, refer to [Alertmanager documentation]({{< relref "/docs/grafana/latest/alerting/manage-notifications/alertmanager" >}}).

## Mute timings vs silences

The following table highlights the key differences between mute timings and silences.

| Mute timing                                        | Silence                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| Uses time interval definitions that can reoccur    | Has a fixed start and end time                                               |
| Is created and then added to notification policies | Uses labels to match against an alert to determine whether to silence or not |

## Create a mute timing

1. In the left-side menu, click **Alerts & incidents**, and then **Alerting**.
1. Click **Notification policies**.
1. From the **Alertmanager** dropdown, select an external Alertmanager. By default, the **Grafana Alertmanager** is selected.
1. Scroll down to the Mute timings section.
1. Click **+ Add mute timing**.
1. Fill out the form to create a [time interval](#time-intervals) to match against for your mute timing.
1. Click **Submit** to create the mute timing.

## Add mute timing to a notification policy

1. In the left-side menu, click **Alerts & incidents**, and then **Alerting**.
1. Click **Notification policies**.
1. Identify the notification policy you would like to add the mute timing to and click the **Edit** button for that policy.
1. In the Specific routing section, from the **Mute timings** dropdown, select the mute timings you would like to add to the route.
1. Click **Save policy**.

## Time intervals

A time interval is a definition for a moment in time. If an alert fires during this interval it will be suppressed. All fields are lists, and at least one list element must be satisfied to match the field. Fields also support ranges using `:` (ex: `monday:thursday`). The fields available for a time interval are: mute timing can contain multiple time intervals. A time interval is a specific duration when alerts are suppressed from firing. The duration typically consists of a specific time range along with days of a week, month, or year.

    All properties for the time interval are lists, and at least one list element must be satisfied to match the field. The fields support ranges using `:` (ex: `monday:thursday`). If you leave a field blank, it will match with any moment of time.

Supported time interval options are:

- Time range: The time inclusive of the starting time and exclusive of the end time in UTC. - Days of the week: The day or range of days of the week. Example: `monday:thursday`. - Days of the month: The date 1-31 of a month. Negative values can also be used to represent days that begin at the end of the month. For example: `-1` for the last day of the month. - Months: The months of the year in either numerical or the full calendar month. For example: `1, may:august`. - Years: The year or years for the interval. For example: `2021:2024`.

If a field is left blank, any moment of time will match the field. For an instant of time to match a complete time interval, all fields must match. A mute timing can contain multiple time intervals.

If you want to specify an exact duration, specify all the options. For example, if you wanted to create a time interval for the first Monday of the month, for March, June, September, and December, between the hours of 12:00 and 24:00 UTC your time interval specification would be:

- Time range:
  - Start time: `12:00`
  - End time: `24:00`
- Days of the week: `monday`
- Months: `3, 6, 9, 12`
- Days of the month: `1:7`
