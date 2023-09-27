+++
title = "Time series"
keywords = ["grafana", "graph panel", "time series panel", "documentation", "guide", "graph"]
weight = 1200
+++

# Time series

> **Note:** Time series panel visualization is going to replace the Graph panel visualization in a future release.

Time series panel is a robust visualization to plot time series data. It can render as a line, a path of dots, or a series of bars. This type of graph is versatile enough to display almost any time-series data.

For Time series panel examples, refer to the Grafana Play dashboard [New Features in v7.4](https://play.grafana.org/d/nP8rcffGk/new-features-in-v7-4?orgId=1).

> **Note:** You can migrate Graph panel visualizations to Time series visualizations. To migrate, open the panel and then select the  **Time series** visualization. Grafana transfers all applicable settings.

## Common time series options

These options are available whether you are graphing your time series as lines, bars, or points.

{{< docs/shared lookup="visualizations/tooltip-mode.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="visualizations/legend-mode.md" source="grafana" version="<GRAFANA VERSION>" >}}

### Legend calculations

Choose which of the [standard calculations]({{< relref "../../calculations-list.md">}}) to show in the legend. You can have more than one.

## Graph styles

Use these options to choose how to display your time series data.

- [Graph time series as lines]({{< relref "./graph-time-series-as-lines.md" >}})
- [Graph time series as bars]({{< relref "./graph-time-series-as-bars.md" >}})
- [Graph time series as points]({{< relref "./graph-time-series-as-points.md" >}})
- [Graph stacked time series]({{< relref "./graph-time-series-stacking.md" >}})

## Axis

For more information about adjusting your time series axes, refer to [Change axis display]({{< relref "change-axis-display.md" >}}).
