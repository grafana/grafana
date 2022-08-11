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

## Common time series options

These options are available whether you are graphing your time series as lines, bars, or points.

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

#### Bar alignment

Set the position of the bar relative to a data point. In the examples below, **Show points** is set to **Always** to make it easier to see the difference this setting makes. The points do not change; the bars change in relationship to the points.

- **Before** ![Bar alignment before icon](http://localhost:3002/static/img/docs/time-series-panel/bar-alignment-before.png)
  The bar is drawn before the point. The point is placed on the trailing corner of the bar.
- **Center** ![Bar alignment center icon](http://localhost:3002/static/img/docs/time-series-panel/bar-alignment-center.png)
  The bar is drawn around the point. The point is placed in the center of the bar. This is the default.
- **After** ![Bar alignment after icon](http://localhost:3002/static/img/docs/time-series-panel/bar-alignment-after.png)
  The bar is drawn after the point. The point is placed on the leading corner of the bar.

#### Line width

Line width is a slider that controls the thickness for series lines or the outline for bars.

![Line thickness 5 example](http://localhost:3002//static/img/docs/time-series-panel/line-width-5.png)

#### Fill opacity

Set the opacity series area fill color.

![Fill opacity examples](http://localhost:3002/static/img/docs/time-series-panel/fill-opacity.png)

#### Gradient mode

Sets the mode of the gradient fill. Fill gradient is based on the series color. To change the color, use the standard color scheme field option. For more information, refer to [Color scheme]({{< relref "../../panels/configure-standard-options/#color-scheme" >}}).

- **None** - No gradient fill. This is the default setting.
- **Opacity** - An opacity gradient where the opacity of the fill is increasing with the values on the Y-axis.
- **Hue** - A subtle gradient that based on the hue of the series color.
- **Scheme** - A color gradient defined by your [Color scheme]({{< relref "../../panels/configure-standard-options/#color-scheme" >}}). This will be used for both the fill area and line. There is more information on this option in [Graph and color scheme]({{< relref "graph-color-scheme/" >}}).

Gradient appearance is influenced by the **Fill opacity** setting. In the screenshots below, **Fill opacity** is set to 50.

![Gradient mode examples](http://localhost:3002/static/img/docs/time-series-panel/gradient-modes-v9.png)

#### Show points

When rendering lines or bars you can still configure the visualization to render points.

- **Auto** - Will automatically decide whether or not to show the points depending on the density of the data. If the density is low, then points are shown.
- **Always** - Show the points no matter how dense the data set is.
- **Never** - Will never show the points.

###### Point size

Set the size of the points, from 1 to 40 pixels in diameter.

#### Line interpolation

This option controls how the graph should interpolates the series line.

![Line interpolation option](http://localhost:3002/static/img/docs/time-series-panel/line-interpolation-option.png)

- **Linear** - Points are joined by straight lines.
- **Smooth** - Points are joined by curved lines resulting in smooth transitions between points.
- **Step before** - The line is displayed as steps between points. Points are rendered at the end of the step.
- **Step after** - Line is displayed as steps between points. Points are rendered at the beginning of the step.

#### Line style

Set the style of the line. To change the color, use the standard [color scheme]({{< relref "../../panels/configure-standard-options/#color-scheme" >}}) field option.

![Line style option](http://localhost:3002/static/img/docs/time-series-panel/line-style-option-v9.png)

- **Solid** - Display solid line. This is the default setting.
- **Dash** - Display a dashed line. When you choose this option, a list appears so that you can select the length and gap (length, gap) for the line dashes. Dash spacing set to 10, 10 (default).
- **Dots** - Display dotted lines. When you choose this option, a list appears so that you can select the gap (length = 0, gap) for the dot spacing. Dot spacing set to 0, 10 (default)

![Line styles examples](http://localhost:3002/static/img/docs/time-series-panel/line-styles-examples-v9.png)

#### Connect null values

Choose how null values (gaps in the data) are displayed on the graph. Null values can be connected to form a continuous line or, optionally, set a threshold above which gaps in the data should no longer be connected.

![Image name](/static/img/docs/time-series-panel/connect-null-values-8-0.png)

##### Never

Time series data points with gaps in the the data are never connected.

##### Always

Time series data points with gaps in the the data are always connected.

##### Threshold

A threshold can be set above which gaps in the data should no longer be connected. This can be useful when the connected gaps in the data are of a known size and/or within a known range and gaps outside this range should no longer be connected.

![Image name](/static/img/docs/time-series-panel/connect-null-values-8-0.png)

#### Show points

Choose when the points should be shown on the graph.

##### Auto

Grafana automatically decides whether or not to show the points depending on the density of the data. If the density is low, then points are shown.

##### Always

Show the points no matter how dense the data set is. This example uses a **Line width** of 1 and 50 data points. If the line width is thicker than the point size, then the line obscures the points.

###### Point size

Set the size of the points, from 1 to 40 pixels in diameter.

Point size set to 4:

![Show points point size 4 example](/static/img/docs/time-series-panel/line-graph-show-points-4-7-4.png)

Point size set to 10:

![Show points point size 10 example](/static/img/docs/time-series-panel/line-graph-show-points-10-7-4.png)

##### Never

Never show the points.

![Show points point never example](/static/img/docs/time-series-panel/line-graph-show-points-never-7-4.png)

{{< docs/shared "visualizations/stack-series-link.md" >}}

{{< docs/shared "visualizations/change-axis-link.md" >}}

### Fill below to

This option is only available as in the Overrides tab.

Fill the area between two series. On the Overrides tab:

1. Select the fields to fill below.
1. In **Add override property**, select **Fill below to**.
1. Select the series that you want the fill to stop at.

A-series filled below to B-series:

![Fill below to example](/static/img/docs/time-series-panel/line-graph-fill-below-to-7-4.png)

### Line graph examples

Below are some line graph examples to give you ideas.

#### Various line styles

This is a graph with different line styles and colors applied to each series and zero fill.

![Various line styles example](/static/img/docs/time-series-panel/various-line-styles-7-4.png)

#### Interpolation modes examples

![Interpolation modes example](/static/img/docs/time-series-panel/interpolation-modes-examples-7-4.png)

#### Fill below example

This graph shows three series: Min, Max, and Value. The Min and Max series have **Line width** set to 0. Max has a **Fill below to** override set to Min, which fills the area between Max and Min with the Max line color.

![Fill below example](/static/img/docs/time-series-panel/fill-below-to-7-4.png)

![Show points point never example](/static/img/docs/time-series-panel/bar-graph-show-points-never-7-4.png)

{{< docs/shared "visualizations/stack-series-link.md" >}}

{{< docs/shared "visualizations/change-axis-link.md" >}}

### Bar graph examples

Below are some bar graph examples to give you ideas.

#### Hue gradient

![Bars with hue gradient example](/static/img/docs/time-series-panel/bars-with-hue-gradient-7-4.png)

## Graph time series as points

This section explains how to use Time series field options to visualize time series data as points and illustrates what the options do.

1. [Create a dashboard and add a panel]({{< relref "../../dashboards/add-organize-panels/#create-a-dashboard-and-add-a-panel" >}}).
1. Select the [Time series]({{< relref "_index.md" >}}) visualization.
1. In the Panel editor side pane, click **Graph styles** to expand it.
1. In Style, click **Points**.

### Style the points

Use the following field settings to refine your visualization.

Some field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

#### Point size

Set the size of the points, from 1 to 40 pixels in diameter.

Point size set to 6:

![Show points point size 6 example](/static/img/docs/time-series-panel/points-graph-show-points-6-7-4.png)

Point size set to 20:

![Show points point size 20 example](/static/img/docs/time-series-panel/points-graph-show-points-20-7-4.png)

Point size set to 35:

![Show points point size 35 example](/static/img/docs/time-series-panel/points-graph-show-points-35-7-4.png)

{{< docs/shared "visualizations/stack-series-link.md" >}}

{{< docs/shared "visualizations/change-axis-link.md" >}}

## Graph stacked time series

This section explains how to use Time series panel field options to control the stacking of the series and illustrates what the stacking options do.

_Stacking_ allows Grafana to display series on top of each other. Be cautious when using stacking in the visualization as it can easily create misleading graphs. You can read more on why stacking may be not the best approach here: [Stacked Area Graphs Are Not Your Friend](https://everydayanalytics.ca/2014/08/stacked-area-graphs-are-not-your-friend.html).

Use the following field settings to configure your series stacking.

Some field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

### Stack series

Turn series stacking on or off.

![Stack series editor](/static/img/docs/time-series-panel/stack-series-editor-8-0.png)

#### Off

Turn off series stacking. A series will share the same space in the visualization.

![No series stacking example](/static/img/docs/time-series-panel/stacking-off-8-0.png)

#### Normal

Enable stacking series on top of each other.

![Normal series stacking example](/static/img/docs/time-series-panel/stacking-normal-8-0.png)

### Stack series in groups

The stacking group option is only available as an override.

For more information about creating field overrides, refer to [About field overrides]({{< relref "../../panels/override-field-values/about-field-overrides/" >}}).

Stack series in the same group. In the Overrides section:

1. Create a field override for **Stack series** option.

   ![Stack series override](/static/img/docs/time-series-panel/stacking-override-default-8-0.png)

1. Click on **Normal** stacking mode.
1. Name the stacking group you want the series to appear in. The stacking group name option is only available when creating an override.

![Stack series override editor](/static/img/docs/time-series-panel/stack-series-override-editor-8-0.png)

A-series and B-series stacked in group A, C-series, and D-series stacked in group B:

![Stacking groups example](/static/img/docs/time-series-panel/stack-series-groups-8-0.png)

## Annotate time series

This section explains how to create annotations in the Time series panel. To read more about annotations support in Grafana please refer to [Annotations]({{< relref "../../dashboards/annotations/" >}}).

### Add annotation

1. In the dashboard click on the Time series panel. A context menu will appear.
1. In the context menu click on **Add annotation**.
   ![Add annotation context menu](/static/img/docs/time-series-panel/time-series-annotations-context-menu.png)
1. Add an annotation description and tags(optional).
   ![Add annotation popover](/static/img/docs/time-series-panel/time-series-annotations-add-annotation.png)
1. Click save.

Alternatively, to add an annotation, Ctrl/Cmd+Click on the Time series panel and the Add annotation popover will appear

### Add region annotation

1. In the dashboard Ctrl/Cmd+click and drag on the Time series panel.
   ![Add annotation popover](/static/img/docs/time-series-panel/time-series-annotations-add-region-annotation.gif)
1. Add an annotation description and tags(optional).
1. Click save.

### Edit annotation

1. In the dashboard hover over an annotation indicator on the Time series panel.
   ![Add annotation popover](/static/img/docs/time-series-panel/time-series-annotations-edit-annotation.gif)
1. Click on the pencil icon in the annotation tooltip.
1. Modify the description and/or tags.
1. Click save.

### Delete annotation

1. In the dashboard hover over an annotation indicator on the Time series panel.
   ![Add annotation popover](/static/img/docs/time-series-panel/time-series-annotations-edit-annotation.gif)
1. Click on the trash icon in the annotation tooltip.

### Change axis display

> **Note:** This is a beta feature. Time series panel is going to replace the Graph panel in the future releases.

This section explains how to use Time series field options to control the display of axes in the visualization and illustrates what the axis options do.

Use the following field settings to refine how your axes display.

Some field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

### Placement

Select the placement of the Y-axis.

#### Auto

Grafana automatically assigns Y-axis to the series. When there are two or more series with different units, then Grafana assigns the left axis to the first unit and right to the following units.

#### Left

Display all Y-axes on the left side.

![Left Y-axis example](/static/img/docs/time-series-panel/axis-placement-left-7-4.png)

#### Right

Display all Y-axes on the right side.

![Right Y-axis example](/static/img/docs/time-series-panel/axis-placement-right-7-4.png)

#### Hidden

Hide all axes.

To selectively hide axes, [add an override]({{< relref "../../panels/override-field-values/add-a-field-override/" >}}) targeting specific fields.

![Hidden Y-axis example](/static/img/docs/time-series-panel/axis-placement-hidden-7-4.png)

### Label

Set a Y-axis text label.

![Label example](/static/img/docs/time-series-panel/label-example-7-4.png)

If you have more than one Y-axis, then you can give assign different labels in the Override tab. You can also set the X-axis label using an override.

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

#### Linear

Use scale divided into equal parts.

#### Logarithmic

Use a logarithmic scale. When this option is chosen, a list appears where you can choose binary (base 2) or common (base 10) logarithmic scale.

### Axis examples

For examples, refer to the Grafana Play dashboard [New Features in v7.4](https://play.grafana.org/d/nP8rcffGk/new-features-in-v7-4?orgId=1).

{{< figure src="/static/img/docs/v73/color_scheme_dropdown.png" max-width="350px" caption="Color scheme" class="pull-right" >}}

## Graph and color schemes

To set the graph and color schemes, refer to [Color scheme]({{< relref "../../panels/configure-standard-options/#color-scheme" >}}).

### Classic palette

The most common setup is to use the **Classic palette** for graphs. This scheme will automatically assign a color for each field or series based on it's order. So if the order of a field change in your query the color will also change. You can manually configure a color for a specific field using an override rule.

### Single color

Use this mode to set a specific color. You can also click the colored line icon next to each series in the Legend to open the color picker. This will automatically create new override that sets the color scheme to single color and the selected color.

### By value color schemes

> **Note:** Starting in v8.1 the Time series panel now supports by value color schemes like **From thresholds** of the gradient color schemes.

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

### Transform

Use this option to transform the series values without affecting the values shown in the tooltip, context menu, and legend.

- **Negative Y transform:** Flip the results to negative values on the Y axis.
- **Constant:** Show first value as a constant line.

> **Note:** The transform option is only available as an override.
