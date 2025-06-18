---
description: A reference for the JSON timesettings schema used with Observability as Code.
keywords:
  - configuration
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - github
  - time settings
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: timesettings schema
title: timesettings
weight: 600
---

# `timeSettings`

The `TimeSettingsSpec` defines the default time configuration for the time picker and the refresh picker for the specific dashboard.

Following is the JSON for default time settings:

```json
  "timeSettings": {
    "autoRefresh": "",
    "autoRefreshIntervals": [
      "5s",
      "10s",
      "30s",
      "1m",
      "5m",
      "15m",
      "30m",
      "1h",
      "2h",
      "1d"
    ],
    "fiscalYearStartMonth": 0,
    "from": "now-6h",
    "hideTimepicker": false,
    "timezone": "browser",
    "to": "now"
  },
```

`timeSettings` consists of:

- [TimeSettingsSpec](#timesettingsspec)

## `TimeSettingsSpec`

The following table explains the usage of the time settings JSON fields:

<!-- prettier-ignore-start -->

| Name | Usage |
| ---- | ----- |
| timezone? | string. Timezone of dashboard. Accepted values are IANA TZDB zone ID, `browser`, or `utc`. Default is `browser`.  |
| from | string. Start time range for dashboard. Accepted values are relative time strings like `now-6h` or absolute time strings like `2020-07-10T08:00:00.000Z`. Default is `now-6h`. |
| to | string. End time range for dashboard. Accepted values are relative time strings like `now-6h` or absolute time strings like `2020-07-10T08:00:00.000Z`. Default is `now`. |
| autoRefresh | string. Refresh rate of dashboard. Represented by interval string. For example: `5s`, `1m`, `1h`, `1d`. No default. In schema v1: `refresh`. |
| autoRefreshIntervals | string. Interval options available in the refresh picker drop-down menu. The default array is `["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"]`. |
|quickRanges? | Selectable options available in the time picker drop-down menu. Has no effect on provisioned dashboard. Defined in the [`TimeRangeOption`](#timerangeoption) spec. In schema v1: `timepicker.quick_ranges`, not exposed in the UI. |
| hideTimepicker | bool. Whether or not the time picker is visible. Default is `false`. In schema v1: `timepicker.hidden`. |
| weekStart? | Day when the week starts. Expressed by the name of the day in lowercase. For example: `monday`. Options are `saturday`, `monday`, and `sunday`. |
| fiscalYearStartMonth | The month that the fiscal year starts on. `0` = January, `11` = December |
| nowDelay? | string. Override the "now" time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values. In schema v1: `timepicker.nowDelay`. |

<!-- prettier-ignore-end -->

### `TimeRangeOption`

The following table explains the usage of the time range option JSON fields:

| Name    | Usage                              |
| ------- | ---------------------------------- |
| display | string. Default is `Last 6 hours`. |
| from    | string. Default is `now-6h`.       |
| to      | string. Default is `now`.          |
