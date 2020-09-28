+++
title = "Troubleshoot dashboards"
description = "Guide to troubleshooting Grafana dashboards"
keywords = ["grafana", "troubleshooting", "documentation", "dashboards"]
type = "docs"
[menu.docs]
weight = 100
+++

# Troubleshoot dashboards

This page provides information to solve common dashboard problems.

## Dashboard is slow

- Are you trying to render dozens (or hundreds or thousands) of time-series on a graph? This can cause the browser to lag and feel sluggish. Try using functions like `highestMax` (in Graphite) to reduce the returned series.
- Sometimes the series names can be very large. This causes larger response sizes. Try using `alias` to reduce the size of the returned series names.
- Are you querying many time-series or for a long range of time? Both of these can cause Grafana or your data source to pull in a lot of data, which may slow it down.
- It could be high load on your network infrastructure. If the slowness isn't consistent, this may be the problem.

## Dashboard refresh rate issues

By default, Grafana queries your data source every 30 seconds. Setting a low refresh rate on your dashboards puts unnecessary stress on the backend. In many cases, querying this frequently makes no sense, because the data isn't being sent to the system such that changes would be seen.

We recommend the following:

- Do not enable auto-refreshing on dashboards, panels, or variables unless you need it. Users can refresh their browser manually, or you can set the refresh rate for a time period that makes sense (every ten minutes, every hour, and so on).
- If it is required, then set the refresh rate to once a minute. Again, users can always refresh the dashboard manually.
- If your dashboard has a longer time period (such as a week), then you really don't need automated refreshing.

### Handling or rendering null data is wrong/confusing/weird

Some applications publish data intermittently; for example, they only post a metric when an event occurs. By
default, Grafana graphs connect lines between the data points. This can be very deceiving.

In the picture below we have enabled:
- Points and 3-point radius to highlight where data points are actually present.
- **Null value** is set to **connected**.

{{< docs-imagebox img="/img/docs/troubleshooting/grafana_null_connected.png" max-width="1200px" >}}

In this graph, we set graph to show bars instead of lines and set the **Null value** to graph **null as zero**. There is a very big different in the visuals.

{{< docs-imagebox img="/img/docs/troubleshooting/grafana_null_zero.png" max-width="1200px" >}}
