---
aliases:
  - ../notifications/mute-timings/ # /docs/grafana/<GRAFANA_VERSION>/alerting/notifications/mute-timings/
  - ../unified-alerting/notifications/mute-timings/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/notifications/mute-timings/
  - ../manage-notifications/mute-timings/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/mute-timings/
canonical: /docs/grafana/latest/alerting/configure-notifications/mute-timings/
description: Create mute timings to prevent alerts from firing during a specific and reoccurring period of time
keywords:
  - grafana
  - alerting
  - guide
  - mute
  - mute timings
  - mute time interval
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure mute timings
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

# Configure mute timings

A mute timing is a recurring interval that stops notifications for one or multiple notification policies during a specified period. It suppresses notifications but does not interrupt alert evaluation.

Use mute timings to temporarily pause notifications for a specific recurring period, such as a regular maintenance window or weekends.

{{< admonition type="note" >}}
Mute timings are assigned to a [specific Alertmanager](ref:alertmanager-architecture) and only suppress notifications for alerts managed by that Alertmanager.
{{< /admonition >}}

{{< docs/shared lookup="alerts/mute-timings-vs-silences.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Add mute timings

1. In the left-side menu, click **Alerts & IRM**, and then **Alerting**.
1. Click **Notification policies** and then the **Mute Timings** tab.
1. From the **Alertmanager** dropdown, select an external Alertmanager. By default, the **Grafana Alertmanager** is selected.
1. Click **+ Add mute timing**.
1. Fill out the form to create a [time interval](#time-intervals) to match against for your mute timing.
1. Save your mute timing.

## Add mute timing to a notification policy

1. In the left-side menu, click **Alerts & IRM**, and then **Alerting**.
1. Click **Notification policies** and make sure you are on the **Notification Policies** tab.
1. Find the notification policy you would like to add the mute timing to and click **...** -> **Edit**.
1. From the **Mute timings** dropdown, choose the mute timings you would like to add to the policy.
1. Save your changes.

## Time intervals

A time interval is a specific duration during which alerts are suppressed. The duration typically consists of a specific time range and the days of the week, month, or year.

A mute timing can contain multiple time intervals.

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
