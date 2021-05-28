+++
title = "Time series panel"
keywords = ["grafana", "graph panel", "time series panel", "documentation", "guide", "graph"]
weight = 1200
+++

# Time series panel

> **Note:** Time series panel is going to replace the Graph panel in a future release.

Time series panel is a robust visualization to plot time series data. It can render as a line, a path of dots, or a series of bars. This type of graph is versatile enough to display almost any time-series data.

For Time series panel examples, refer to the Grafana Play dashboard [New Features in v7.4](https://play.grafana.org/d/nP8rcffGk/new-features-in-v7-4?orgId=1).

## Data and field options

Time series visualizations allow you to apply:

- [Data transformations]({{< relref "../../transformations/_index.md" >}})
- [Field overrides]({{< relref "../../field-overrides.md" >}})
- [Thresholds]({{< relref "../../thresholds.md" >}})

You can also use field options to create different types of graphs or adjust your axes:

- [Graph time series as lines]({{< relref "graph-time-series-as-lines.md" >}})
- [Graph time series as bars]({{< relref "graph-time-series-as-bars.md" >}})
- [Graph time series as points]({{< relref "graph-time-series-as-points.md" >}})
- [Change axis display]({{< relref "change-axis-display.md" >}})
- [Graph stacked time series]({{< relref "graph-time-series-stacking.md" >}})

## Display options

> **Note:** You can migrate Graph panel visualizations to Time series visualizations. To migrate, on the Panel tab, click **Time series** visualization. Grafana transfers all applicable settings. (While in beta, migration is still being refined. It will get better as time goes on!)

{{< docs/shared "visualizations/tooltip-mode.md" >}}

{{< docs/shared "visualizations/legend-mode.md" >}}

### Legend calculations

Choose which of the [standard calculations]({{< relref "../../calculations-list.md">}}) to show in the legend. You can have more than one.
