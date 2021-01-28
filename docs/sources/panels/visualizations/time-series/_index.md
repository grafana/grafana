+++
title = "Time series panel"
keywords = ["grafana", "graph panel", "time series panel", "documentation", "guide", "graph"]
weight = 1200
+++

# Time series panel

> **Note:** This is a beta feature. Time series panel is going to replace the Graph panel in the future releases.

Time series panel is a robust visualization to plot time series data. It can render as a line, a path of dots, or a series of bars. This type of graph is versatile enough to display almost any time-series data.

For Time series panel examples, refer to the Grafana Play dashboard [New Features in v7.4](https://play.grafana.org/d/nP8rcffGk/new-features-in-v7-4?orgId=1).

## Data and field options

Time series visualizations allow you to apply:

- [Data transformations]({{< relref "../../transformations/_index.md" >}})
- [Field options and overrides]({{< relref "../../field-options/_index.md" >}})
- [Thresholds]({{< relref "../../thresholds.md" >}})

You can also use field options to create different types of graphs or adjust your axes:

- [Graph time series as lines]({{< relref "graph-time-series-as-lines.md" >}})
- [Graph time series as bars]({{< relref "graph-time-series-as-bars.md" >}})
- [Graph time series as points]({{< relref "graph-time-series-as-points.md" >}})
- [Change axis display]({{< relref "change-axis-display.md" >}})

## Display options

> **Note:** You can migrate Graph panel visualizations to Time series visualizations. To migrate, on the Panel tab, click **Time series** visualization. Grafana transfers all applicable settings. (While in beta, migration is still being refined. It will get better as time goes on!)

### Tooltip mode

When you hover your cursor over the graph, Grafana can display tooltips. Choose how tooltips behave.

- **Single -** The hover tooltip shows only a single series, the one that you are hovering over on the graph.
- **All -** The hover tooltip shows all series in the graph. Grafana highlights the series that you are hovering over in bold in the series list in the tooltip.
- **Hidden -** Do not display the tooltip when you interact with the graph.

> **Note:** Use an override to hide individual series from the tooltip.

### Legend mode

Use these settings to refine how the legend appears in your visualization.

- **List -** Displays the legend as a list. This is a default display mode of the legend.
- **Table -** Displays the legend as a table.
- **Hidden -** Hides the legend.

### Legend placement

Choose where to display the legend.

- **Bottom -** Below the graph.
- **Right -** To the right of the graph.

### Legend calculations

Choose which of the [standard calculations]({{< relref "../../calculations-list.md">}}) to show in the legend. You can have more than one.

## Legend options

The Time series legend has additional features.

### Toggle series

Click on the series label in the legend to isolate the series in the visualization. All other series are hidden in the visualization. The data of the hidden series is still accessible.

Cmd/Ctrl+click on the series label to hide the clicked series and remove the toggle.

> **Note:** This option is persistent when you save the dashboard.

This creates a system override that hides the other series. You can view this override in the Overrides tab. If you delete the override, then it removes the toggle.

### Change series color

Click on the series icon (colored line beside the series label) in the legend to change selected series color.
