---
aliases:
  - ../notifications/mute-timings/ # /docs/grafana/<GRAFANA_VERSION>/alerting/notifications/mute-timings/
  - ../unified-alerting/notifications/mute-timings/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/notifications/mute-timings/
  - ../manage-notifications/mute-timings/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/mute-timings/
canonical: /docs/grafana/latest/alerting/configure-notifications/mute-timings/
description: Use mute timings and active intervals to manage notification handling during a specific and reoccurring period of time
keywords:
  - grafana
  - alerting
  - guide
  - mute
  - mute timings
  - mute time interval
  - active intervals
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure mute timings and active time intervals
weight: 430
refs:
  alertmanager-architecture:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/#alertmanager-architecture
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/#alertmanager-architecture
  shared-silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
  shared-mute-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings/
---

# Configure mute timings and active intervals

Mute timing and active time intervals let you determine how your alert notifications are handled during designated periods of time. After you create a time interval, you can apply it as either a mute or active time interval for your notifications policies.

A mute timing is a recurring interval that stops notifications for one or multiple notification policies during a specified period. It suppresses notifications but does not interrupt alert evaluation.

Use mute timings to temporarily pause notifications for a specific recurring period, such as a regular maintenance window or weekends.

The active time interval provide the opposite functionality, where alerts handled by a notification policy are suppressed unless the notification happens at a time that matches the time interval. Use active time intervals for periods where you want to reduce alert noise.

{{< admonition type="note" >}}
Mute timings and active time intervals are assigned to a [specific Alertmanager](ref:alertmanager-architecture) and only suppress notifications for alerts managed by that Alertmanager.
{{< /admonition >}}

## Mute and active timings vs silences

[Mute and active timings](ref:shared-mute-timings) and [silences](ref:shared-silences) are distinct methods to suppress notifications. They do not prevent alert rules from being evaluated or stop alert instances from appearing in the user interface; they only prevent notifications from being created.

The following table highlights the key differences between mute timings and silences.

|            | Mute timing                                                 | Silence                                                          |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| **Setup**  | Created and then added to notification policies             | Matches alerts using labels to determine whether to silence them |
| **Period** | Uses time interval definitions that can repeat periodically | Has a fixed start and end time                                   |

[//]: <> ({{< docs/shared lookup="alerts/mute-timings-vs-silences.md" source="grafana" version="<GRAFANA_VERSION>" >}})

## Add time intervals

1. In the left-side menu, click **Alerts & IRM**, and then **Alerting**.
1. Click **Notification policies** and then the **Time intervals** tab.
1. From the **Alertmanager** dropdown, select an external Alertmanager. By default, the **Grafana Alertmanager** is selected.
1. Click **+ Add time interval**.
1. Fill out the form to create a [time interval](#time-intervals) to match against for your mute or active timing.
1. Save your changes.

## Assign a time interval to a notification policy

1. In the left-side menu, click **Alerts & IRM**, and then **Alerting**.
1. Click **Notification policies** and make sure you are on the **Notification Policies** tab.
1. Find the notification policy you would like to add the time intervals to and click **...** -> **Edit**.
1. From either the **Mute timings** or **Active timings** dropdowns, choose the notification timings you would like to add to the policy.
1. Save your changes.

## Time intervals

A time interval is a specific duration during which alerts are suppressed. The duration typically consists of a specific time range and the days of the week, month, or year.

A mute or active timing can contain multiple time intervals.

Supported time interval options are:

- Time range: The time inclusive of the start and exclusive of the end time (in UTC if no location has been selected, otherwise local time).
- Location: Depending on the location you select, the time range is displayed in local time.
- Days of the week: The day or range of days of the week. Example: `monday:thursday`.
- Days of the month: The date 1-31 of a month. Negative values can also be used to represent days that begin at the end of the month. For example: `-1` for the last day of the month.
- Months: The months of the year in either numerical or the full calendar month. For example: `1, may:august`.
- Years: The year or years for the interval. For example: `2021:2024`.

All fields are lists; to match the field, at least one list element must be satisfied. Fields also support ranges using `:` (e.g., `monday:thursday`).

If a field is left blank, any moment of time matches the field. For an instant of time to match a complete time interval, all fields must match.

If you want to specify an exact duration, specify all the options.

**Example**

If you wanted to create a time interval for the first Monday of the month, for March, June, September, and December, between the hours of 12:00 and 24:00 UTC your time interval specification would be:

- Time range:
  - Start time: `12:00`
  - End time: `24:00`
- Days of the week: `monday`
- Months: `3, 6, 9, 12`
- Days of the month: `1:7`
