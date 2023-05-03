---
keywords:
  - grafana
  - graph panel
  - trend panel
  - documentation
  - guide
  - graph
title: Trend
weight: 90
---

# Trend

The trend visualization type is the default and primary way to visualize data as a graph where x != time. It can render series as lines, points, or bars. It is versatile enough to display almost any sequential data.

The trend panel supports all of the [visual options]({{< relref "../time-series" >}}) available to the time series panel with the exception of:

- Annotation support
- Shared crosshair support
- Ability to zoom into data

## X Field Selection

Use this option to select a field that contains increasing numeric values.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-trend-x-value.png" max-width="750px" caption="Trend x value selection" >}}

For example, we could represent age vs weight data where age is plotted on the x axis and weight is plotted on the y axis.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-trend-age-weight-example.png" max-width="750px" caption="Trend age vs weight example" >}}
