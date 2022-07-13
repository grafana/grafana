---
aliases:
  - /docs/grafana/latest/panels/working-with-panels/apply-color-to-series/
  - /docs/grafana/latest/panels/working-with-panels/configure-legend/
title: Configure visualizations
menuTitle: Configure visualizations
weight: 50
keywords:
  - color
  - visualization
  - legend
---

# Configure visualizations

To configure a visualization, you can apply color to series and fields, and configure a legend.

## Apply color to series and fields

In addition to specifying color based on thresholds, you can configure the color of series and field data. The color options and their effect on the visualization depends on the visualization you are working with. Some visualizations have different color options.

You can specify a single color, or select a continuous (gradient) color schemes, based on a value.
Continuous color interpolates a color using the percentage of a value relative to min and max.

1. In panel display options, scroll to the **Standard options** or **override** section.

1. Click the **Standard options Color scheme** drop-down, and select one of the following palettes:

<div class="clearfix"></div>

| Color mode                      | Description                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **Single color**                | Specify a single color, useful in an override rule                                                                                                       |
| **From thresholds**             | Informs Grafana to take the color from the matching threshold                                                                                            |
| **Classic palette**             | Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations |
| **Green-Yellow-Red (by value)** | Continuous color scheme                                                                                                                                  |
| **Blue-Yellow-Red (by value)**  | Continuous color scheme                                                                                                                                  |
| **Blues (by value)**            | Continuous color scheme (panel background to blue)                                                                                                       |
| **Reds (by value)**             | Continuous color scheme (panel background color to blue)                                                                                                 |
| **Greens (by value)**           | Continuous color scheme (panel background color to blue)                                                                                                 |
| **Purple (by value)**           | Continuous color scheme (panel background color to blue)                                                                                                 | .   |

{{< figure src="/static/img/docs/v73/color_scheme_dropdown.png" max-width="350px" caption="Color scheme" class="pull-right" >}}

## Configure a legend

A panel includes a legend that you can use to interpret data displayed in a visualization. Each legend option adds context and clarity to the data illustrated in a visualization.

### Isolate series data in a visualization

Visualizations can often be visually complex, and include many data series. You can simplify the view by removing series data from the visualization, which isolates the data you want to see. Grafana automatically creates a new override in the **Override** tab.

When you apply your changes, the visualization changes appear to all users of the panel.

1. Open the panel.

1. In the legend, click the label of the series you want to isolate.

   The system removes from view all other series data.

1. To incrementally add series data to an isolated series, press the **Ctrl** or **Command** key and click the label of the series you want to add.

1. To revert back to the default view that includes all data, click any series label twice.

1. To save your changes so that they appear to all viewers of the panel, click **Apply**.

This topic currently applies to the following visualizations:

- [Bar chart]({{< relref "../../visualizations/bar-chart/" >}})
- [Histogram]({{< relref "../../visualizations/histogram/" >}})
- [Pie chart]({{< relref "../../visualizations/pie-chart-panel/" >}})
- [State timeline]({{< relref "../../visualizations/state-timeline/" >}})
- [Status history]({{< relref "../../visualizations/status-history/" >}})
- [Time series]({{< relref "../../visualizations/time-series/" >}})

### Add values to a legend

As way to add more context to a visualization, you can add series data values to a legend. You can add as many values as you'd like; after you apply your changes, you can horizontally scroll the legend to see all values.

1. Open a panel.

1. In the panel display options pane, locate the **Legend** section.

1. In the **Legend values** field, select the values you want to appear in the legend.

1. Click **Apply** to save your changes are navigate back to the dashboard.

![Toggle series visibility](/static/img/docs/legend/legend-series-toggle-7-5.png)

### Change a series color

By default, Grafana specifies the color of your series data, which you can change.

1. Open the panel.

1. In the legend, click the color bar associated with the series.

1. Select a pre-set color or a custom color from the color palette.

1. Click **Apply** to save your changes are navigate back to the dashboard.

![Change legend series color](/static/img/docs/legend/legend-series-color-7-5.png)

### Sort series

Change legend mode to **Table** and choose [calculations]({{< relref "../calculation-types/" >}}) to be displayed in the legend. Click the calculation name header in the legend table to sort the values in the table in ascending or descending order.

The sort order affects the positions of the bars in the Bar chart panel as well as the order of stacked series in the Time series and Bar chart panels.

> **Note:** This feature is only supported in these panels: Bar chart, Histogram, Time series, XY Chart.

![Sort legend series](/static/img/docs/legend/legend-series-sort-8-3.png).
