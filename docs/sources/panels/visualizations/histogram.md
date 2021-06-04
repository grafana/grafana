+++
title = "Histogram"
description = "Histogram visualization"
keywords = ["grafana", "docs", "bar chart", "panel", "barchart"]
weight = 605
+++

# Histogram

This panel calculates the distribution of values and presents them as a bar chart. The Y axis and the height of each bar represents the count of values that fall into each bracket while the X axis represents the value range. 

{{< figure src="/static/img/docs/histogram-panel/histogram-example-v8-0.png" max-width="625px" caption="Bar chart example" >}}

## Supported data formats

This panel supports time series and any table results with one or more numerical fields. 

## Display options

Use these options to refine your visualization.

### Bucket size

The size of the buckets. Leave empty for automatic bucket sizing. 

### Bucket offset

If the first bucket should not start at zero. 

### Combine series

This will merge all series and fields into a combined histogram. 

### Line width

Controls line width of the bars.

### Fill opacity

Controls the fill opacity bars.

### Gradient mode

Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard [color scheme]({{< relref "../standard-options.md#color-scheme" >}}) field option.

Gradient appearance is influenced by the **Fill opacity** setting.

#### None

No gradient fill. This is the default setting.

#### Opacity

Transparency of the gradient is calculated based on the values on the y-axis. Opacity of the fill is increasing with the values on the Y-axis.

#### Hue

Gradient color is generated based on the hue of the line color.

{{< docs/shared "visualizations/tooltip-mode.md" >}}

{{< docs/shared "visualizations/legend-mode.md" >}}

### Legend calculations

Choose which of the [standard calculations]({{< relref "../calculations-list.md">}}) to show in the legend. You can have more than one.

