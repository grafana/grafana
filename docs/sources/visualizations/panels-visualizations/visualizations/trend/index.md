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
aliases:
  - ../../../panels-visualizations/visualizations/trend/ # /docs/grafana/next/panels-visualizations/visualizations/trend/
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

Trend visualizations require at least two numeric fields. The x-field must use ascending numeric values. If the values aren't ascending, Grafana shows an error. When multiple frames or queries exist, you should use a [join transformation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/transform-data/) on the x-fields to produce a single frame.

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### X axis options

In the **X field** option, select a numeric field that contains ascending values.

### Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-2.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Graph styles options

The options under the **Graph styles** section let you control the general appearance of the graph, excluding [color](#standard-options). These options apply to numeric-x series.

{{< docs/shared lookup="visualizations/graph-styles-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Axis options

{{< docs/shared lookup="visualizations/axis-options-2.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data links and actions

{{< docs/shared lookup="visualizations/datalink-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
