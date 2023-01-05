---
aliases:
  - ../../panels/visualizations/time-series/graph-time-series-as-lines/
keywords:
  - grafana
  - time series panel
  - documentation
  - guide
  - graph
title: Graph time series as lines
weight: 200
---

# Graph time series as lines

This section explains how to use Time series field options to visualize time series data as lines and illustrates what the options do.

## Create the panel

1. [Add a panel]({{< relref "../../panels/working-with-panels/add-panel.md" >}}). Select the [Time series]({{< relref "_index.md" >}}) visualization.
1. In the Panel editor side pane, click **Graph styles** to expand it.
1. In Style, click **Lines**.

## Style the lines

Use the following field settings to refine your visualization.

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

Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard color scheme field option. For more information, refer to [Apply color to series and fields]({{< relref "../../panels/working-with-panels/apply-color-to-series.md" >}}) .

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

#### Scheme

In this mode the whole line will use a color gradient defined by your Color scheme. For more information, refer to [Apply color to series and fields]({{< relref "../../panels/working-with-panels/apply-color-to-series.md" >}}). There is more information on this option in [Graph and color scheme]({{< relref "./graph-color-scheme.md" >}}).

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_line.png" max-width="1200px" caption="Gradient mode scheme" >}}

### Line style

Set the style of the line. To change the color, use the standard color scheme field option. For more information, refer to [Apply color to series and fields]({{< relref "../../panels/working-with-panels/apply-color-to-series.md" >}})

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

### Connect null values

Choose how null values (gaps in the data) are displayed on the graph. Null values can be connected to form a continuous line or, optionally, set a threshold above which gaps in the data should no longer be connected.

![Image name](/static/img/docs/time-series-panel/connect-null-values-8-0.png)

#### Never

Time series data points with gaps in the the data are never connected.

#### Always

Time series data points with gaps in the the data are always connected.

#### Threshold

A threshold can be set above which gaps in the data should no longer be connected. This can be useful when the connected gaps in the data are of a known size and/or within a known range and gaps outside this range should no longer be connected.

![Image name](/static/img/docs/time-series-panel/connect-null-values-8-0.png)

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
