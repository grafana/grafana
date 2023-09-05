+++
title = "Legend options"
aliases = ["/docs/grafana/v8.3/panels/visualizations/panel-legend/"]
weight = 950
+++

# Legend options

Use the legend to adjust how a visualization displays series. This legend functionality only applies to a few panels now, but it will eventually be common to all visualizations.

This topic currently applies to the following visualizations:

- [Bar chart panel]({{< relref "../visualizations/bar-chart.md">}})
- [Histogram panel]({{< relref "../visualizations/histogram.md">}})
- [Pie chart panel]({{< relref "../visualizations/pie-chart-panel.md">}})
- [State timeline panel]({{< relref "../visualizations/state-timeline.md">}})
- [Status history panel]({{< relref "../visualizations/status-history.md">}})
- [Time series panel]({{< relref "../visualizations/time-series/_index.md" >}})
- XY chart panel

## Toggle series

To toggle a series:
Click on the series label in the legend to isolate the series in the visualization.
All other series are hidden in the visualization. The data of the hidden series is still accessible.

Use Cmd/Ctrl+click on the series label to hide the isolated series and remove the toggle.

> **Note:** This option is persistent when you save the dashboard.

![Toggle series visibility](/static/img/docs/legend/legend-series-toggle-7-5.png)

This creates a system override that hides the other series. You can view this override in the Overrides tab. If you delete the override, then it removes the toggle.

![Series toggle override example](/static/img/docs/legend/legend-series-override-7-5.png)

## Change series color

Click on the series icon (colored line beside the series label) in the legend to change selected series color.

![Change legend series color](/static/img/docs/legend/legend-series-color-7-5.png)

## Sort series

Change legend mode to **Table** and choose [calculations]({{< relref "./calculations-list.md" >}}) to be displayed in the legend. Click the calculation name header in the legend table to sort the values in the table in ascending or descending order.
The sort order affects the positions of the bars in the Bar chart panel as well as the order of stacked series in the Time series and Bar chart panels.

> **Note:** This feature is only supported in these panels: Bar chart, Histogram, Time series, XY Chart.

![Sort legend series](/static/img/docs/legend/legend-series-sort-8-3.png)
