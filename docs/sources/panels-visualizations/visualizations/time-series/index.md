---
aliases:
  - ../../features/panels/histogram/
  - ../../panels/visualizations/time-series/
  - ../../panels/visualizations/time-series/annotate-time-series/
  - ../../panels/visualizations/time-series/change-axis-display/
  - ../../panels/visualizations/time-series/graph-color-scheme/
  - ../../panels/visualizations/time-series/graph-time-series-as-bars/
  - ../../panels/visualizations/time-series/graph-time-series-as-lines/
  - ../../panels/visualizations/time-series/graph-time-series-as-points/
  - ../../panels/visualizations/time-series/graph-time-series-stacking/
  - ../../visualizations/time-series/
  - ../../visualizations/time-series/annotate-time-series/
  - ../../visualizations/time-series/change-axis-display/
  - ../../visualizations/time-series/graph-color-scheme/
  - ../../visualizations/time-series/graph-time-series-as-bars/
  - ../../visualizations/time-series/graph-time-series-as-lines/
  - ../../visualizations/time-series/graph-time-series-as-points/
  - ../../visualizations/time-series/graph-time-series-stacking/
keywords:
  - grafana
  - graph panel
  - time series panel
  - documentation
  - guide
  - graph
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's time series visualization
title: Time series
menuTitle: Time series
weight: 10
refs:
  configure-standard-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#max
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#max
  color-scheme:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#color-scheme
  add-a-field-override:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/#add-a-field-override
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/#add-a-field-override
  configure-field-overrides:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/
  link-alert:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
  panel-editor-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-editor-overview/#data-section
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/panel-editor-overview/#data-section
  data-transformation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-editor-overview/#data-section
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/panel-editor-overview/#data-section
---

# Time series

Time series visualizations are the default way to show the variations of a set of data values over time. Each data point is matched to a timestamp and this _time series_ is displayed as a graph. The visualization can render series as lines, points, or bars and it's versatile enough to display almost any type of [time-series data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries/).

{{< figure src="/static/img/docs/time-series-panel/time_series_small_example.png" max-width="1200px" alt="Time series" >}}

{{< admonition type="note" >}}
You can migrate from the legacy Graph visualization to the time series visualization. To migrate, open the panel and click the **Migrate** button in the side pane.
{{< /admonition >}}

A time series visualization displays an x-y graph with time progression on the x-axis and the magnitude of the values on the y-axis. This visualization is ideal for displaying large numbers of timed data points that would be hard to track in a table or list.

You can use the time series visualization if you need track:

- Temperature variations throughout the day
- The daily progress of your retirement account
- The distance you jog each day over the course of a year

## Configure a time series visualization

The following video guides you through the creation steps and common customizations of time series visualizations, and is great for beginners:

{{< youtube id="RKtW87cPxsw" >}}

{{< docs/play title="Time Series Visualizations in Grafana" url="https://play.grafana.org/d/000000016/" >}}

## Supported data formats

Time series visualizations require time-series data—a sequence of measurements, ordered in time, and formatted as a table—where every row in the table represents one individual measurement at a specific time. Learn more about [time-series data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries/).

The dataset must contain at least one numeric field, and in the case of multiple numeric fields, each one is plotted as a new line, point, or bar labeled with the field name in the tooltip.

### Example 1

In the following example, there are three numeric fields represented by three lines in the chart:

| Time                | value1 | value2 | value3 |
| ------------------- | ------ | ------ | ------ |
| 2022-11-01 10:00:00 | 1      | 2      | 3      |
| 2022-11-01 11:00:00 | 4      | 5      | 6      |
| 2022-11-01 12:00:00 | 7      | 8      | 9      |
| 2022-11-01 13:00:00 | 4      | 5      | 6      |

![Time series line chart with multiple numeric fields](/media/docs/grafana/panels-visualizations/screenshot-grafana-11.1-timeseries-example1v2.png 'Time series line chart with multiple numeric fields')

If the time field isn't automatically detected, you might need to convert the data to a time format using a [data transformation](ref:data-transformation).

### Example 2

The time series visualization also supports multiple datasets. If all datasets are in the correct format, the visualization plots the numeric fields of all datasets and labels them using the column name of the field.

#### Query1

| Time                | value1 | value2 | value3 |
| ------------------- | ------ | ------ | ------ |
| 2022-11-01 10:00:00 | 1      | 2      | 3      |
| 2022-11-01 11:00:00 | 4      | 5      | 6      |
| 2022-11-01 12:00:00 | 7      | 8      | 9      |

#### Query2

| timestamp           | number1 | number2 | number3 |
| ------------------- | ------- | ------- | ------- |
| 2022-11-01 10:30:00 | 11      | 12      | 13      |
| 2022-11-01 11:30:00 | 14      | 15      | 16      |
| 2022-11-01 12:30:00 | 17      | 18      | 19      |
| 2022-11-01 13:30:00 | 14      | 15      | 16      |

![Time series line chart with two datasets](/media/docs/grafana/panels-visualizations/screenshot-grafana-11.1-timeseries-example2v2.png 'Time series line chart with two datasets')

### Example 3

If you want to more easily compare events between different, but overlapping, time frames, you can do this by using a time offset while querying the compared dataset:

#### Query1

| Time                | value1 | value2 | value3 |
| ------------------- | ------ | ------ | ------ |
| 2022-11-01 10:00:00 | 1      | 2      | 3      |
| 2022-11-01 11:00:00 | 4      | 5      | 6      |
| 2022-11-01 12:00:00 | 7      | 8      | 9      |

#### Query2

| timestamp(-30min)   | number1 | number2 | number3 |
| ------------------- | ------- | ------- | ------- |
| 2022-11-01 10:30:00 | 11      | 12      | 13      |
| 2022-11-01 11:30:00 | 14      | 15      | 16      |
| 2022-11-01 12:30:00 | 17      | 18      | 19      |
| 2022-11-01 13:30:00 | 14      | 15      | 16      |

![Time Series Example with second Data Set offset](/media/docs/grafana/panels-visualizations/screenshot-grafana-11.1-timeseries-example3v2.png 'Time Series Example with second Data Set offset')

When you add the offset, the resulting visualization makes the datasets appear to be occurring at the same time so that you can compare them more easily.

## Alert rules

You can [link alert rules](ref:link-alert) to time series visualizations in the form of annotations to observe when alerts fire and are resolved. In addition, you can create alert rules from the **Alert** tab within the [panel editor](ref:panel-editor-alerts).

## Special overrides

The following overrides help you further refine a time series visualization.

### Transform override property

Use the **Graph styles > Transform** [override property](#field-overrides) to transform series values without affecting the values shown in the tooltip, context menu, or legend. Choose from the following transform options:

- **Constant** - Show the first value as a constant line.
- **Negative Y transform** - Flip the results to negative values on the y-axis.

### Fill below to override property

The **Graph styles > Fill below to** [override property](#field-overrides) fills the area between two series. When you configure the property, select the series for which you want the fill to stop.

The following example shows three series: Min, Max, and Value. The Min and Max series have **Line width** set to 0. Max has a **Fill below to** override set to Min, which fills the area between Max and Min with the Max line color.

{{< figure src="/static/img/docs/time-series-panel/fill-below-to-7-4.png" max-width="600px" alt="Fill below to example" >}}

{{< docs/shared lookup="visualizations/multiple-y-axes.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+2" >}}

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-2.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1">}}

### Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Axis options

{{< docs/shared lookup="visualizations/axis-options-all.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

#### Placement

Select the placement of the y-axis. Choose from the following:

- **Auto** - Automatically assigns the y-axis to the series. When there are two or more series with different units, Grafana assigns the left axis to the first unit and the right axis to the units that follow.
- **Left** - Display all y-axes on the left side.
- **Right** - Display all y-axes on the right side.
- **Hidden** - Hide all axes. To selectively hide axes, [Add a field override](ref:add-a-field-override) that targets specific fields.

#### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of y-axis limits. By default, Grafana sets the range for the y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent small variations in the data from being magnified when it's mostly flat. In contrast, hard min and max values help prevent obscuring useful detail in the data by clipping intermittent spikes past a specific point.

To define hard limits of the y-axis, set standard min/max options. For more information, refer to [Configure standard options](ref:configure-standard-options).

![Label example](/static/img/docs/time-series-panel/axis-soft-min-max-7-4.png)

### Graph styles options

The options under the **Graph styles** section let you control the general appearance of the graph, excluding [color](#standard-options).

| Option                                      | Description                                                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Style](#style)                             | Choose whether to display your time-series data as lines, bars, or points.                                                                                                                                                            |
| [Line interpolation](#line-interpolation)   | Choose how the graph interpolates the series line.                                                                                                                                                                                    |
| Line width                                  | Set the thickness of the series lines or the outline for bars using the **Line width** slider.                                                                                                                                        |
| [Fill opacity](#fill-opacity)               | Set the series area fill color using the **Fill opacity** slider.                                                                                                                                                                     |
| [Gradient mode](#gradient-mode)             | Choose a gradient mode to control the gradient fill, which is based on the series color.                                                                                                                                              |
| [Line style](#line-style)                   | Choose a solid, dashed, or dotted line style.                                                                                                                                                                                         |
| [Connect null values](#connect-null-values) | Choose how null values, which are gaps in the data, appear on the graph.                                                                                                                                                              |
| [Disconnect values](#disconnect-values)     | Choose whether to set a threshold above which values in the data should be disconnected.                                                                                                                                              |
| [Show points](#show-points)                 | Set whether to show data points to lines or bars.                                                                                                                                                                                     |
| Point size                                  | Set the size of the points, from 1 to 40 pixels in diameter.                                                                                                                                                                          |
| [Stack series](#stack-series)               | Set whether Grafana displays series on top of each other.                                                                                                                                                                             |
| [Bar alignment](#bar-alignment)             | Set the position of the bar relative to a data point.                                                                                                                                                                                 |
| Bar width factor                            | Set the width of the bar relative to minimum space between data points. A factor of 0.5 means that the bars take up half of the available space between data points. A factor of 1.0 means that the bars take up all available space. |

#### Style

Choose whether to display your time-series data as lines, bars, or points. You can use overrides to combine multiple styles in the same graph. Choose from the following:

![Style modes](/static/img/docs/time-series-panel/style-modes-v9.png)

#### Line interpolation

Choose how the graph interpolates the series line:

- **Linear** - Points are joined by straight lines.
- **Smooth** - Points are joined by curved lines that smooths transitions between points.
- **Step before** - The line is displayed as steps between points. Points are rendered at the end of the step.
- **Step after** - The line is displayed as steps between points. Points are rendered at the beginning of the step.

#### Line width

Set the thickness of the series lines or the outline for bars using the **Line width** slider.

#### Fill opacity

Set the series area fill color using the **Fill opacity** slider.

![Fill opacity examples](/static/img/docs/time-series-panel/fill-opacity.png)

#### Gradient mode

Choose a gradient mode to control the gradient fill, which is based on the series color. To change the color, use the standard color scheme field option. For more information, refer to [Color scheme](ref:color-scheme).

- **None** - No gradient fill. This is the default setting.
- **Opacity** - An opacity gradient where the opacity of the fill increases as y-axis values increase.
- **Hue** - A subtle gradient that's based on the hue of the series color.
- **Scheme** - A color gradient defined by your [Color scheme](ref:color-scheme). This setting is used for the fill area and line. For more information about scheme, refer to [Scheme gradient mode](#scheme-gradient-mode).

Gradient appearance is influenced by the **Fill opacity** setting. The following image shows the **Fill opacity** set to 50.

![Gradient mode examples](/static/img/docs/time-series-panel/gradient-modes-v9.png)

##### Scheme gradient mode

The **Gradient mode** option located under the **Graph styles** section has a mode called **Scheme**. When you enable **Scheme**, the line or bar receives a gradient color defined from the selected **Color scheme**.

###### From thresholds

If the **Color scheme** is set to **From thresholds (by value)** and **Gradient mode** is set to **Scheme**, then the line or bar color changes as it crosses the defined thresholds.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_line.png" max-width="1200px" alt="Colors scheme: From thresholds" >}}

###### Gradient color schemes

The following image shows a line chart with the **Green-Yellow-Red (by value)** color scheme option selected.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_line.png" max-width="1200px" alt="Color scheme: Green-Yellow-Red" >}}

#### Line style

Choose a solid, dashed, or dotted line style:

- **Solid** - Display a solid line. This is the default setting.
- **Dash** - Display a dashed line. When you choose this option, a list appears for you to select the length and gap (length, gap) for the line dashes. Dash spacing is 10, 10 by default.
- **Dots** - Display dotted lines. When you choose this option, a list appears for you to select the gap (length = 0, gap) for the dot spacing. Dot spacing is 0, 10 by default.

![Line styles examples](/static/img/docs/time-series-panel/line-styles-examples-v9.png)

{{< docs/shared lookup="visualizations/connect-null-values.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="visualizations/disconnect-values.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

To change the color, use the standard [color scheme](ref:color-scheme) field option.

#### Show points

Set whether to show data points as lines or bars. Choose from the following:

- **Auto** - Grafana determines a point's visibility based on the density of the data. If the density is low, then points appear.
- **Always** - Show the points regardless of how dense the data set is.
- **Never** - Don't show points.

#### Stack series

Set whether Grafana stacks or displays series on top of each other. Be cautious when using stacking because it can create misleading graphs. To read more about why stacking might not be the best approach, refer to [The issue with stacking](https://www.data-to-viz.com/caveat/stacking.html). Choose from the following:

- **Off** - Turns off series stacking. When **Off**, all series share the same space in the visualization.
- **Normal** - Stacks series on top of each other.
- **100%** - Stack by percentage where all series add up to 100%.

##### Stack series in groups

The stacking group option is only available as an override. For more information about creating an override, refer to [Configure field overrides](ref:configure-field-overrides).

1. Edit the panel and click **Overrides**.
1. Create a field override for the **Stack series** option.
1. In stacking mode, click **Normal**.
1. Name the stacking group in which you want the series to appear.

   The stacking group name option is only available when you create an override.

#### Bar alignment

Set the position of the bar relative to a data point. In the examples below, **Show points** is set to **Always** which makes it easier to see the difference this setting makes. The points don't change, but the bars change in relationship to the points. Choose from the following:

- **Before** ![Bar alignment before icon](/static/img/docs/time-series-panel/bar-alignment-before.png)
  The bar is drawn before the point. The point is placed on the trailing corner of the bar.
- **Center** ![Bar alignment center icon](/static/img/docs/time-series-panel/bar-alignment-center.png)
  The bar is drawn around the point. The point is placed in the center of the bar. This is the default.
- **After** ![Bar alignment after icon](/static/img/docs/time-series-panel/bar-alignment-after.png)
  The bar is drawn after the point. The point is placed on the leading corner of the bar.

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data links and actions

{{< docs/shared lookup="visualizations/datalink-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
