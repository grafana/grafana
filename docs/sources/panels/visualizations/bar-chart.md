+++
title = "Bar chart"
description = "Bar chart visualization"
keywords = ["grafana", "docs", "bar chart", "panel", "barchart"]
+++

# Bar chart visualization

This panel is focused on visualizing categorical data.

{{< figure src="/static/img/docs/v8/bar_chart_example.png" max-width="1025px" caption="Bar chart example" >}}

## Supported data formats

Only one data frame is supported and it needs to have at least one string field that will be used as the category for an X or Y axis and one or more numerical fields.

Example:

| Browser | Market share |
| ------- | ------------ |
| Chrome  | 50           |
| IE      | 17.5         |

If you have more than one numerical field the panel will show grouped bars.

### Visualizing time series or multiple result sets

If you have multiple time series or tables you first need to join them using a join or reduce transform. For example if you 
have multiple time series and you want to compare their last and max value add the **Reduce** transform and specify  **Max** and **Last** as options under **Calculations**. 

{{< figure src="/static/img/docs/v8/bar_chart_time_series.png" max-width="1025px" caption="Bar chart time series example" >}}

## Shared options

The following shared options are available:

- [Standard options]({{< relref "../standard-options.md" >}}) (Unit, min, max, decimals, color)
- [Thresholds]({{< relref "../thresholds.md" >}})
- [Value mappings]({{< relref "../value-mappings.md" >}})

You can also use [field overrides]({{< relref "../field-overrides.md" >}}) to specify options per field or series.

## Display options

### Orientation 

* **Auto** Grafana will decide orientation based on what the panel dimensions. 
* **Horizontal** will make the X axis the category axis. 
* **Vertical** will make the Y axis the category axis. 

### Show values

This controls whether values are shown on top or to the left of bars. 

* **Auto** Values will be shown if there is space
* **Always** Always show values.
* **Never** Never show values.  

### Group width

Controls the width of groups. 1 = max with, 0 = min width. 

### Bar width

Controls the width of bars. 1 = Max width, 0 = Min width. 

### Line width

Controls line width of the bars.

### Fill opacity

Controls the fill opacity bars.

### Gradient mode

Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard [color scheme]({{< relref "../standard-options.md#color-scheme" >}}) field option.

Gradient appearance is influenced by the **Fill opacity** setting. In the screenshots below, **Fill opacity** is set to 50.

{{< docs/shared "visualizations/tooltip-mode.md" >}}

{{< docs/shared "visualizations/legend-mode.md" >}}

### Legend calculations

Choose which of the [standard calculations]({{< relref "../calculations-list.md">}}) to show in the legend. You can have more than one.