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

## Legend options

You can find the following options under the **Legend** section in the panel edit pane.

<!--consider making these bullet points rather than H3s-->

{{% admonition type="note" %}}
Not all of the options listed apply to all visualizations with legends.
{{% /admonition %}}

### Visibility

Set whether legends are displayed or not. Use the switch to toggle legends on or off.

### Mode

Set the format in which legends are displayed. Choose from

- **List**
- **Table**

When you format legends as a table, other information about the legend, such as its location in the visualization, might be displayed as well.

### Placement

Set where on the visualization legends are displayed. Choose from:

- **Bottom**
- **Right**

### Width

If you set the legend placement to **Right**, the **Width** option becomes available. Leave the field empty to allow Grafana to automatically set the legend width or enter a value in the field. The width is in [what measurement??].

### Values

Select values or [calculations][] to show in legends.

## Isolate series data in a visualization

Visualizations can often be visually complex, and include many data series. You can simplify the view by removing series data from the visualization, which isolates the data you want to see. Grafana automatically creates a new override in the **Override** tab.

When you apply your changes, the visualization changes appear to all users of the panel.

1. Open the panel.

1. In the legend, click the label of the series you want to isolate.

   The system removes from view all other series data.

1. To incrementally add series data to an isolated series, press the **Ctrl** or **Command** key and click the label of the series you want to add.

1. To revert back to the default view that includes all data, click any series label twice.

1. To save your changes so that they appear to all viewers of the panel, click **Apply**.

This topic currently applies to the following visualizations:

- [Bar chart][]
- [Histogram][]
- [Pie chart][]
- [State timeline][]
- [Status history][]
- [Time series][]

## Add values to a legend

As way to add more context to a visualization, you can add series data values to a legend. You can add as many values as you'd like; after you apply your changes, you can horizontally scroll the legend to see all values.

1. Edit a panel.

1. In the panel display options pane, locate the **Legend** section.

1. In the **Legend values** field, select the values you want to appear in the legend.

1. Click **Apply** to save your changes are navigate back to the dashboard.

![Toggle series visibility](/static/img/docs/legend/legend-series-toggle-7-5.png)

## Change a series color

By default, Grafana specifies the color of your series data, which you can change.

1. Edit a panel.

1. In the legend, click the color bar associated with the series.

1. Select a pre-set color or a custom color from the color palette.

1. Click **Apply** to save your changes are navigate back to the dashboard.

![Change legend series color](/static/img/docs/legend/legend-series-color-7-5.png)

## Sort series

You can change legend mode to **Table** and choose [calculations][] to be displayed in the legend. Click the calculation name header in the legend table to sort the values in the table in ascending or descending order.

{{% admonition type="note" %}}
This feature is only supported in these panels: Bar chart, Histogram, Time series.
{{% /admonition %}}

![Sort legend series](/static/img/docs/legend/legend-series-sort-8-3.png).

{{% docs/reference %}}
[Bar chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-chart"
[Bar chart]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-chart"

[State timeline]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"
[State timeline]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"

[Time series]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"
[Time series]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"

[calculations]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data/calculation-types"
[calculations]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types"

[Pie chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/pie-chart"
[Pie chart]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/pie-chart"

[Status history]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/status-history"
[Status history]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/status-history"

[Histogram]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/histogram"
[Histogram]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/histogram"
{{% /docs/reference %}}
