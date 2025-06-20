---
aliases:
  - ../panels/working-with-panels/configure-legend/
  - visualizations/configure-legend/
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure a legend
description: Configure a legend for your panel visualization
weight: 70
refs:
  status-history:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/status-history/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/status-history/
  candlestick:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/candlestick/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/candlestick/
  geomaps:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/geomap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/geomap/
  state-timeline:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/state-timeline/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline/
  xy-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/xy-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/xy-chart/
  trend:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/trend/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/trend/
  calculations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/calculation-types/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types/
  time-series:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
  histogram:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/histogram/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/histogram/
  heatmaps:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/heatmap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/heatmap/
  bar-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/bar-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-chart/
  pie-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/pie-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/pie-chart/
---

# Configure a legend

A panel includes a legend that you can use to identify and interpret data displayed in a visualization. Each legend option adds context and clarity to the data illustrated in a visualization.

## Supported visualizations

Legends are supported for the following visualizations:

- [Bar chart](ref:bar-chart)
- [Candlestick](ref:candlestick)
- [Histogram](ref:histogram)
- [Pie chart](ref:pie-chart)
- [State timeline](ref:state-timeline)
- [Status history](ref:status-history)
- [Time series](ref:time-series)
- [Trend](ref:trend)
- [XY chart](ref:xy-chart)

[Geomaps](ref:geomaps) and [heatmaps](ref:heatmaps) also have legends, but they only provide the choice to display or not display a legend and don't support other legend options.

## Legend options

You can find the following options under the **Legend** section in the panel edit pane.

{{< admonition type="note" >}}
Not all of the options listed apply to all visualizations with legends.
{{< /admonition >}}

### Visibility

Set whether the legend is displayed or not. Use the switch to toggle a legend on or off.

### Mode

Set the format in which the legend is displayed. Choose from:

- **List**
- **Table**

When you format a legend as a table, other information about the legend, such as associated [values](#values) or where it's located in the visualization, might be displayed as well.

### Placement

Set where on the visualization a legend is displayed. Choose from:

- **Bottom**
- **Right**

### Width

If you set the legend placement to **Right**, the **Width** option becomes available. Leave the field empty to allow Grafana to automatically set the legend width or enter a value in the field.

### Values

You can add more context to a visualization by adding series data values or [calculations](ref:calculations) to a legend. You can add as many values as you'd like. After you apply your changes, you can scroll the legend to see all values.

![Legend showing values](/media/docs/grafana/panels-visualizations/screenshot-legend-values-10.3.png)

## Change a series color

By default, Grafana sets the colors of your series data, but you can change them through the panel legend. To change the series data color, follow these steps:

1. Navigate to the panel you want to update.
1. In the legend, click the color bar associated with the series.
1. Select a pre-set color in the **Colors** tab or set a custom color in the **Custom** tab, using the picker or RGB values.
1. Save the dashboard.

![Change legend series color](/static/img/docs/legend/legend-series-color-7-5.png)

## Isolate series data in a visualization

Visualizations can often be visually complex, and include many data series. You can simplify the view by removing series data from the visualization through the legend, which isolates the data you want to see. When you do this, Grafana automatically creates a new override in the **Override** section.

To isolate a series, follow these steps:

1. Navigate to the panel you want to update.
1. In the legend, click the label of the series you want to isolate.

   The system removes all other series data from view.

1. To incrementally add series data back to an isolated series, press the **Ctrl** or **Command** key and click the label of the series you want to add.
1. To save your changes so that they appear to all viewers of the panel, save the dashboard.

To revert back to the default view that includes all data, click any series label twice.

## Sort series

When you format a legend as a table and add values to it, you can sort series in the table by those values. To do so, follow these steps:

1. Navigate to the panel you want to update.
1. Hover over any part of the panel you want to work on to display the menu on the top right corner.
1. Click the menu and select **Edit**.
1. Scroll to the **Legend** section of the panel edit pane.
1. Under **Mode**, select **Table**.
1. Under **Values**, select the value or calculation that you want to show.

   The legend table now displays values.

1. Click the calculation name header in the legend table to sort the values in the table in ascending or descending order.

![Legend formatted as a table showing sorted values](/media/docs/grafana/panels-visualizations/screenshot-legend-sorted-10.3-v2.png)

{{< admonition type="note" >}}
This feature is only supported for the following visualizations: bar chart, histogram, time series.
{{< /admonition >}}
