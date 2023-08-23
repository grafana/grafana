---
keywords:
  - grafana
  - documentation
  - guide
  - graph
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Time series (improved)
weight: 10
---

# Time series (improved)

The time series visualization is the default and primary way to visualize time series data as a graph. It can render series as lines, points, or bars. It is versatile enough to display almost any time-series data. [This public demo dashboard](https://play.grafana.org/d/000000016/1-time-series-graphs?orgId=1) contains many different examples of how it can be configured and styled.

{{< figure src="/static/img/docs/time-series-panel/time_series_small_example.png" max-width="1200px" caption="Time series" >}}

{{% admonition type="note" %}}
You can migrate from the old Graph visualization to the time series visualization. To migrate, open the panel and click the **Migrate** button in the side pane.
{{% /admonition %}}

## Supported data

This section should include what types of data you can use here, some examples, with maybe a screenshot of what that data would look like.

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Axis options

{{% admonition type="note" %}}
_Formatting notes_

Headings for options to H3 level to ensure scannability.
x- and y-axis should always be lower case and hyphenated unless quoting in the UI. In the UI, we should use X- and Y-axis spelling with "axis" in lower-case.
{{% /admonition %}}

Options under the axis category change how the x- and y-axes are rendered. Some options do not take effect until you click outside of the field option box you are editing. You can also or press `Enter`.

### Time zone

Use the default time zone or select another time zone. You can also add multiple time zones.

### Placement

Select the placement of the y-axis.

{{% admonition type="note" %}}
_Formatting notes_

Any options lower than an H3 are bolded and formatted in a bullet list since H3s and H4s are very hard to distinguish.
{{% /admonition %}}

- **Auto:** Automatically assigns the y-axis to the series. When there are two or more series with different units, Grafana assigns the left axis to the first unit and the right axis to the units that follow.
- **Left:** Display all y-axes on the left side.
- **Right:** Display all y-axes on the right side.
- **Hidden:** Hide all axes.

To selectively hide axes, [Add a field override]({{< relref "../../configure-overrides#add-a-field-override" >}}) that targets specific fields.

### Label

Set a **_y-axis_** text label. If you have more than one y-axis, then you can assign different labels using an override.

{{% admonition type="note" %}}
_Formatting notes_

Unless you're talking about a specific labeled axis, lower case, always hyphenated. Maybe the UI is an exception where we would use upper case with a hyphen, axis in lower case (e.g., X-axis).
{{% /admonition %}}

### Width

Set a fixed width of the axis. By default, Grafana dynamically calculates the width of an axis.

By setting the width of the axis, data with different axes types can share the same display proportions. This setting makes it easier for you to compare more than one graph’s worth of data because the axes are not shifted or stretched within visual proximity to each other.

### Show grid lines

Set whether grid lines are displayed or not.

- **Auto**: A description here
- **On**: A description here
- **Off**: A description here

### Color

Set whether the axis color is the same as the color of the text or the series.

- **Text**: A description here
- **Series**: A description here

### Scale

Set the y-axis values scale.

- **Linear:** Divides the scale into equal parts.
- **Logarithmic:** Use a logarithmic scale. When you select this option, a list appears for you to choose a binary (base 2) or common (base 10) logarithmic scale.

### Centered zero

Set whether zero is placed at the bottom or the center of the y-axis.

### Soft min and Soft max

Set a **Soft min** or **soft max** option for better control of y-axis limits. By default, Grafana sets the range for the y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent blips from turning into mountains when the data is mostly flat, and hard min or max derived from standard min and max field options can prevent intermittent spikes from flattening useful detail by clipping the spikes past a specific point.

To define hard limits of the y-axis, You can set standard min/max options. For more information, refer to [Configure standard options]({{< relref "../../configure-standard-options/#max" >}}).

![Label example](/static/img/docs/time-series-panel/axis-soft-min-max-7-4.png)

## Graph styles options

Options under this section change the styling of the graph.

### Style

Use this option to define how to display your time series data. You can use overrides to combine multiple styles in the same graph.

- Lines
- Bars
- Points

![Style modes](/static/img/docs/time-series-panel/style-modes-v9.png)

The following table lists which of the styling options apply to each graph style:

| Style                                       | Lines | Bars | Points |
| ------------------------------------------- | ----- | ---- | ------ |
| [Bar alignment](#bar-alignment)             |       | X    |        |
| [Connect null values](#connect-null-values) | X     |      |        |
| [Disconnect values](#disconnect-values)     | X     |      |        |
| [Fill opacity](#fill-opacity)               | X     | X    |        |
| [Gradient mode](#gradient-mode)             | X     | X    |        |
| [Line interpolation](#line-interpolation)   | X     |      |        |
| [Line style](#line-style)                   | X     |      |        |
| [Line width](#line-width)                   | X     | X    |        |
| [Point size](#point-size)                   | X     | X    | X      |
| [Show points](#show-points)                 | X     | X    |        |
| [Stack series](#stack-series)               | X     | X    | X      |

{{% admonition type="note" %}}
_Formatting notes_

I've ordered these options as they display as you move across graph styles; but the table above is alphabetical to make it easier to find things. Maybe they should be consistent. Just addressing different approaches.
{{% /admonition %}}

### Line interpolation

This option controls how the graph interpolates the series line.

![Line interpolation option](/static/img/docs/time-series-panel/line-interpolation-option.png)

- **Linear:** Points are joined by straight lines.
- **Smooth:** Points are joined by curved lines that smooths transitions between points.
- **Step before:** The line is displayed as steps between points. Points are rendered at the end of the step.
- **Step after:** The line is displayed as steps between points. Points are rendered at the beginning of the step.

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
- **Opacity:** An opacity gradient where the opacity of the fill increases as y-axis values increase.
- **Hue:** A subtle gradient that is based on the hue of the series color.
- **Scheme:** A color gradient defined by your [Color scheme]({{< relref "../../configure-standard-options/#color-scheme" >}}). This setting is used for the fill area and line. For more information about scheme, refer to [Scheme gradient mode]({{< relref "#cheme-gradient-mode"  >}}).

Gradient appearance is influenced by the **Fill opacity** setting. The following image show, the **Fill opacity** is set to 50.

![Gradient mode examples](/static/img/docs/time-series-panel/gradient-modes-v9.png)

### Line style

Set the style of the line. To change the color, use the standard [color scheme]({{< relref "../../configure-standard-options/#color-scheme" >}}) field option.

![Line style option](/static/img/docs/time-series-panel/line-style-option-v9.png)

- **Solid:** Display a solid line. This is the default setting.
- **Dash:** Display a dashed line. When you choose this option, a list appears for you to select the length and gap (length, gap) for the line dashes. Dash spacing set to 10, 10 (default).
- **Dots:** Display dotted lines. When you choose this option, a list appears for you to select the gap (length = 0, gap) for the dot spacing. Dot spacing set to 0, 10 (default)

![Line styles examples](/static/img/docs/time-series-panel/line-styles-examples-v9.png)

{{< docs/shared "visualizations/connect-null-values.md" >}}

{{< docs/shared "visualizations/disconnect-values.md" >}}

### Show points

You can configure your visualization to add points to lines or bars.

- **Auto:** Grafana determines to show or not to show points based on the density of the data. If the density is low, then points appear.
- **Always:** Show the points regardless of how dense the data set is.
- **Never:** Do not show points.

### Point size

Set the size of the points, from 1 to 40 pixels in diameter.

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

## Special overrides

{{% admonition type="note" %}}
_Formatting notes_

These overrides aren't visible in the sections of the UI they're grouped under, so it's potentially confusing to have them that way.
{{% /admonition %}}

### Fill below to

The **Fill below to** option fills the area between two series. This option is only available as a series/field override.

1. Edit the panel and click **Overrides**.
1. Select the fields to fill below.
1. In **Add override property**, select **Fill below to**.
1. Select the series for which you want the fill to stop.

The following example shows three series: Min, Max, and Value. The Min and Max series have **Line width** set to 0. Max has a **Fill below to** override set to Min, which fills the area between Max and Min with the Max line color.

{{< figure src="/static/img/docs/time-series-panel/fill-below-to-7-4.png" max-width="600px" caption="Fill below to example" >}}

### Transform

Use this option to transform the series values without affecting the values shown in the tooltip, context menu, or legend. This is only available as a series/field override.

- **Negative Y transform:** Flip the results to negative values on the y-axis.
- **Constant:** Show the first value as a constant line.

{{% admonition type="note" %}}
The transform option is only available as an override.
{{% /admonition %}}

## Other visualization options v1

There are other common configuration options for the Time series visualization:

<!--above can be a bit of shared content to ensure wording is consistent with guidance indicating that you should create an alphabetical list of other relevant options linked to that content-->

- [Data links]({{< relref "../../../panels-visualizations/configure-data-links/" >}})
- [Field overrides]({{< relref "../../../panels-visualizations/configure-overrides/" >}})
- [Legends]({{< relref "../../../panels-visualizations/configure-legend/" >}})
- [Standard options]({{< relref "../../../panels-visualizations/configure-standard-options/" >}})
- [Thresholds]({{< relref "../../../panels-visualizations/configure-thresholds/" >}})
- [Tooltips]({{< relref "../../../panels-visualizations/configure-tooltips/" >}})
- [Value mappings]({{< relref "../../../panels-visualizations/configure-value mappings/" >}})

## Other visualization options v2

There are other common configuration options for the Time series visualization:

<!--above can be a bit of shared content to ensure wording is consistent with guidance indicating that you should create an alphabetical list of other relevant options linked to that content-->

### Data Links

Some placeholder text with a link to:
[Data links]({{< relref "../../../panels-visualizations/configure-data-links/" >}})

### Field overrides

Some placeholder text with a link to:
[Field overrides]({{< relref "../../../panels-visualizations/configure-overrides/" >}})

### Legends

Some placeholder text with a link to:
[Legends]({{< relref "../../../panels-visualizations/configure-legend/" >}})

### Standard options

Some placeholder text with a link to:
[Standard options]({{< relref "../../../panels-visualizations/configure-standard-options/" >}})

### Thresholds

Some placeholder text with a link to:
[Thresholds]({{< relref "../../../panels-visualizations/configure-thresholds/" >}})

### Tooltips

Some placeholder text with a link to:
[Tooltips]({{< relref "../../../panels-visualizations/configure-tooltips/" >}})

### Value mappings

Some placeholder text with a link to:
[Value mappings]({{< relref "../../../panels-visualizations/configure-value mappings/" >}})
