---
aliases:
  - /docs/grafana/latest/panels/visualizations/time-series/
  - /docs/grafana/latest/visualizations/time-series/
  - /docs/grafana/latest/panels/visualizations/time-series/annotate-time-series/
  - /docs/grafana/latest/visualizations/time-series/annotate-time-series/
  - /docs/grafana/latest/panels/visualizations/time-series/change-axis-display/
  - /docs/grafana/latest/visualizations/time-series/change-axis-display/
  - /docs/grafana/latest/panels/visualizations/time-series/graph-color-scheme/
  - /docs/grafana/latest/visualizations/time-series/graph-color-scheme/
  - /docs/grafana/latest/panels/visualizations/time-series/graph-time-series-as-bars/
  - /docs/grafana/latest/visualizations/time-series/graph-time-series-as-bars/
  - /docs/grafana/latest/panels/visualizations/time-series/graph-time-series-as-lines/
  - /docs/grafana/latest/visualizations/time-series/graph-time-series-as-lines/
  - /docs/grafana/latest/panels/visualizations/time-series/graph-time-series-as-points/
  - /docs/grafana/latest/visualizations/time-series/graph-time-series-as-points/
  - /docs/grafana/latest/features/panels/histogram/
  - /docs/grafana/latest/panels/visualizations/time-series/graph-time-series-stacking/
  - /docs/grafana/latest/visualizations/time-series/graph-time-series-stacking/
keywords:
  - grafana
  - graph panel
  - time series panel
  - documentation
  - guide
  - graph
title: Time series
weight: 1200
---

# Time series

{{< figure src="/static/img/docs/time-series-panel/time_series_small_example.png" max-width="1200px" caption="Time series" >}}

Time series visualization is the default and primary way to visualize time series data. It can render as a line, a path of dots, or a series of bars. It is versatile enough to display almost any time-series data. [This public demo dashboard](https://play.grafana.org/d/000000016/1-time-series-graphs?orgId=1) contains many different examples for how this visualization can be configured and styled.

> **Note:** You can migrate Graph panel visualizations to Time series visualizations. To migrate, open the panel and then select the **Time series** visualization. Grafana transfers all applicable settings.

{{< docs/shared "visualizations/tooltip-mode.md" >}}

{{< docs/shared "visualizations/legend-mode.md" >}}

### Legend calculations

Choose which of the [standard calculations]({{< relref "../../panels/calculation-types/" >}}) to show in the legend. You can have more than one.

For more information about the legend, refer to [Configure a legend](../configure-legend/).

## Graph styles

Use these options to choose how to display your time series data.

- Lines
- Bars
- Points

![Style modes](http://localhost:3002//static/img/docs/time-series-panel/style-modes-v9.png)

### Bar alignment

Set the position of the bar relative to a data point. In the examples below, **Show points** is set to **Always** to make it easier to see the difference this setting makes. The points do not change; the bars change in relationship to the points.

- **Before** ![Bar alignment before icon](http://localhost:3002/static/img/docs/time-series-panel/bar-alignment-before.png)
  The bar is drawn before the point. The point is placed on the trailing corner of the bar.
- **Center** ![Bar alignment center icon](http://localhost:3002/static/img/docs/time-series-panel/bar-alignment-center.png)
  The bar is drawn around the point. The point is placed in the center of the bar. This is the default.
- **After** ![Bar alignment after icon](http://localhost:3002/static/img/docs/time-series-panel/bar-alignment-after.png)
  The bar is drawn after the point. The point is placed on the leading corner of the bar.

### Line width

Line width is a slider that controls the thickness for series lines or the outline for bars.

![Line thickness 5 example](http://localhost:3002//static/img/docs/time-series-panel/line-width-5.png)

### Fill opacity

Set the opacity series area fill color.

![Fill opacity examples](http://localhost:3002/static/img/docs/time-series-panel/fill-opacity.png)

### Gradient mode

Sets the mode of the gradient fill. Fill gradient is based on the series color. To change the color, use the standard color scheme field option. For more information, refer to [Color scheme]({{< relref "../../panels/configure-standard-options/#color-scheme" >}}).

- **None** - No gradient fill. This is the default setting.
- **Opacity** - An opacity gradient where the opacity of the fill is increasing with the values on the Y-axis.
- **Hue** - A subtle gradient that based on the hue of the series color.
- **Scheme** - A color gradient defined by your [Color scheme]({{< relref "../../panels/configure-standard-options/#color-scheme" >}}). This will be used for both the fill area and line. There is more information on this option in [Scheme gradient mode]({{< relref "#cheme-gradient-mode"  >}}).

Gradient appearance is influenced by the **Fill opacity** setting. In the screenshots below, **Fill opacity** is set to 50.

![Gradient mode examples](http://localhost:3002/static/img/docs/time-series-panel/gradient-modes-v9.png)

### Show points

When rendering lines or bars you can still configure the visualization to render points.

- **Auto** - Will automatically decide whether or not to show the points depending on the density of the data. If the density is low, then points are shown.
- **Always** - Show the points no matter how dense the data set is.
- **Never** - Will never show the points.

### Point size

Set the size of the points, from 1 to 40 pixels in diameter.

### Line interpolation

This option controls how the graph should interpolates the series line.

![Line interpolation option](http://localhost:3002/static/img/docs/time-series-panel/line-interpolation-option.png)

- **Linear** - Points are joined by straight lines.
- **Smooth** - Points are joined by curved lines resulting in smooth transitions between points.
- **Step before** - The line is displayed as steps between points. Points are rendered at the end of the step.
- **Step after** - Line is displayed as steps between points. Points are rendered at the beginning of the step.

### Line style

Set the style of the line. To change the color, use the standard [color scheme]({{< relref "../../panels/configure-standard-options/#color-scheme" >}}) field option.

![Line style option](http://localhost:3002/static/img/docs/time-series-panel/line-style-option-v9.png)

- **Solid** - Display solid line. This is the default setting.
- **Dash** - Display a dashed line. When you choose this option, a list appears so that you can select the length and gap (length, gap) for the line dashes. Dash spacing set to 10, 10 (default).
- **Dots** - Display dotted lines. When you choose this option, a list appears so that you can select the gap (length = 0, gap) for the dot spacing. Dot spacing set to 0, 10 (default)

![Line styles examples](http://localhost:3002/static/img/docs/time-series-panel/line-styles-examples-v9.png)

### Connect null values

Choose how null values (gaps in the data) are displayed on the graph. Null values can be connected to form a continuous line or, optionally, set a threshold above which gaps in the data should no longer be connected.

![Connect null values option](http://localhost:3002/static/img/docs/time-series-panel/connect-null-values-option-v9.png)

- **Never** - Time series data points with gaps in the the data are never connected.
- **Always** - Time series data points with gaps in the the data are always connected.
- **Threshold** - A threshold can be set above which gaps in the data should no longer be connected. This can be useful when the connected gaps in the data are of a known size and/or within a known range and gaps outside this range should no longer be connected.

### Fill below to

This option is only available as series / field an override.

Fill the area between two series. On the Overrides tab:

1. Select the fields to fill below.
1. In **Add override property**, select **Fill below to**.
1. Select the series that you want the fill to stop at.

This example below shows three series: Min, Max, and Value. The Min and Max series have **Line width** set to 0. Max has a **Fill below to** override set to Min, which fills the area between Max and Min with the Max line color.

{{< figure src="/static/img/docs/time-series-panel/fill-below-to-7-4.png" max-width="600px" caption="Fill below to example" >}}

{{< docs/shared "visualizations/change-axis-link.md" >}}

### Stack series

_Stacking_ allows Grafana to display series on top of each other. Be cautious when using stacking in the visualization as it can easily create misleading graphs. You can read more on why stacking may be not the best approach here: [Stacked Area Graphs Are Not Your Friend](https://everydayanalytics.ca/2014/08/stacked-area-graphs-are-not-your-friend.html).

![Stack option](http://localhost:3002/static/img/docs/time-series-panel/stack-option-v9.png)

- **Off** - Turn off series stacking. A series will share the same space in the visualization.
- **Normal** - Enable stacking series on top of each other.
- **100%** - Stack by percentage where all series will always add up to 100%.

#### Stack series in groups

The stacking group option is only available as an override. For more information about creating an overrides, refer to [About field overrides]({{< relref "../../panels/override-field-values/about-field-overrides/" >}}).

Stack series in the same group. In the Overrides section:

1. Create a field override for **Stack series** option.
1. Click on **Normal** stacking mode.
1. Name the stacking group you want the series to appear in. The stacking group name option is only available when creating an override.

## Axis options

Use the following field settings to refine how your axes display. Some field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

### Placement

Select the placement of the Y-axis.

- **Auto** - Automatically assigns Y-axis to the series. When there are two or more series with different units, then Grafana assigns the left axis to the first unit and right to the following units.
- **Left** - Display all Y-axes on the left side.
- **Right** - Display all Y-axes on the right side.
- **Hidden** Hide all axes.

To selectively hide axes, [add an override]({{< relref "../../panels/override-field-values/add-a-field-override/" >}}) targeting specific fields.

### Label

Set a Y-axis text label. If you have more than one Y-axis, then you can give assign different labels using an override.

### Width

Set a fixed width of the axis. By default, Grafana dynamically calculates the width of an axis.

By setting the width of the axis, data whose axes types are different can share the same display proportions. This makes it easier to compare more than one graph’s worth of data because the axes are not shifted or stretched within visual proximity of each other.

### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of Y-axis limits. By default, Grafana sets the range for the Y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent blips from turning into mountains when the data is mostly flat, and hard min or max derived from standard min and max field options can prevent intermittent spikes from flattening useful detail by clipping the spikes past a defined point.

You can set standard min/max options to define hard limits of the Y-axis. For more information, refer to [Configure standard options]({{< relref "../../panels/configure-standard-options/#max" >}}).

![Label example](/static/img/docs/time-series-panel/axis-soft-min-max-7-4.png)

### Scale

Set the scale to use for the Y-axis values.

- **Linear** - Use scale divided into equal parts.
- **Logarithmic** - Use a logarithmic scale. When this option is chosen, a list appears where you can choose binary (base 2) or common (base 10) logarithmic scale.

### Transform

Use this option to transform the series values without affecting the values shown in the tooltip, context menu, and legend.

- **Negative Y transform:** Flip the results to negative values on the Y axis.
- **Constant:** Show first value as a constant line.

> **Note:** The transform option is only available as an override.

## Color options

By default the graph will use the standard [Color scheme]({{< relref "../../panels/configure-standard-options/#color-scheme" >}} option to assign series colors. You can also use the legend to open the color picker by clicking the legend series color icon. Setting
color this way will automatically create an override rule that set's a specific color for a specific series.

### Classic palette

The most common setup is to use the **Classic palette** for graphs. This scheme will automatically assign a color for each field or series based on it's order. So if the order of a field change in your query the color will also change. You can manually configure a color for a specific field using an override rule.

### Single color

Use this mode to set a specific color. You can also click the colored line icon next to each series in the Legend to open the color picker. This will automatically create new override that sets the color scheme to single color and the selected color.

### By value color schemes

If you select a by value color scheme like **From thresholds (by value)** or **Green-Yellow-Red (by value)** another option named **Color series by** will show up. This option control what value (Last, Min, Max) to use to assign the series its color.

### Scheme gradient mode

The **Gradient mode** option located under the **Graph styles** has a mode named **Scheme**. When this mode is enabled the whole line or bar gets a gradient color defined from the selected **Color scheme**.

#### From thresholds

If the **Color scheme** is set to **From thresholds (by value)** and **Gradient mode** is set to **Scheme** then the line or bar color will change as they cross the thresholds defined.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_line.png" max-width="1200px" caption="Colors scheme: From thresholds" >}}

If you have enabled bars mode it would look like this:

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_bars.png" max-width="1200px" caption="Color scheme: From thresholds" >}}

#### Gradient color schemes

If you have a selected a **Color scheme** like **Green-Yellow-Red (by value)** then it would look like this:

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_line.png" max-width="1200px" caption="Color scheme: Green-Yellow-Red" >}}

If you have enabled bars mode it would look like this:

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_bars.png" max-width="1200px" caption="Color scheme: Green-Yellow-Red" >}}
