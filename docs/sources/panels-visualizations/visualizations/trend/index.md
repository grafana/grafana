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

Trend visualizations should be used for datasets that have a sequential, numeric X that is not time. Some examples are function graphs, rpm/torque curves, supply/demand relationships, and elevation or heart rate plots along a race course (with x as distance or duration from start).

Trend visualizations support all visual styles and options available in the [time series visualization](ref:time-series-visualization) with these exceptions:

- No annotations or time regions
- No shared cursor/crosshair
- No multi-timezone x axis
- No ability to change the dashboard time range via drag-selection

## X Field selection

Use this option to select a field that contains increasing numeric values.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-trend-speed-xvalue.png" max-width="750px" caption="Trend x value selection" >}}

For example, you could represent engine power and torque versus speed where speed is plotted on the x axis and power and torque are plotted on the y axes.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-trend-panel-new-colors.png" max-width="750px" caption="Trend engine power and torque curves" >}}

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Data links and actions

{{< docs/shared lookup="visualizations/datalink-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
