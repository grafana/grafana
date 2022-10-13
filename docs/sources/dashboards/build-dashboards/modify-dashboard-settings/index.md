---
aliases:
  - /docs/grafana/latest/dashboards/build-dashboards/modify-dashboard-settings/
title: Modify dashboard settings
menuTitle: Dashboard settings
weight: 8
keywords:
  - xxx
---

# Modify dashboard settings

xxxxx.

## Modify dashboard time settings

Time settings are saved on a per-dashboard basis.

You can change the **Timezone** and **fiscal year** settings from the time range controls by clicking the **Change time settings** button.

For more advanced time settings, click the **Dashboard settings** (gear) icon at the top of the page. Then navigate to the **Time Options** section of the **General** tab.

- **Timezone:** Specify the local time zone of the service or system that you are monitoring. This can be helpful when monitoring a system or service that operates across several time zones.
  - **Default:** The default selected time zone for the user profile, team, or organization is used. If no time zone is specified for the user profile, a team the user is a member of, or the organization, then Grafana uses local browser time.
  - **Local browser time:** The time zone configured for the viewing user browser is used. This is usually the same time zone as set on the computer.
  - Standard [ISO 8601 time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), including UTC.
- **Auto-refresh:** Customize the options displayed for relative time and the auto-refresh options. Entries are comma separated and accept any valid time unit.
- **Now delay:** Override the `now` time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.
- **Hide time picker:** Select this option if you do not want Grafana to display the time picker.
