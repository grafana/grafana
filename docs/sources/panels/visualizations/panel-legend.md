+++
title = "Panel legend options"
weight = 50
+++

# Legend

You can use the legend adjust how a visualization displays series.

This applies to the following visualizations:

- [Pie chart v2 panel]({{< relref "pie-chart-panel.md">}})
- [Time series panel]({{< time-series/_index.md">}})

## Toggle series

Click on the series label in the legend to isolate the series in the visualization. All other series are hidden in the visualization. The data of the hidden series is still accessible.

Cmd/Ctrl+click on the series label to hide the clicked series and remove the toggle.

> **Note:** This option is persistent when you save the dashboard.

![Toggle series visibility](/img/docs/legend/legend-series-toggle-7-5.png)

This creates a system override that hides the other series. You can view this override in the Overrides tab. If you delete the override, then it removes the toggle.

![Series toggle override example](/img/docs/legend/legend-series-override-7-5.png)

## Change series color

Click on the series icon (colored line beside the series label) in the legend to change selected series color.

![Change legend series color](/img/docs/legend/legend-series-color-7-5.png)
