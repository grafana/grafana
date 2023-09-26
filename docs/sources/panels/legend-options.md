+++
title = "Legend options"
aliases = ["/docs/grafana/v8.1/panels/visualizations/panel-legend/"]
weight = 950
+++

# Legend options

Use the legend to adjust how a visualization displays series. This legend functionality only applies to a few panels now, but it will eventually be common to all visualizations.

This topic currently applies to the following visualizations:

- [Pie chart panel]({{< relref "../visualizations/pie-chart-panel.md">}})
- [Time series panel]({{< relref "../visualizations/time-series/_index.md" >}})

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
