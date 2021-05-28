+++
title = "Graph time series as lines"
keywords = ["grafana", "time series panel", "documentation", "guide", "graph"]
weight = 100
+++

# Graph time series as lines

> **Note:** This is a beta feature. Time series panel is going to replace the Graph panel in the future releases.

This section explains how to use Time series field options to visualize time series data as lines and illustrates what the options do.

## Create the panel

1. [Add a panel]({{< relref "../../add-a-panel.md" >}}). Select the [Time series]({{< relref "_index.md" >}}) visualization.
1. In the [Panel editor]({{< relref "../../panel-editor.md" >}}), click the **Field** tab.
1. In Style, click **Lines**.

## Style the lines

Use the following field settings to refine your visualization.

For more information about applying these options, refer to:

- [Configure all fields]({{< relref "../../field-options/configure-all-fields.md" >}})
- [Configure specific fields]({{< relref "../../field-options/configure-specific-fields.md" >}})

Some field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

### Line interpolation

Choose how Grafana interpolates the series line. The screenshots below show the same data displayed with different line interpolations.

#### Linear

![Linear interpolation icon](/static/img/docs/time-series-panel/interpolation-icon-linear-7-4.png)

Points are joined by straight lines.

![Linear interpolation example](/static/img/docs/time-series-panel/interpolation-linear-7-4.png)

#### Smooth

![Smooth interpolation icon](/static/img/docs/time-series-panel/interpolation-icon-smooth-7-4.png)

Points are joined by curved lines resulting in smooth transitions between points.

![Smooth interpolation example](/static/img/docs/time-series-panel/interpolation-smooth-7-4.png)

#### Step before

![Step before interpolation icon](/static/img/docs/time-series-panel/interpolation-icon-step-before-7-4.png)

The line is displayed as steps between points. Points are rendered at the end of the step.

![Step before interpolation example](/static/img/docs/time-series-panel/interpolation-step-before-7-4.png)

#### Step after

![Step after interpolation icon](/static/img/docs/time-series-panel/interpolation-icon-step-after-7-4.png)

Line is displayed as steps between points. Points are rendered at the beginning of the step.

![Step after interpolation example](/static/img/docs/time-series-panel/interpolation-step-after-7-4.png)

### Line width

Set the thickness of the series line, from 0 to 10 pixels.

Line thickness set to 1:

![Line thickness 1 example](/static/img/docs/time-series-panel/line-graph-thickness-1-7-4.png)

Line thickness set to 7:

![Line thickness 7 example](/static/img/docs/time-series-panel/line-graph-thickness-7-7-4.png)

### Fill opacity

Set the opacity of the series fill, from 0 to 100 percent.

Fill opacity set to 20:

![Fill opacity 20 example](/static/img/docs/time-series-panel/line-graph-opacity-20-7-4.png)

Fill opacity set to 95:

![Fill opacity 95 example](/static/img/docs/time-series-panel/line-graph-opacity-95-7-4.png)

### Gradient mode

Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard [color scheme]({{< relref "../../standard-options.md#color-scheme" >}}) field option.

Gradient appearance is influenced by the **Fill opacity** setting. In the screenshots below, **Fill opacity** is set to 50.

#### None

No gradient fill. This is the default setting.

![Gradient mode none example](/static/img/docs/time-series-panel/line-graph-gradient-none-7-4.png)

#### Opacity

Transparency of the gradient is calculated based on the values on the y-axis. Opacity of the fill is increasing with the values on the Y-axis.

![Gradient mode opacity example](/static/img/docs/time-series-panel/line-graph-gradient-opacity-7-4.png)

#### Hue

Gradient color is generated based on the hue of the line color.

![Gradient mode hue example](/static/img/docs/time-series-panel/line-graph-gradient-hue-7-4.png)

### Line style

Set the style of the line. To change the color, use the standard [color scheme]({{< relref "../../standard-options.md#color-scheme" >}}) field option.

Line style appearance is influenced by the **Line width** and **Fill opacity** settings. In the screenshots below, **Line width** is set to 3 and **Fill opacity** is set to 20.

#### Solid

Display solid line. This is the default setting.

![Line style solid example](/static/img/docs/time-series-panel/line-graph-line-style-solid-7-4.png)

#### Dash

Display a dashed line. When you choose this option, a list appears so that you can select the length and gap (length, gap) for the line dashes.

Dash spacing set to 10, 10 (default):

![Line style dashed 10, 10 example](/static/img/docs/time-series-panel/line-graph-line-style-dashed-10-10-7-4.png)

Dash spacing set to 10, 30:

![Line style dashed 10, 30 example](/static/img/docs/time-series-panel/line-graph-line-style-dashed-10-30-7-4.png)

Dash spacing set to 40, 10:

![Line style dashed 40, 10 example](/static/img/docs/time-series-panel/line-graph-line-style-dashed-40-10-7-4.png)

#### Dots

Display dotted lines. When you choose this option, a list appears so that you can select the gap (length = 0, gap) for the dot spacing.

Dot spacing set to 0, 10 (default):

![Line style dots 0, 10 example](/static/img/docs/time-series-panel/line-graph-line-style-dots-0-10-7-4.png)

Dot spacing set to 0, 30:

![Line style dots 0, 30 example](/static/img/docs/time-series-panel/line-graph-line-style-dots-0-30-7-4.png)

### Null values

Choose how null values (gaps in the data) are displayed on the graph.

#### Gaps

If there is a gap in the series, the line in the graph will be broken and show the gap.

![Null values gaps example](/static/img/docs/time-series-panel/line-graph-null-gaps-7-4.png)

#### Connected

If there is a gap in the series, the line will skip the gap and connect to the next non-null value.

![Null values connected example](/static/img/docs/time-series-panel/line-graph-null-connected-7-4.png)

### Show points

Choose when the points should be shown on the graph.

#### Auto

Grafana automatically decides whether or not to show the points depending on the density of the data. If the density is low, then points are shown.

#### Always

Show the points no matter how dense the data set is. This example uses a **Line width** of 1 and 50 data points. If the line width is thicker than the point size, then the line obscures the points.

##### Point size

Set the size of the points, from 1 to 40 pixels in diameter.

Point size set to 4:

![Show points point size 4 example](/static/img/docs/time-series-panel/line-graph-show-points-4-7-4.png)

Point size set to 10:

![Show points point size 10 example](/static/img/docs/time-series-panel/line-graph-show-points-10-7-4.png)

#### Never

Never show the points.

![Show points point never example](/static/img/docs/time-series-panel/line-graph-show-points-never-7-4.png)

{{< docs/shared "visualizations/stack-series-link.md" >}}

{{< docs/shared "visualizations/change-axis-link.md" >}}

## Fill below to

This option is only available as in the Overrides tab.

Fill the area between two series. On the Overrides tab:

1. Select the fields to fill below.
1. In **Add override property**, select **Fill below to**.
1. Select the series that you want the fill to stop at.

A-series filled below to B-series:

![Fill below to example](/static/img/docs/time-series-panel/line-graph-fill-below-to-7-4.png)

## Line graph examples

Below are some line graph examples to give you ideas.

### Various line styles

This is a graph with different line styles and colors applied to each series and zero fill.

![Various line styles example](/static/img/docs/time-series-panel/various-line-styles-7-4.png)

### Interpolation modes examples

![Interpolation modes example](/static/img/docs/time-series-panel/interpolation-modes-examples-7-4.png)

### Fill below example

This graph shows three series: Min, Max, and Value. The Min and Max series have **Line width** set to 0. Max has a **Fill below to** override set to Min, which fills the area between Max and Min with the Max line color.

![Fill below example](/static/img/docs/time-series-panel/fill-below-to-7-4.png)
