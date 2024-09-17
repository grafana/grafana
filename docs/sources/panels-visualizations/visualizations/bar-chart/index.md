---
aliases:
  - ../../panels/visualizations/bar-chart/
  - ../../visualizations/bar-chart/
description: Configure options for Grafana's bar chart visualization
keywords:
  - grafana
  - docs
  - bar chart
  - panel
  - barchart
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Bar chart
weight: 100
refs:
  standard-calculations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/calculation-types/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types/
  standard-options-definitions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#max
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#max
  add-a-field-override:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/#add-a-field-override
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/#add-a-field-override
  configure-data-links:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-data-links/
---

# Bar chart

A bar chart is a visual representation that uses rectangular bars, where the length of each bar represents each value.
You can use the bar chart visualization when you want to compare values over different categories or time periods. The visualization can display the bars horizontally or vertically, and can be customized to group or stack bars for more complex data analysis.

{{< figure src="/static/img/docs/bar-chart-panel/barchart_small_example.png" max-width="1000px" alt="Bar chart" >}}

You can use the bar chart visualization if you need to show:

- Population distribution by age or location
- CPU usage per application
- Sales per division
- Server cost distribution

## Configure a bar chart

The following video shows you how to create and configure a bar chart visualization:

{{< youtube id="qyKE9-71KkE" >}}

{{< docs/play title="Grafana Bar Charts and Pie Charts" url="https://play.grafana.org/d/ktMs4D6Mk/" >}}

## Supported data formats

To create a bar chart visualization, you need a dataset containing one string or time field (or column) and at least one numeric field, though preferably more than one to make best use of the visualization.

The text or time field is used to label the bars or values in each row of data and the numeric fields are represented by proportionally sized bars.

### Example 1

| Group | Value1 | Value2 | Value3 |
| ----- | ------ | ------ | ------ |
| uno   | 5      | 3      | 2      |

![Bar chart single row example](/media/docs/grafana/panels-visualizations/screenshot-grafana-11.1-barchart-example1.png 'Bar chart single row example')

If you have more than one text or time field, by default, the visualization uses the first one, but you can change this in the x-axis option as described in the [Bar chart options](#bar-chart-options) section.

### Example 2

If your dataset contains multiple rows, the visualization displays multiple bar chart groups where each group contains multiple bars representing all the numeric values for a row.

| Group | Value1 | Value2 | Value3 |
| ----- | ------ | ------ | ------ |
| uno   | 5      | 3      | 2      |
| dos   | 10     | 6      | 4      |
| tres  | 20     | 8      | 2      |

![Bar chart multiple row example](/media/docs/grafana/panels-visualizations/screenshot-grafana-11.1-barchart-example2.png 'Bar chart multiple row example')

While the first field can be time-based and you can use a bar chart to plot time-series data, for large amounts of time-series data, we recommend that you use the [time series visualization](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/) and configure it to be displayed as bars.

We recommend that you only use one dataset in a bar chart because using multiple datasets can result in unexpected behavior.

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Bar chart options

Use these options to refine your visualization.

### X Axis

Specify which field is used for the x-axis.

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

#### Scheme gradient mode

The **Gradient mode** option located under the **Graph styles** has a mode named **Scheme**. When you enable **Scheme**, the bar receives a gradient color defined from the selected **Color scheme**.

##### From thresholds

If the **Color scheme** is set to **From thresholds (by value)** and **Gradient mode** is set to **Scheme**, then the bar color changes as they cross the defined thresholds.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_bars.png" max-width="1200px" caption="Color scheme: From thresholds" >}}

##### Gradient color schemes

The following image shows a bar chart with the **Green-Yellow-Red (by value)** color scheme option selected.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_bars.png" max-width="1200px" caption="Color scheme: Green-Yellow-Red" >}}

## Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

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

To selectively hide axes, [Add a field override](ref:add-a-field-override) that targets specific fields.

### Label

Set a Y-axis text label.

If you have more than one Y-axis, then you can give assign different labels with an override.

### Width

Set a fixed width of the axis. By default, Grafana dynamically calculates the width of an axis.

By setting the width of the axis, data whose axes types are different can share the same display proportions. This makes it easier to compare more than one graph’s worth of data because the axes are not shifted or stretched within visual proximity of each other.

### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of Y-axis limits. By default, Grafana sets the range for the Y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent blips from turning into mountains when the data is mostly flat, and hard min or max derived from standard min and max field options can prevent intermittent spikes from flattening useful detail by clipping the spikes past a defined point.

You can set standard min/max options to define hard limits of the Y-axis. For more information, refer to [Standard options definitions](ref:standard-options-definitions).

{{< docs/shared lookup="visualizations/multiple-y-axes.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+2" >}}

## Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Data links

{{< docs/shared lookup="visualizations/datalink-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
