---
aliases:
  - ../../features/panels/gauge/
  - ../../panels/visualizations/gauge-panel/
  - ../../visualizations/gauge-panel/
description: Configure options for Grafana's gauge visualization
keywords:
  - grafana
  - gauge
  - gauge panel
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Gauge
weight: 100
refs:
  calculation-types:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/calculation-types/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types/
---

# Gauge

Gauges are single-value visualizations that can repeat a gauge for every series, column or row.

{{< figure src="/static/img/docs/v66/gauge_panel_cover.png" max-width="1025px" alt="A gauge visualization">}}

{{< docs/play title="Grafana Gauge Visualization" url="https://play.grafana.org/d/KIhkVD6Gk/" >}}

The following video provides beginner steps for creating gauge panels. You'll learn the data requirements and caveats, special customizations, and much more:

{{< youtube id="QwXj3y_YpnE" >}}

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Value options

Use the following options to refine how your visualization displays the value:

### Show

Choose how Grafana displays your data.

#### Calculate

Show a calculated value based on all rows.

- **Calculation -** Select a reducer function that Grafana will use to reduce many fields to a single value. For a list of available calculations, refer to [Calculation types](ref:calculation-types).
- **Fields -** Select the fields display in the panel.

#### All values

Show a separate stat for every row. If you select this option, then you can also limit the number of rows to display.

- **Limit -** The maximum number of rows to display. Default is 5,000.
- **Fields -** Select the fields display in the panel.

## Gauge

Adjust how the gauge is displayed.

### Orientation

Choose a stacking direction.

- **Auto -** Gauges display in rows and columns.
- **Horizontal -** Gauges display top to bottom.
- **Vertical -** Gauges display left to right.

### Show threshold labels

Controls if threshold values are shown.

### Show threshold markers

Controls if a threshold band is shown outside the inner gauge value band.

### Gauge size

Choose a gauge size mode.

- **Auto -** Grafana determines the best gauge size.
- **Manual -** Manually configure the gauge size.

### Min width

Set the minimum width of vertically-oriented gauges.

If you set a minimum width, the x-axis scrollbar is automatically displayed when there's a large amount of data.

{{% admonition type="note" %}}
This option only applies when gauge size is set to manual.
{{% /admonition %}}

### Min height

Set the minimum height of horizontally-oriented gauges.

If you set a minimum height, the y-axis scrollbar is automatically displayed when there's a large amount of data.

{{% admonition type="note" %}}
This option only applies when gauge size is set to manual.
{{% /admonition %}}

### Neutral

Set the starting value from which every gauge will be filled.

## Text size

Adjust the sizes of the gauge text.

- **Title -** Enter a numeric value for the gauge title size.
- **Value -** Enter a numeric value for the gauge value size.

## Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Data links

{{< docs/shared lookup="visualizations/datalink-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
