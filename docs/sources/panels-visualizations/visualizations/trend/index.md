---
keywords:
  - grafana
  - graph panel
  - trend panel
  - documentation
  - guide
  - graph
  - line chart
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's trend visualization
title: Trend
weight: 100
refs:
  time-series-visualization:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
---

# Trend

Trend visualizations should be used for datasets that have a sequential, numeric x-field that is not time. Some examples are function graphs, rpm/torque curves, supply/demand relationships, and elevation or heart rate plots along a race course (with x as distance or duration from start).

For example, you could represent engine power and torque versus speed where speed is plotted on the x-axis and power and torque are plotted on the y-axes:

{{< figure src="/media/docs/grafana/screenshot-trend-visualization-v12.0.png" max-width="750px" alt="Trend engine power and torque curves" >}}

Trend visualizations support all visual styles and options available in the [time series visualization](ref:time-series-visualization) with these exceptions:

- No annotations or time regions
- No shared cursor/crosshair
- No multi-timezone x-axis
- No ability to change the dashboard time range using drag-selection

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### X axis options

In the **X field** option, select a field that contains increasing numeric values.

### Tooltip options

Tooltip options control the information overlay that appears when you hover over data points in the visualization.

| Option                                  | Description                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [Tooltip mode](#tooltip-mode)           | When you hover your cursor over the visualization, Grafana can display tooltips. Choose how tooltips behave.                   |
| [Values sort order](#values-sort-order) | This option controls the order in which values are listed in a tooltip.                                                        |
| [Hover proximity](#hover-proximity)     | Set the hover proximity (in pixels) to control how close the cursor must be to a data point to trigger the tooltip to display. |

#### Tooltip mode

When you hover your cursor over the visualization, Grafana can display tooltips. Choose how tooltips behave.

- **Single -** The hover tooltip shows only a single series, the one that you are hovering over on the visualization.
- **All -** The hover tooltip shows all series in the visualization. Grafana highlights the series that you are hovering over in bold in the series list in the tooltip.
- **Hidden -** Do not display the tooltip when you interact with the visualization.

Use an override to hide individual series from the tooltip.

#### Values sort order

When you set the **Tooltip mode** to **All**, the **Values sort order** option is displayed. This option controls the order in which values are listed in a tooltip. Choose from the following:

- **None** - Grafana automatically sorts the values displayed in a tooltip.
- **Ascending** - Values in the tooltip are listed from smallest to largest.
- **Descending** - Values in the tooltip are listed from largest to smallest.

#### Hover proximity

Set the hover proximity (in pixels) to control how close the cursor must be to a data point to trigger the tooltip to display.

![Adding a hover proximity limit for tooltips](/media/docs/grafana/gif-grafana-10-4-hover-proximity.gif)

### Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Graph styles options

The options under the **Graph styles** section let you control the general appearance of the graph, excluding [color](#standard-options).

{{< docs/shared lookup="visualizations/graph-styles-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Axis options

{{< docs/shared lookup="visualizations/axis-options-2.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data links

{{< docs/shared lookup="visualizations/datalink-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
