---
aliases:
  - ../panels/visualizations/time-series/
keywords:
  - grafana
  - graph panel
  - time series panel
  - documentation
  - guide
  - graph
title: Time series
weight: 1200
---

# Time series

{{< figure src="/static/img/docs/time-series-panel/time_series_small_example.png" max-width="1200px" caption="Time series" >}}

Time series visualization is the default and primary way to visualize time series data. It can render as a line, a path of dots, or a series of bars. It is versatile enough to display almost any time-series data. [This public demo dashboard](https://play.grafana.org/d/000000016/1-time-series-graphs?orgId=1) contains many different examples for how this visualization can be configured and styled.

> **Note:** You can migrate Graph panel visualizations to Time series visualizations. To migrate, open the panel and then select the **Time series** visualization. Grafana transfers all applicable settings.

## Common time series options

These options are available whether you are graphing your time series as lines, bars, or points.

{{< docs/shared "visualizations/tooltip-mode.md" >}}

{{< docs/shared "visualizations/legend-mode.md" >}}

### Legend calculations

Choose which of the [standard calculations]({{< relref "../../panels/reference-calculation-types.md">}}) to show in the legend. You can have more than one.

## Graph styles

Use these options to choose how to display your time series data.

- [Graph time series as lines]({{< relref "./graph-time-series-as-lines.md" >}})
- [Graph time series as bars]({{< relref "./graph-time-series-as-bars.md" >}})
- [Graph time series as points]({{< relref "./graph-time-series-as-points.md" >}})
- [Graph stacked time series]({{< relref "./graph-time-series-stacking.md" >}})
- [Graph and color schemes]({{< relref "./graph-color-scheme.md" >}})

### Transform

Use this option to transform the series values without affecting the values shown in the tooltip, context menu, and legend.

- **Negative Y transform -** Flip the results to negative values on the Y axis.
- **Constant -** Show first value as a constant line.

> **Note:** Transform option is only available as an override.

## Axis

For more information about adjusting your time series axes, refer to [Change axis display]({{< relref "change-axis-display.md" >}}).
