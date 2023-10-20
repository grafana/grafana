---
keywords:
  - grafana
  - graph panel
  - trend panel
  - documentation
  - guide
  - graph
  - line chart
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Trend
weight: 100
---

# Trend

Trend visualizations should be used for datasets that have a sequential, numeric X that is not time. Some examples are function graphs, rpm/torque curves, supply/demand relationships, and elevation or heart rate plots along a race course (with x as distance or duration from start).

Trend visualizations support all visual styles and options available in the [time series visualization][] with these exceptions:

- No annotations or time regions
- No shared cursor/crosshair
- No multi-timezone x axis
- No ability to change the dashboard time range via drag-selection

## X Field selection

Use this option to select a field that contains increasing numeric values.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-trend-speed-xvalue.png" max-width="750px" caption="Trend x value selection" >}}

For example, you could represent engine power and torque versus speed where speed is plotted on the x axis and power and torque are plotted on the y axes.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-trend-panel-new-colors.png" max-width="750px" caption="Trend engine power and torque curves" >}}

{{% docs/reference %}}
[Time series visualization]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"
[Time series visualization]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"
{{% /docs/reference %}}
