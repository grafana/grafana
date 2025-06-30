---
title: Graph styles options
comments: |
  This file is used in the following visualizations: time series.
---

<!-- prettier-ignore-start -->

| Option                                      | Description                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Style](#style)                             | Choose whether to display your time-series data as **Lines**, **Bars**, or **Points**. |
| [Line interpolation](#line-interpolation)   | Choose how the graph interpolates the series line. |
| Line width                                  | Set the thickness of the series lines or the outline for bars using the **Line width** slider. |
| Fill opacity                                | Set the series area fill color using the **Fill opacity** slider. |
| [Gradient mode](#gradient-mode)             | Choose a gradient mode to control the gradient fill, which is based on the series color. |
| [Line style](#line-style)                   | Choose a solid, dashed, or dotted line style. |
| [Connect null values](#connect-null-values) | Choose how null values, which are gaps in the data, appear on the graph. |
| [Disconnect values](#disconnect-values)     | Choose whether to set a threshold above which values in the data should be disconnected. |
| [Show points](#show-points)                 | Set whether to show data points to lines or bars. |
| Point size                                  | Set the size of the points, from 1 to 40 pixels in diameter. |
| [Stack series](#stack-series)               | Set whether Grafana displays series on top of each other. |
| [Bar alignment](#bar-alignment)             | Set the position of the bar relative to a data point. |
| Bar width factor                            | Set the width of the bar relative to minimum space between data points. A factor of 0.5 means that the bars take up half of the available space between data points. A factor of 1.0 means that the bars take up all available space. |

<!-- prettier-ignore-end -->

#### Style

Choose whether to display your time-series data as **Lines**, **Bars**, or **Points**. You can use overrides to combine multiple styles in the same graph. Choose from the following:

![Graph style examples](/media/docs/grafana/panels-visualizations/screenshot-time-style-v12.0.png)

#### Line interpolation

Choose how the graph interpolates the series line:

- **Linear** - Points are joined by straight lines.
- **Smooth** - Points are joined by curved lines that smooths transitions between points.
- **Step before** - The line is displayed as steps between points. Points are rendered at the end of the step.
- **Step after** - The line is displayed as steps between points. Points are rendered at the beginning of the step.

![Line interpolation examples](/media/docs/grafana/panels-visualizations/screenshot-time-interpolation-v12.0.png)

#### Gradient mode

Choose a gradient mode to control the gradient fill, which is based on the series color. To change the color, use the standard color scheme field option. For more information, refer to [Color scheme](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme).

- **None** - No gradient fill. This is the default setting.
- **Opacity** - An opacity gradient where the opacity of the fill increases as y-axis values increase.
- **Hue** - A subtle gradient that's based on the hue of the series color.
- **Scheme** - A color gradient defined by your [Color scheme](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme). This setting is used for the fill area and line. For more information about scheme, refer to [Scheme gradient mode](#scheme-gradient-mode).

Gradient appearance is influenced by the **Fill opacity** setting. The following image shows the **Fill opacity** set to 50.

![Gradient mode examples](/media/docs/grafana/panels-visualizations/screenshot-time-gradient-v12.0.png)

##### Scheme gradient mode

In **Scheme** gradient mode, the line or bar receives a gradient color defined from the selected **Color scheme** option in the visualization's **Standard** options.

The following image shows a line chart with the **Green-Yellow-Red (by value)** color scheme option selected:

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_line.png" max-width="600px" alt="Color scheme: Green-Yellow-Red" >}}

If the **Color scheme** is set to **From thresholds (by value)** and **Gradient mode** is set to **Scheme**, then the line or bar color changes as it crosses the defined thresholds:

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_line.png" max-width="600px" alt="Colors scheme: From thresholds" >}}

#### Line style

Choose a solid, dashed, or dotted line style:

- **Solid** - Display a solid line. This is the default setting.
- **Dash** - Display a dashed line. When you choose this option, a list appears for you to select the length and gap (length, gap) for the line dashes. Dash spacing is 10, 10 by default.
- **Dots** - Display dotted lines. When you choose this option, a list appears for you to select the gap (length = 0, gap) for the dot spacing. Dot spacing is 0, 10 by default.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-time-line-style-v12.0.png" max-width="550px" alt="Line style examples" >}}

{{< docs/shared lookup="visualizations/connect-null-values.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="visualizations/disconnect-values.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

To change the color, use the standard [color scheme](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme) field option.

#### Show points

Set whether to show data points as lines or bars. Choose from the following:

- **Auto** - Grafana determines a point's visibility based on the density of the data. If the density is low, then points appear.
- **Always** - Show the points regardless of how dense the dataset is.
- **Never** - Don't show points.

#### Stack series

Set whether Grafana stacks or displays series on top of each other. Be cautious when using stacking because it can create misleading graphs. To read more about why stacking might not be the best approach, refer to [The issue with stacking](https://www.data-to-viz.com/caveat/stacking.html). Choose from the following:

- **Off** - Turns off series stacking. When **Off**, all series share the same space in the visualization.
- **Normal** - Stacks series on top of each other.
- **100%** - Stack by percentage where all series add up to 100%.

##### Stack series in groups

The stacking group option is only available as an override. For more information about creating an override, refer to [Configure field overrides](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/).

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
