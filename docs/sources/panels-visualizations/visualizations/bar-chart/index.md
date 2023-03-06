---
aliases:
  - ../../panels/visualizations/bar-chart/
  - ../../visualizations/bar-chart/
description: Bar chart visualization
keywords:
  - grafana
  - docs
  - bar chart
  - panel
  - barchart
title: Bar chart
weight: 170
---

# Bar chart

This panel visualization allows you to graph categorical data.

{{< figure src="/static/img/docs/bar-chart-panel/barchart_small_example.png" max-width="1000px" caption="Bar chart" >}}

## Supported data formats

Only one data frame is supported and it must have at least one string field that will be used as the category for an X or Y axis and one or more numerical fields.

Example:

| Browser | Market share |
| ------- | ------------ |
| Chrome  | 50           |
| IE      | 17.5         |

If you have more than one numerical field the panel will show grouped bars.

### Visualizing time series or multiple result sets

If you have multiple time series or tables you first need to join them using a join or reduce transform. For example if you
have multiple time series and you want to compare their last and max value add the **Reduce** transform and specify **Max** and **Last** as options under **Calculations**.

{{< figure src="/static/img/docs/bar-chart-panel/bar-chart-time-series-v8-0.png" max-width="1025px" caption="Bar chart time series example" >}}

## Bar chart options

Use these options to refine your visualization.

### Orientation

- **Auto** - Grafana decides the bar orientation based on what the panel dimensions.
- **Horizontal** - Will make the X axis the category axis.
- **Vertical** - Will make the Y axis the category axis.

### Rotate x-axis tick labels

When the graph is vertically oriented, this setting rotates the labels under the bars. This setting is useful when bar chart labels are long and overlap.

### X-axis tick label maximum length

Sets the maximum length of bar chart labels. Labels longer than the maximum length are truncated, and appended with `...`.

### Bar labels minimum spacing

Sets the minimum spacing between bar labels.

### Show values

This controls whether values are shown on top or to the left of bars.

- **Auto** Values will be shown if there is space
- **Always** Always show values.
- **Never** Never show values.

### Stacking

Controls bar chart stacking.

- **Off**: Bars will not be stacked.
- **Normal**: Bars will be stacked on each other.
- **Percent**: Bars will be stacked on each other, and the height of each bar is the percentage of the total height of the stack.

### Group width

Controls the width of groups. 1 = max with, 0 = min width.

### Bar width

Controls the width of bars. 1 = Max width, 0 = Min width.

### Bar radius

Controls the radius of the bars.

- 0 = Minimum radius
- 0.5 = Maximum radius

### Highlight full area on cover

Controls if the entire surrounding area of the bar is highlighted when you hover over the bar.

### Line width

Controls line width of the bars.

### Fill opacity

Controls the fill opacity bars.

### Gradient mode

Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard color scheme field option.

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

Choose which of the [standard calculations]({{< relref "../../calculation-types/" >}}) to show in the legend. You can have more than one.

For more information about the legend, refer to [Configure a legend](../configure-legend/).

## Text size

Enter a **Value** to change the size of the text on your bar chart.

## Axis

Use the following field settings to refine how your axes display.

Some field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

### Placement

Select the placement of the Y-axis.

#### Auto

Grafana automatically assigns Y-axis to the series. When there are two or more series with different units, then Grafana assigns the left axis to the first unit and right to the following units.

#### Left

Display all Y-axes on the left side.

#### Right

Display all Y-axes on the right side.

#### Hidden

Hide all axes.

To selectively hide axes, [Add a field override]({{< relref "../../configure-overrides#add-a-field-override" >}}) that targets specific fields.

### Label

Set a Y-axis text label.

If you have more than one Y-axis, then you can give assign different labels with an override.

### Width

Set a fixed width of the axis. By default, Grafana dynamically calculates the width of an axis.

By setting the width of the axis, data whose axes types are different can share the same display proportions. This makes it easier to compare more than one graph’s worth of data because the axes are not shifted or stretched within visual proximity of each other.

### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of Y-axis limits. By default, Grafana sets the range for the Y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent blips from turning into mountains when the data is mostly flat, and hard min or max derived from standard min and max field options can prevent intermittent spikes from flattening useful detail by clipping the spikes past a defined point.

You can set standard min/max options to define hard limits of the Y-axis. For more information, refer to [Standard options definitions]({{< relref "../../configure-standard-options/#max" >}}).
