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
---

# Time series

Time series visualizations are the default and primary way to visualize data points over intervals of time as a graph. They can render series as lines, points, or bars. They're versatile enough to display almost any time-series data.

{{< figure src="/static/img/docs/time-series-panel/time_series_small_example.png" max-width="1200px" alt="Time series" >}}

{{< admonition type="note" >}}
You can migrate from the old Graph visualization to the new time series visualization. To migrate, open the panel and click the **Migrate** button in the side pane.
{{< /admonition >}}

## Configure a time series visualization

The following video guides you through the creation steps and common customizations of time series visualizations and is great for beginners:

{{< youtube id="RKtW87cPxsw" >}}

{{< docs/play title="Time Series Visualizations in Grafana" url="https://play.grafana.org/d/000000016/" >}}

## Supported data formats

Time series visualizations require time series data; that is a sequence of measurements, ordered in time, where every row in the table represents one individual measurement at a specific time. Learn more about [time series data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries/).

## Alert rules

You can [link alert rules](ref:link-alert) to time series visualizations to observe when alerts fire and are resolved in the form of annotations. In addition, you can create alert rules from the **Alert** tab within the panel editor.

## Transform override property

Use the **Transform** override property to transform series values without affecting the values shown in the tooltip, context menu, or legend.

<!-- add more information about how to access this property -->

- **Negative Y transform:** Flip the results to negative values on the Y axis.
- **Constant:** Show the first value as a constant line.

{{< docs/shared lookup="visualizations/multiple-y-axes.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

<!-- update shared filed above to add actual steps for adding this override -->

## Add the Fill below to override

The **Fill below to** option fills the area between two series. This option is only available as a series/field override.

1. Edit the panel and click **Overrides**.
1. Select the fields to fill below.
1. In **Add override property**, select **Fill below to**.
1. Select the series for which you want the fill to stop.

The following example shows three series: Min, Max, and Value. The Min and Max series have **Line width** set to 0. Max has a **Fill below to** override set to Min, which fills the area between Max and Min with the Max line color.

{{< figure src="/static/img/docs/time-series-panel/fill-below-to-7-4.png" max-width="600px" alt="Fill below to example" >}}

## Configuration options

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-2.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1">}}

### Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Axis options

Options under the axis category change how the x- and y-axes are rendered. Some options do not take effect until you click outside of the field option box you are editing. You can also or press `Enter`.

| Option                             | Description                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time zone                          | Set the desired time zone(s) to display along the x-axis.                                                                                                                                                                                                                                                                                                                         |
| [Placement](#placement)            | Select the placement of the y-axis.                                                                                                                                                                                                                                                                                                                                               |
| Label                              | Set a y-axis text label. If you have more than one y-axis, then you can assign different labels using an override.                                                                                                                                                                                                                                                                |
| Width                              | Set a fixed width of the axis. By default, Grafana dynamically calculates the width of an axis. By setting the width of the axis, data with different axes types can share the same display proportions. This setting makes it easier for you to compare more than one graph’s worth of data because the axes are not shifted or stretched within visual proximity to each other. |
| Show grid lines                    | Set the axis grid line visibility.<br>                                                                                                                                                                                                                                                                                                                                            |
| Color                              | Set the color of the axis.                                                                                                                                                                                                                                                                                                                                                        |
| Show border                        | Set the axis border visibility.                                                                                                                                                                                                                                                                                                                                                   |
| Scale                              | Set the y-axis values scale.<br>                                                                                                                                                                                                                                                                                                                                                  |
| Centered zero                      | Set the y-axis to be centered on zero.                                                                                                                                                                                                                                                                                                                                            |
| [Soft min](#soft-min-and-soft-max) | Set a soft min to better control the y-axis limits. zero.                                                                                                                                                                                                                                                                                                                         |
| [Soft max](#soft-min-and-soft-max) | Set a soft max to better control the y-axis limits. zero.                                                                                                                                                                                                                                                                                                                         |

#### Placement

Select the placement of the y-axis.

- **Auto:** Automatically assigns the y-axis to the series. When there are two or more series with different units, Grafana assigns the left axis to the first unit and the right axis to the units that follow.
- **Left:** Display all y-axes on the left side.
- **Right:** Display all y-axes on the right side.
- **Hidden:** Hide all axes. To selectively hide axes, [Add a field override](ref:add-a-field-override) that targets specific fields.

#### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of y-axis limits. By default, Grafana sets the range for the y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent small variations in the data from being magnified when it's mostly flat. In contrast, hard min and max values help prevent obscuring useful detail in the data by clipping intermittent spikes past a specific point.

To define hard limits of the y-axis, set standard min/max options. For more information, refer to [Configure standard options](ref:configure-standard-options).

![Label example](/static/img/docs/time-series-panel/axis-soft-min-max-7-4.png)

### Graph styles options

| Option                                      | Description                                                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Style](#style)                             | Use this option to define how to display your time series data.                                                                                                                                                                       |
| [Line interpolation](#line-interpolation)   | This option controls how the graph interpolates the series line.                                                                                                                                                                      |
| [Line width](#line-width)                   | Line width is a slider that controls the thickness for series lines or the outline for bars.                                                                                                                                          |
| [Fill opacity](#fill-opacity)               | Use opacity to specify the series area fill color.                                                                                                                                                                                    |
| [Gradient mode](#gradient-mode)             | Gradient mode specifies the gradient fill, which is based on the series color.                                                                                                                                                        |
| [Line style](#line-style)                   | Set the style of the line.                                                                                                                                                                                                            |
| [Connect null values](#connect-null-values) | Choose how null values, which are gaps in the data, appear on the graph.                                                                                                                                                              |
| [Disconnect values](#disconnect-values)     | Choose whether to set a threshold above which values in the data should be disconnected.                                                                                                                                              |
| [Show points](#show-points)                 | You can configure your visualization to add points to lines or bars.                                                                                                                                                                  |
| Point size                                  | Set the size of the points, from 1 to 40 pixels in diameter.                                                                                                                                                                          |
| [Stack series](#stack-series)               | Stacking allows Grafana to display series on top of each other.                                                                                                                                                                       |
| [Bar alignment](#bar-alignment)             | Set the position of the bar relative to a data point.                                                                                                                                                                                 |
| Bar width factor                            | Set the width of the bar relative to minimum space between data points. A factor of 0.5 means that the bars take up half of the available space between data points. A factor of 1.0 means that the bars take up all available space. |

#### Style

Use this option to define how to display your time series data. You can use overrides to combine multiple styles in the same graph.

- Lines
- Bars
- Points

![Style modes](/static/img/docs/time-series-panel/style-modes-v9.png)

#### Line interpolation

This option controls how the graph interpolates the series line.

- **Linear:** Points are joined by straight lines.
- **Smooth:** Points are joined by curved lines that smooths transitions between points.
- **Step before:** The line is displayed as steps between points. Points are rendered at the end of the step.
- **Step after:** The line is displayed as steps between points. Points are rendered at the beginning of the step.

#### Line width

Line width is a slider that controls the thickness for series lines or the outline for bars.

#### Fill opacity

Use opacity to specify the series area fill color.

![Fill opacity examples](/static/img/docs/time-series-panel/fill-opacity.png)

#### Gradient mode

Gradient mode specifies the gradient fill, which is based on the series color. To change the color, use the standard color scheme field option. For more information, refer to [Color scheme](ref:color-scheme).

- **None:** No gradient fill. This is the default setting.
- **Opacity:** An opacity gradient where the opacity of the fill increases as y-axis values increase.
- **Hue:** A subtle gradient that is based on the hue of the series color.
- **Scheme:** A color gradient defined by your [Color scheme](ref:color-scheme). This setting is used for the fill area and line. For more information about scheme, refer to [Scheme gradient mode](#scheme-gradient-mode).

Gradient appearance is influenced by the **Fill opacity** setting. The following image show, the **Fill opacity** is set to 50.

![Gradient mode examples](/static/img/docs/time-series-panel/gradient-modes-v9.png)

##### Scheme gradient mode

The **Gradient mode** option located under the **Graph styles** has a mode named **Scheme**. When you enable **Scheme**, the line or bar receives a gradient color defined from the selected **Color scheme**.

###### From thresholds

If the **Color scheme** is set to **From thresholds (by value)** and **Gradient mode** is set to **Scheme**, then the line or bar color changes as they cross the defined thresholds.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_line.png" max-width="1200px" alt="Colors scheme: From thresholds" >}}

###### Gradient color schemes

The following image shows a line chart with the **Green-Yellow-Red (by value)** color scheme option selected.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_line.png" max-width="1200px" alt="Color scheme: Green-Yellow-Red" >}}

#### Line style

Set the style of the line. To change the color, use the standard [color scheme](ref:color-scheme) field option.

- **Solid:** Display a solid line. This is the default setting.
- **Dash:** Display a dashed line. When you choose this option, a list appears for you to select the length and gap (length, gap) for the line dashes. Dash spacing set to 10, 10 (default).
- **Dots:** Display dotted lines. When you choose this option, a list appears for you to select the gap (length = 0, gap) for the dot spacing. Dot spacing set to 0, 10 (default)

![Line styles examples](/static/img/docs/time-series-panel/line-styles-examples-v9.png)

{{< docs/shared lookup="visualizations/connect-null-values.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="visualizations/disconnect-values.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

#### Show points

You can configure your visualization to add points to lines or bars.

- **Auto:** Grafana determines to show or not to show points based on the density of the data. If the density is low, then points appear.
- **Always:** Show the points regardless of how dense the data set is.
- **Never:** Do not show points.

#### Stack series

_Stacking_ allows Grafana to display series on top of each other. Be cautious when using stacking in the visualization as it can easily create misleading graphs. To read more about why stacking might not be the best approach, refer to [The issue with stacking](https://www.data-to-viz.com/caveat/stacking.html).

- **Off:** Turns off series stacking. When **Off**, all series share the same space in the visualization.
- **Normal:** Stacks series on top of each other.
- **100%:** Stack by percentage where all series add up to 100%.

##### Stack series in groups

The stacking group option is only available as an override. For more information about creating an override, refer to [Configure field overrides](ref:configure-field-overrides).

1. Edit the panel and click **Overrides**.
1. Create a field override for the **Stack series** option.
1. In stacking mode, click **Normal**.
1. Name the stacking group in which you want the series to appear.

   The stacking group name option is only available when you create an override.

#### Bar alignment

Set the position of the bar relative to a data point. In the examples below, **Show points** is set to **Always** which makes it easier to see the difference this setting makes. The points do not change; the bars change in relationship to the points.

- **Before** ![Bar alignment before icon](/static/img/docs/time-series-panel/bar-alignment-before.png)
  The bar is drawn before the point. The point is placed on the trailing corner of the bar.
- **Center** ![Bar alignment center icon](/static/img/docs/time-series-panel/bar-alignment-center.png)
  The bar is drawn around the point. The point is placed in the center of the bar. This is the default.
- **After** ![Bar alignment after icon](/static/img/docs/time-series-panel/bar-alignment-after.png)
  The bar is drawn after the point. The point is placed on the leading corner of the bar.

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data links

{{< docs/shared lookup="visualizations/datalink-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
