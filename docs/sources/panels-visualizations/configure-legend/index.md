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
weight: 70
---

# Configure a legend

A panel includes a legend that you can use to interpret data displayed in a visualization. Each legend option adds context and clarity to the data illustrated in a visualization.

## Supported visualizations

Legends are supported for the following visualizations:

- [bar chart][]
- [candlestick][]
- [histogram][]
- [pie chart][]
- [state timeline][]
- [status history][]
- [time series][]
- [trend][]
<!-- - xy chart -->

[Geomaps][] and [heatmaps][] also have legends, but those but they only have the options to display or not display legends and don't support other legend options.

## Legend options

You can find the following options under the **Legend** section in the panel edit pane.

{{% admonition type="note" %}}
Not all of the options listed apply to all visualizations with legends.
{{% /admonition %}}

### Visibility

Set whether legends are displayed or not. Use the switch to toggle legends on or off.

### Mode

Set the format in which legends are displayed. Choose from

- **List**
- **Table**

When you format legends as a table, other information about the legend, such as its [values](#values) or where it's located in the visualization, might be displayed as well.

### Placement

Set where on the visualization legends are displayed. Choose from:

- **Bottom**
- **Right**

### Width

If you set the legend placement to **Right**, the **Width** option becomes available. Leave the field empty to allow Grafana to automatically set the legend width or enter a value in the field. The width is in [what measurement??].

### Values

You can add more context to a visualization by adding series data values or [calculations][] to a legend. You can add as many values as you'd like. After you apply your changes, you can horizontally scroll the legend to see all values.

![Legend formatted as a table showing calculated values](/screenshot-legend-calculations-10.3.png)

## Change a series color

By default, Grafana specifies the color of your series data, which you can change.

1. Edit a panel.

1. In the legend, click the color bar associated with the series.

1. Select a pre-set color or a custom color from the color palette.

1. Click **Apply** to save your changes are navigate back to the dashboard.

![Change legend series color](/static/img/docs/legend/legend-series-color-7-5.png)

## Isolate series data in a visualization

Visualizations can often be visually complex, and include many data series. You can simplify the view by removing series data from the visualization, which isolates the data you want to see. Grafana automatically creates a new override in the **Override** tab.

When you apply your changes, the visualization changes appear to all users of the panel.

1. Open the panel.

1. In the legend, click the label of the series you want to isolate.

   The system removes from view all other series data.

1. To incrementally add series data to an isolated series, press the **Ctrl** or **Command** key and click the label of the series you want to add.

1. To revert back to the default view that includes all data, click any series label twice.

1. To save your changes so that they appear to all viewers of the panel, click **Apply**.

## Sort series

When your legend is formatted as table and shows calculations, you can sort series by the calculation values. To do so, follow these steps:

1. Edit the panel.

1. Go to the Legend section.

1. Under Mode, select Table.

1. Under Values, select the value or calculation that you want to show.

   Values are now added to the legend table.

1. Click the calculation name header in the legend table to sort the values in the table in ascending or descending order.

{{% admonition type="note" %}}
This feature is only supported in these panels: Bar chart, Histogram, Time series.
{{% /admonition %}}

![Sort legend series](/static/img/docs/legend/legend-series-sort-8-3.png).

{{% docs/reference %}}
[bar chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-chart"
[bar chart]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-chart"

[state timeline]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"
[state timeline]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline"

[time series]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"
[time series]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series"

[calculations]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data/calculation-types"
[calculations]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types"

[pie chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/pie-chart"
[pie chart]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/pie-chart"

[status history]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/status-history"
[status history]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/status-history"

[histogram]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/histogram"
[histogram]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/histogram"

[candlestick]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/candlestick"
[candlestick]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/candlestick"

[trend]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/trend"
[trend]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/trend"

[geomaps]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/geomap"
[geomaps]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/geomap"

[heatmaps]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/heatmap"
[heatmaps]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/heatmap"
{{% /docs/reference %}}
