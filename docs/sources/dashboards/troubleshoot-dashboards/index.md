---
aliases:
  - ../troubleshooting/troubleshoot-dashboards/
  - ../reference/timerange/
keywords:
  - grafana
  - dashboard
  - troubleshoot
  - time range
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshoot dashboards
title: Troubleshoot dashboards
description: Learn how to troubleshoot common dashboard issues
weight: 300
---

# Troubleshoot dashboards

Use the following strategies to help you solve common dashboard problems.

## Dashboard is slow

- Are you trying to render dozens (or hundreds or thousands) of time-series on a graph? This can cause the browser to lag. Try using functions like `highestMax` (in Graphite) to reduce the returned series.
- Sometimes the series names can be very large. This causes larger response sizes. Try using `alias` to reduce the size of the returned series names.
- Are you querying many time-series or for a long range of time? Both of these conditions can cause Grafana or your data source to pull in a lot of data, which may slow it down.
- It could be high load on your network infrastructure. If the slowness isn't consistent, this may be the problem.

## Dashboard refresh rate issues

By default, Grafana queries your data source every 30 seconds. Setting a low refresh rate on your dashboards puts unnecessary stress on the backend. In many cases, querying this frequently isn't necessary because the data isn't being sent to the system such that changes would be seen.

We recommend the following:

- Only enable auto-refreshing on dashboards, panels, or variables unless if necessary. Users can refresh their browser manually, or you can set the refresh rate for a time period that makes sense (every ten minutes, every hour, and so on).
- If it's required, then set the refresh rate to once a minute. Users can always refresh the dashboard manually.
- If your dashboard has a longer time period (such as a week), then you really don't need automated refreshing.

### Handling or rendering null data is wrong or confusing

Some applications publish data intermittently; for example, they only post a metric when an event occurs. By default, Grafana graphs connect lines between the data points. This can be very deceiving.

In the picture below we've enabled:

- Points and 3-point radius to highlight where data points are actually present.
- **Connect null values\* is set to **Always\*\*.

{{< figure src="/static/img/docs/troubleshooting/grafana_null_connected.png" max-width="1200px" alt="Graph with null values connected" >}}

In this graph, we set graph to show bars instead of lines and set the **No value** under **Standard options** to **0**. There is a very big difference in the visuals.

{{< figure src="/static/img/docs/troubleshooting/grafana_null_zero.png" max-width="1200px" alt="Graph with null values not connected" >}}

## More examples

You can find more examples in `public/dashboards/` directory of your Grafana installation.
