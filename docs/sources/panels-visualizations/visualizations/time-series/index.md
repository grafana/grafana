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
title: Time series
weight: 90
---

# Time series

{{< figure src="/static/img/docs/time-series-panel/time_series_small_example.png" max-width="1200px" caption="Time series" >}}

The time series visualization type is the default and primary way to visualize time series data as a graph. It can render series as lines, points, or bars. It is versatile enough to display almost any time-series data. [This public demo dashboard](https://play.grafana.org/d/000000016/1-time-series-graphs?orgId=1) contains many different examples of how it can be configured and styled.

> **Note:** You can migrate from the old Graph visualization to the new Time series visualization. To migrate, open the panel and click the **Migrate** button in the side pane.

## Tooltip options

Tooltip options control the information overlay that appears when you hover over data points in the graph.

{{< docs/shared "visualizations/tooltip-mode.md" >}}

## Legend options

Legend options control the series names and statistics that appear under or to the right of the graph.

{{< docs/shared "visualizations/legend-mode.md" >}}

## Graph styles

Use this option to define how to display your time series data. You can use overrides to combine multiple styles in the same graph.

- Lines
- Bars
- Points

![Style modes](/static/img/docs/time-series-panel/style-modes-v9.png)

### Bar alignment

Set the position of the bar relative to a data point. In the examples below, **Show points** is set to **Always** which makes it easier to see the difference this setting makes. The points do not change; the bars change in relationship to the points.

- **Before** ![Bar alignment before icon](/static/img/docs/time-series-panel/bar-alignment-before.png)
  The bar is drawn before the point. The point is placed on the trailing corner of the bar.
- **Center** ![Bar alignment center icon](/static/img/docs/time-series-panel/bar-alignment-center.png)
  The bar is drawn around the point. The point is placed in the center of the bar. This is the default.
- **After** ![Bar alignment after icon](/static/img/docs/time-series-panel/bar-alignment-after.png)
  The bar is drawn after the point. The point is placed on the leading corner of the bar.

### Line width

Line width is a slider that controls the thickness for series lines or the outline for bars.

![Line thickness 5 example](/static/img/docs/time-series-panel/line-width-5.png)

### Fill opacity

Use opacity to specify the series area fill color.

![Fill opacity examples](/static/img/docs/time-series-panel/fill-opacity.png)

### Gradient mode

Gradient mode specifies the gradient fill, which is based on the series color. To change the color, use the standard color scheme field option. For more information, refer to [Color scheme]({{< relref "../../configure-standard-options/#color-scheme" >}}).

- **None:** No gradient fill. This is the default setting.
- **Opacity:** An opacity gradient where the opacity of the fill increases as Y-axis values increase.
- **Hue:** A subtle gradient that is based on the hue of the series color.
- **Scheme:** A color gradient defined by your [Color scheme]({{< relref "../../configure-standard-options/#color-scheme" >}}). This setting is used for the fill area and line. For more information about scheme, refer to [Scheme gradient mode]({{< relref "#cheme-gradient-mode"  >}}).

Gradient appearance is influenced by the **Fill opacity** setting. The following image show, the **Fill opacity** is set to 50.

![Gradient mode examples](/static/img/docs/time-series-panel/gradient-modes-v9.png)

### Show points

You can configure your visualization to add points to lines or bars.

- **Auto:** Grafana determines to show or not to show points based on the density of the data. If the density is low, then points appear.
- **Always:** Show the points regardless of how dense the data set is.
- **Never:** Do not show points.

### Point size

Set the size of the points, from 1 to 40 pixels in diameter.

### Line interpolation

This option controls how the graph interpolates the series line.

![Line interpolation option](/static/img/docs/time-series-panel/line-interpolation-option.png)

- **Linear:** Points are joined by straight lines.
- **Smooth:** Points are joined by curved lines that smooths transitions between points.
- **Step before:** The line is displayed as steps between points. Points are rendered at the end of the step.
- **Step after:** The line is displayed as steps between points. Points are rendered at the beginning of the step.

### Line style

Set the style of the line. To change the color, use the standard [color scheme]({{< relref "../../configure-standard-options/#color-scheme" >}}) field option.

![Line style option](/static/img/docs/time-series-panel/line-style-option-v9.png)

- **Solid:** Display a solid line. This is the default setting.
- **Dash:** Display a dashed line. When you choose this option, a list appears for you to select the length and gap (length, gap) for the line dashes. Dash spacing set to 10, 10 (default).
- **Dots:** Display dotted lines. When you choose this option, a list appears for you to select the gap (length = 0, gap) for the dot spacing. Dot spacing set to 0, 10 (default)

![Line styles examples](/static/img/docs/time-series-panel/line-styles-examples-v9.png)

### Connect null values

Choose how null values, which are gaps in the data, appear on the graph. Null values can be connected to form a continuous line or set to a threshold above which gaps in the data are no longer connected.

![Connect null values option](/static/img/docs/time-series-panel/connect-null-values-option-v9.png)

- **Never:** Time series data points with gaps in the the data are never connected.
- **Always:** Time series data points with gaps in the the data are always connected.
- **Threshold:** Specify a threshold above which gaps in the data are no longer connected. This can be useful when the connected gaps in the data are of a known size and/or within a known range, and gaps outside this range should no longer be connected.

### Stack series

_Stacking_ allows Grafana to display series on top of each other. Be cautious when using stacking in the visualization as it can easily create misleading graphs. To read more about why stacking might not be the best approach, refer to [Stacked Area Graphs Are Not Your Friend](https://everydayanalytics.ca/2014/08/stacked-area-graphs-are-not-your-friend.html).

![Stack option](/static/img/docs/time-series-panel/stack-option-v9.png)

- **Off:** Turns off series stacking. When **Off**, all series share the same space in the visualization.
- **Normal:** Stacks series on top of each other.
- **100%:** Stack by percentage where all series add up to 100%.

#### Stack series in groups

The stacking group option is only available as an override. For more information about creating an override, refer to [Configure field overrides]({{< relref "../../configure-overrides" >}}).

1. Edit the panel and click **Overrides**.
1. Create a field override for the **Stack series** option.
1. In stacking mode, click **Normal**.
1. Name the stacking group in which you want the series to appear.

   The stacking group name option is only available when you create an override.

### Fill below to

The **Fill below to** option fills the area between two series. This option is only available as a series/field override.

1. Edit the panel and click **Overrides**.
1. Select the fields to fill below.
1. In **Add override property**, select **Fill below to**.
1. Select the series for which you want the fill to stop.

The following example shows three series: Min, Max, and Value. The Min and Max series have **Line width** set to 0. Max has a **Fill below to** override set to Min, which fills the area between Max and Min with the Max line color.

{{< figure src="/static/img/docs/time-series-panel/fill-below-to-7-4.png" max-width="600px" caption="Fill below to example" >}}

## Axis options

Options under the axis category change how the X and Y axes are rendered. Some options do not take effect until you click outside of the field option box you are editing. You can also or press `Enter`.

### Placement

Select the placement of the Y-axis.

- **Auto:** Automatically assigns the Y-axis to the series. When there are two or more series with different units, Grafana assigns the left axis to the first unit and the right axis to the units that follow.
- **Left:** Display all Y-axes on the left side.
- **Right:** Display all Y-axes on the right side.
- **Hidden:** Hide all axes.

To selectively hide axes, [Add a field override]({{< relref "../../configure-overrides#add-a-field-override" >}}) that targets specific fields.

### Label

Set a Y-axis text label. If you have more than one Y-axis, then you can assign different labels using an override.

### Width

Set a fixed width of the axis. By default, Grafana dynamically calculates the width of an axis.

By setting the width of the axis, data with different axes types can share the same display proportions. This setting makes it easier for you to compare more than one graph’s worth of data because the axes are not shifted or stretched within visual proximity to each other.

### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of Y-axis limits. By default, Grafana sets the range for the Y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent blips from turning into mountains when the data is mostly flat, and hard min or max derived from standard min and max field options can prevent intermittent spikes from flattening useful detail by clipping the spikes past a specific point.

To define hard limits of the Y-axis, You can set standard min/max options. For more information, refer to [Configure standard options]({{< relref "../../configure-standard-options/#max" >}}).

![Label example](/static/img/docs/time-series-panel/axis-soft-min-max-7-4.png)

### Scale

Set the Y-axis values scale.

- **Linear:** Divides the scale into equal parts.
- **Logarithmic:** Use a logarithmic scale. When you select this option, a list appears for you to choose a binary (base 2) or common (base 10) logarithmic scale.

### Transform

Use this option to transform the series values without affecting the values shown in the tooltip, context menu, or legend.

- **Negative Y transform:** Flip the results to negative values on the Y axis.
- **Constant:** Show the first value as a constant line.

> **Note:** The transform option is only available as an override.

## Color options

By default, the graph uses the standard [Color scheme]({{< relref "../../configure-standard-options/#color-scheme" >}} option to assign series colors. You can also use the legend to open the color picker by clicking the legend series color icon. Setting
color this way automatically creates an override rule that set's a specific color for a specific series.

### Classic palette

The most common setup is to use the **Classic palette** for graphs. This scheme automatically assigns a color for each field or series based on its order. If the order of a field changes in your query, the color also changes. You can manually configure a color for a specific field using an override rule.

### Single color

Use this mode to specify a color. You can also click the colored line icon next to each series in the Legend to open the color picker. This automatically creates a new override that sets the color scheme to single color and the selected color.

### By value color schemes

If you select a by value color scheme like **From thresholds (by value)** or **Green-Yellow-Red (by value)**, the **Color series by** option appears. This option controls which value (Last, Min, Max) to use to assign the series its color.

### Scheme gradient mode

The **Gradient mode** option located under the **Graph styles** has a mode named **Scheme**. When you enable **Scheme**, the line or bar receives a gradient color defined from the selected **Color scheme**.

#### From thresholds

If the **Color scheme** is set to **From thresholds (by value)** and **Gradient mode** is set to **Scheme**, then the line or bar color changes as they cross the defined thresholds.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_line.png" max-width="1200px" caption="Colors scheme: From thresholds" >}}

The following image shows bars mode enabled.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_bars.png" max-width="1200px" caption="Color scheme: From thresholds" >}}

#### Gradient color schemes

The following image shows a line chart with the **Green-Yellow-Red (by value)** color scheme option selected.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_line.png" max-width="1200px" caption="Color scheme: Green-Yellow-Red" >}}

The following image shows a bar chart with the **Green-Yellow-Red (by value)** color scheme option selected.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_bars.png" max-width="1200px" caption="Color scheme: Green-Yellow-Red" >}}
