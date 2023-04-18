---
aliases:
  - ../../panels/visualizations/time-series/graph-time-series-as-bars/
keywords:
  - grafana
  - time series panel
  - documentation
  - guide
  - graph
title: Graph time series as bars
weight: 200
---

# Graph time series as bars

This section explains how to use Time series field options to visualize time series data as bars and illustrates what the options do.

For more information about the time series visualization, refer to [Time series]({{< relref "_index.md" >}}).

## Create the panel

1. [Add a panel]({{< relref "../../panels/working-with-panels/add-panel.md" >}}).
1. Select the **Time series** visualization.
1. In the Panel editor side pane, click **Graph styles** to expand it.
1. In Style, click **Bars**.

## Style the bars

Use the following field settings to refine your visualization.

Some field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

### Bar alignment

Set the position of the bar relative to a data point. In the examples below, **Show points** is set to **Always** to make it easier to see the difference this setting makes. The points do not change; the bars change in relationship to the points.

#### Before

![Bar alignment before icon](/static/img/docs/time-series-panel/bar-alignment-icon-before-7-4.png)

The bar is drawn before the point. The point is placed on the trailing corner of the bar.

![Bar alignment before example](/static/img/docs/time-series-panel/bar-alignment-before-7-4.png)

#### Center

![Bar alignment center icon](/static/img/docs/time-series-panel/bar-alignment-icon-center-7-4.png)

The bar is drawn around the point. The point is placed in the center of the bar. This is the default.

![Bar alignment center](/static/img/docs/time-series-panel/bar-alignment-center-7-4.png)

#### After

![Bar alignment after icon](/static/img/docs/time-series-panel/bar-alignment-icon-after-7-4.png)

The bar is drawn after the point. The point is placed on the leading corner of the bar.

![Bar alignment after](/static/img/docs/time-series-panel/bar-alignment-after-7-4.png)

### Line width

Set the thickness of the lines bar outlines, from 0 to 10 pixels. **Fill opacity** is set to 10 in the examples below.

Line thickness set to 1:

![Line thickness 1 example](/static/img/docs/time-series-panel/bar-graph-thickness-1-7-4.png)

Line thickness set to 7:

![Line thickness 7 example](/static/img/docs/time-series-panel/bar-graph-thickness-7-7-4.png)

### Fill opacity

Set the opacity of the bar fill, from 0 to 100 percent. In the examples below, the **Line width** is set to 1.

Fill opacity set to 20:

![Fill opacity 20 example](/static/img/docs/time-series-panel/bar-graph-opacity-20-7-4.png)

Fill opacity set to 95:

![Fill opacity 95 example](/static/img/docs/time-series-panel/bar-graph-opacity-95-7-4.png)

### Gradient mode

Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard color scheme field option. For more information, refer to [Apply color to series and fields]({{< relref "../../panels/working-with-panels/apply-color-to-series.md" >}}).

Gradient appearance is influenced by the **Fill opacity** setting. In the screenshots below, **Fill opacity** is set to 50.

#### None

No gradient fill. This is the default setting.

![Gradient mode none example](/static/img/docs/time-series-panel/bar-graph-gradient-none-7-4.png)

#### Opacity

Transparency of the gradient is calculated based on the values on the y-axis. Opacity of the fill is increasing with the values on the Y-axis.

![Gradient mode opacity example](/static/img/docs/time-series-panel/bar-graph-gradient-opacity-7-4.png)

#### Hue

Gradient color is generated based on the hue of the line color.

![Gradient mode hue example](/static/img/docs/time-series-panel/bar-graph-gradient-hue-7-4.png)

#### Scheme

In this mode the whole bar will use a color gradient defined by your Color scheme. For more information, refer to [Apply color to series and fields]({{< relref "../../panels/working-with-panels/apply-color-to-series.md" >}}). There is more information on this option in [Graph and color scheme]({{< relref "./graph-color-scheme.md" >}}).

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_bars.png" max-width="1200px" caption="Gradient color scheme mode" >}}

### Show points

Choose when the points should be shown on the graph

#### Auto

Grafana automatically decides whether or not to show the points depending on the density of the data. If the density is low, then points are shown.

#### Always

Show the points no matter how dense the data set is. This example uses a **Line width** of 1. If the line width is thicker than the point size, then the line obscures the points.

##### Point size

Set the size of the points, from 1 to 40 pixels in diameter.

Point size set to 6:

![Show points point size 6 example](/static/img/docs/time-series-panel/bar-graph-show-points-6-7-4.png)

Point size set to 20:

![Show points point size 20 example](/static/img/docs/time-series-panel/bar-graph-show-points-20-7-4.png)

#### Never

Never show the points.

![Show points point never example](/static/img/docs/time-series-panel/bar-graph-show-points-never-7-4.png)

{{< docs/shared "visualizations/stack-series-link.md" >}}

{{< docs/shared "visualizations/change-axis-link.md" >}}

## Bar graph examples

Below are some bar graph examples to give you ideas.

### Hue gradient

![Bars with hue gradient example](/static/img/docs/time-series-panel/bars-with-hue-gradient-7-4.png)
