---
aliases:
  - ../../panels/visualizations/time-series/graph-color-scheme/
keywords:
  - grafana
  - time series panel
  - documentation
  - guide
  - graph
title: 'Graph and color schemes '
weight: 400
---

{{< figure src="/static/img/docs/v73/color_scheme_dropdown.png" max-width="350px" caption="Color scheme" class="pull-right" >}}

# Graph and color schemes

To set the graph and color schemes, refer to [Apply color to series and fields]({{< relref "../../panels/working-with-panels/apply-color-to-series.md" >}}).

## Classic palette

The most common setup is to use the **Classic palette** for graphs. This scheme will automatically assign a color for each field or series based on it's order. So if the order of a field change in your query the color will also change. You can manually configure a color for a specific field using an override rule.

## Single color

Use this mode to set a specific color. You can also click the colored line icon next to each series in the Legend to open the color picker. This will automatically create new override that sets the color scheme to single color and the selected color.

## By value color schemes

> **Note:** Starting in v8.1 the Time series panel now supports by value color schemes like **From thresholds** of the gradient color schemes.

If you select a by value color scheme like **From thresholds (by value)** or **Green-Yellow-Red (by value)** another option named **Color series by** will show up. This option control what value (Last, Min, Max) to use to assign the series its color.

## Scheme gradient mode

The **Gradient mode** option located under the **Graph styles** has a mode named **Scheme**. When this mode is enabled the whole line or bar gets a gradient color defined from the selected **Color scheme**.

### From thresholds

If the **Color scheme** is set to **From thresholds (by value)** and **Gradient mode** is set to **Scheme** then the line or bar color will change as they cross the thresholds defined.

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_line.png" max-width="1200px" caption="Colors scheme: From thresholds" >}}

If you have enabled bars mode it would look like this:

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_bars.png" max-width="1200px" caption="Color scheme: From thresholds" >}}

### Gradient color schemes

If you have a selected a **Color scheme** like **Green-Yellow-Red (by value)** then it would look like this:

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_line.png" max-width="1200px" caption="Color scheme: Green-Yellow-Red" >}}

If you have enabled bars mode it would look like this:

{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_bars.png" max-width="1200px" caption="Color scheme: Green-Yellow-Red" >}}
