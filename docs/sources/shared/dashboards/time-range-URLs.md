---
title: Time range URLs
comments: |
  This file is used in the following files: dashboards/build-dashboards/create-dashboard-url-variables/index.md, dashboards/use-dashboards/index.md
---

You can control the time range of a dashboard by providing the following query parameters in the dashboard URL:

- `from` - Defines the lower limit of the time range, specified in ms, epoch, or relative time.
- `to` - Defines the upper limit of the time range, specified in ms, epoch, or relative time.
- `time` and `time.window` - Defines a time range from `time-time.window/2` to `time+time.window/2`. Both parameters should be specified in `ms`. For example `?time=1500000000000&time.window=10000` results in a 10-second time range from 1499999995000 to 1500000005000`.
- `timezone` - Defines the time zone. For example `timezone=Europe/Madrid`.

Since these aren't variables, they don't require the `var-` prefix.

The following example shows a dashboard with the time range of the last five minutes:

```
https://${your-domain}/path/to/your/dashboard?from=now-5m&to=now
```
