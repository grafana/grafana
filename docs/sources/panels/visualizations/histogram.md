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

The size of the buckets. Leave empty for automatic bucket sizing (~10% of the full range).

### Bucket offset

If the first bucket should not start at zero. A non-zero offset has the effect of shifting the aggregation window. For example, 5-sized buckets that are 0-5, 5-10, 10-15 with a default 0 offset would become 2-7, 7-12, 12-15 with an offset of 2; offsets of 0, 5 or 10 in this case would effectively do nothing. Typically, this option would be used with an explicitly-defined bucket size rather than automatic. For this setting to have an effect, the offset amount should be greater than 0 and less than the bucket size; values outside this range will have the same effect as values within this range.

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

