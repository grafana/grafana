---
aliases:
keywords:
  - grafana
  - tooltips
  - documentation
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure tooltips
title: Configure tooltips
description: Configure tooltips for your visualizations
weight: 75
refs:
  pie-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/pie-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/pie-chart/
  time-series:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
  trend:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/trend/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/trend/
  candlestick:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/candlestick/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/candlestick/
  bar-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/bar-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-chart/
  flame-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/flame-graph/
  xy-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/xy-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/xy-chart/
  state-timeline:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/state-timeline/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline/
  geomaps:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/geomap/#tooltip
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/geomap/#tooltip
  field-override:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/
  heatmap:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/heatmap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/heatmap/
  status-history:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/status-history/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/status-history/
---

# Configure tooltips

When you hover your cursor over a visualization, Grafana can display tooltips that contain more information about a data point, like the exact time of a result. You can customize tooltips to control how many series they include and the order of those values. You can also copy the content from tooltips to use elsewhere. Learn more about configuring tooltips in [Tooltip options](#tooltip-options).

## Supported visualizations

You can configure tooltips for the following visualizations:

{{< column-list >}}

- [Bar chart](ref:bar-chart)
- [Candlestick](ref:candlestick)
- [Heatmap](ref:heatmap)
- [Pie chart](ref:pie-chart)
- [State timeline](ref:state-timeline)
- [Status history](ref:status-history)
- [Time series](ref:time-series)
- [Trend](ref:trend)
- [XY chart](ref:xy-chart)

{{< /column-list >}}

Some visualizations, for example [candlestick](ref:candlestick) and [flame graph](ref:flame-graph), have tooltips, but they aren't configurable. These visualizations don't have a **Tooltip** section in the panel editor pane. [Geomaps](ref:geomaps) provide you the option to have tooltips triggered upon click or hover under the **Map controls** options in the panel editor pane.

<!-- if we add documentation for treemap, some info will need to be added in the paragraph above -->

## Tooltip options

You can find the following options under the **Tooltip** section in the panel edit pane.

{{% admonition type="note" %}}
Not all of the options listed apply to all visualizations with tooltips.
{{% /admonition %}}

### Tooltip mode

Choose how tooltips behave with the following options:

- **Single** - The tooltip only the single series that you're hovering over in the visualization.
- **All** - The tooltip shows all series in the visualization. Grafana highlights the series that you are hovering over in bold in the series list in the tooltip.
- **Hidden** - Tooltips aren't displayed when you interact with the visualization.

You can use a [field override](ref:field-override) to hide individual series from the tooltip.

### Values sort order

When you set the **Tooltip mode** to **All**, the **Values sort order** option is displayed. This option controls the order in which values are listed in a tooltip. Choose from the following:

- **None** - Grafana automatically sorts the values displayed in a tooltip.
- **Ascending** - Values in the tooltip are listed from smallest to largest.
- **Descending** - Values in the tooltip are listed from largest to smallest.

### Hover proximity

Set the hover proximity (in pixels) to control how close the cursor must be to a data point to trigger the tooltip to display.

![Adding a hover proximity limit for tooltips](/media/docs/grafana/gif-grafana-10-4-hover-proximity.gif)

### Max width

Set the maximum width of the tooltip box.

### Max height

Set the maximum height of the tooltip box. The default is 600 pixels.

### Show histogram (Y axis)

For the heatmap visualization only, when you set the **Tooltip mode** to **Single**, the **Show histogram (Y axis)** option is displayed. This option controls whether or not the tooltip includes a histogram representing the y-axis.

### Show color scale

For the heatmap visualization only, when you set the **Tooltip mode** to **Single**, the **Show color scale** option is displayed. This option controls whether or not the tooltip includes the color scale that's also represented in the legend. When the color scale is included in the tooltip, it shows the hovered value on the scale:

![Heatmap with a tooltip displayed showing the hovered value reflected in the color scale](/media/docs/grafana/panels-visualizations/screenshot-heatmap-tooltip-color-scale-v11.0.png)
