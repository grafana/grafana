---
canonical: https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/xy-chart/
keywords:
  - grafana
  - chart
  - xy chart
  - documentation
  - guide
  - graph
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's xy chart
title: XY chart
weight: 100
---

# XY chart

XY charts provide a way to visualize arbitrary x and y values in a graph so that you can easily show the relationship between two variables. XY charts are typically used to create scatter plots. You can also use them to create bubble charts where field values determine the size of each bubble.

![An xy chart showing height weight distribution]

## Supported data formats

You can use any type of tabular data with at least two numeric fields in an xy chart. This type of visualization doesn't require time data.

## XY chart options

### Series mapping

Set how series data is mapped in the chart.

- [Auto](#auto-series-mapping-options) - Automatically generates series from all available data frames (or datasets). You can filter to select only one frame.
- [Manual](#manual-series-mapping-options) - Explicitly define the series by selecting from available data frames.

Depending on your series mapping selection, the **Frame**, **X-field**, and **Y-field(s)** options differ. The [Auto](#auto-series-mapping-options) and [Manual](#auto-series-mapping-options) series mapping sections describe those different settings.

#### Auto series mapping options

When you select **Auto** as your series mapping mode, the following options are preconfigured, but you can also define them yourself:

- [Frame](#frame)
- [X-field](#x-field)
- [Y-fields](#y-fields)

##### Frame

By default, xy chart displays all data frames. You can filter to select only one frame.

##### X-field

Select which field or fields x represents. By default, this is the first number field in each data frame. For example, you enter the following CSV content:

| a   | b   | c   |
| --- | --- | --- |
| 0   | 0   | 0   |
| 1   | 1   | 9   |
| 2   | 2   | 4   |

In the resulting chart, x-fields are generated from the values in column "a" unless you define it differently.

##### Y-fields

After the x-field is set, by default, all the remaining number fields in the data frame are designated as the y-fields. You can use the y-field selector to explicitly choose which fields to use for y.

The series of the chart are generated from the y-fields. To make changes to a series in an xy chart, make [overrides][Configure field overrides] to the y-field.

You can also use [overrides][Configure field overrides] to exclude y-fields individually. To exclude y-fields individually, add an override with the following properties for each y-field you want removed:

- Override type: **Fields with name**
- Override property: **Series > Hide in area**
- Area: **Viz**

Any field you use in the [Size field](#size-field) or [Color field](#color-field), doesn't generate a series.

#### Manual series mapping options

When you select **Manual** as your series mode, you can add, edit, and delete series. To manage a series, click the **Series** field; to rename the series, click the series name.

In **Manual** mode, you must set the following options:

- **Frame** - Select your data frame or dataset. You can add as many data frames as you want.
- **X-field** - Select which field x represents.
- **Y-field** - Select which field y represents.

### Size field

Use this option to set which field's values control the size of the points in the chart. This value is relative to the min and max of all the values in the data frame.

When you select this option, you can then set the [Min point size](#min-point-size) and [Max point size](#max-point-size) options.

### Color field

Use this option to set which field's values control the color of the points in the chart. To use the color value options under the **Standard options**, you must set this field.

Typically, this option is used when you only have one series displayed in the chart.

### Show

Set how values are represented in the visualization.

- **Points** - Display values as points. When you select this option, the [Point size](#point-size) option is also displayed.
- **Lines** - Adds a line between values. When you select this option, the [Line style](#line-style) and [Line width](#line-width) options are also displayed.
- **Both** - Display both points and lines.

### Point size

Set the size of all points in the chart, from one to one hundred pixels in diameter. The default size is five pixels. You can set an [override][Configure field overrides] to set the pixel size by series (y-field).

### Min/Max point size

Use this option to control the minimum or maximum point size when you've set the **Size field** option. You can [override][Configure field overrides] this option for specific series.

### Line style

Set the style of the line. To change the color, use the standard [color scheme][] field option.

![Line style option](/static/img/docs/time-series-panel/line-style-option-v9.png)

- **Solid:** Display a solid line. This is the default setting.
- **Dash:** Display a dashed line. When you choose this option, a drop-down list is displayed where you can select the length and gap setting for the line dashes. By default, the length and gap are set to `10, 10`.
- **Dots:** Display dotted lines. When you choose this option, a drop-down list is displayed where you can select dot spacing. By default, the dot spacing is set to `0, 10` (the first number represents dot length, which is always zero).

### Line width

Set the width of the lines in pixels.

## Tooltip options

Tooltip options control the information overlay that appears when you hover over data points in the graph.

{{< docs/shared lookup="visualizations/tooltip-options-2.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Legend options

Legend options control the series names and statistics that appear under or to the right of the graph.

{{< docs/shared lookup="visualizations/legend-options-2.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Axis options

Options under the axis category change how the x- and y-axes are rendered. Some options don't take effect until you click outside of the field option box you are editing. You can also or press `Enter`.

### Placement

Select the placement of the y-axis.

- **Auto:** Automatically assigns the y-axis to the series. When there are two or more series with different units, Grafana assigns the left axis to the first unit and the right axis to the units that follow.
- **Left:** Display all y-axes on the left side.
- **Right:** Display all y-axes on the right side.
- **Hidden:** Hide all axes.

To selectively hide axes, [Add a field override][] that targets specific fields.

### Label

Set a y-axis text label. If you have more than one y-axis, then you can assign different labels using an override.

### Width

Set a fixed width of the axis. By default, Grafana dynamically calculates the width of an axis.

By setting the width of the axis, data with different axes types can share the same display proportions. This setting makes it easier for you to compare more than one graph’s worth of data because the axes are not shifted or stretched within visual proximity to each other.

### Show grid lines

Set the axis grid line visibility.

- **Auto:** Automatically show grid lines based on the density of the data.
- **On:** Always show grid lines.
- **Off:** Never show grid lines.

### Color

Set the color of the axis.

- **Text:** Set the color based on theme text color.
- **Series:** Set the color based on the series color.

### Show border

Set the axis border visibility.

### Scale

Set the y-axis values scale.

- **Linear:** Divides the scale into equal parts.
- **Logarithmic:** Use a logarithmic scale. When you select this option, a list appears for you to choose a binary (base 2) or common (base 10) logarithmic scale.
- **Symlog:** Use a symmetrical logarithmic scale. When you select this option, a list appears for you to choose a binary (base 2) or common (base 10) logarithmic scale. The linear threshold option allows you to set the threshold at which the scale changes from linear to logarithmic.

### Centered zero

Set the y-axis to be centered on zero.

### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of y-axis limits. By default, Grafana sets the range for the y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent small variations in the data from being magnified when it's mostly flat. In contrast, hard min and max values help prevent obscuring useful detail in the data by clipping intermittent spikes past a specific point.

To define hard limits of the y-axis, set standard min/max options. For more information, refer to [Configure standard options][].

![Label example](/static/img/docs/time-series-panel/axis-soft-min-max-7-4.png)

### Transform

Use this option to transform the series values without affecting the values shown in the tooltip, context menu, or legend.

- **Negative Y transform:** Flip the results to negative values on the Y axis.
- **Constant:** Show the first value as a constant line.

{{% admonition type="note" %}}
The transform option is only available as an override.
{{% /admonition %}}

{{< docs/shared lookup="visualizations/multiple-y-axes.md" source="grafana" version="<GRAFANA VERSION>" leveloffset="+2" >}}

## Other visualization options

### Panel options

Learn about [panel options][] that you can set for a visualization.

### Standard options

Learn about [standard options][] that you can set for a visualization.

### Data links

Learn about [data links][] that you can set for a visualization.

### Field overrides

Learn about [field overrides][Configure field overrides] that you can set for a visualization.

{{% docs/reference %}}
[Color scheme]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-standard-options#color-scheme"
[Color scheme]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options#color-scheme"

[Add a field override]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-overrides#add-a-field-override"
[Add a field override]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides#add-a-field-override"

[Configure standard options]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-standard-options#max"
[Configure standard options]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options#max"

[color scheme]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-standard-options#color-scheme"
[color scheme]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options#color-scheme"

[Configure field overrides]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-overrides"
[Configure field overrides]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides"

[panel options]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-panel-options"
[panel options]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-panel-options"

[standard options]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-standard-options"
[standard options]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options"

[data links]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-data-links"
[data links]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-data-links"
{{% /docs/reference %}}
