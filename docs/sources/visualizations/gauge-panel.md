---
aliases:
  - ../features/panels/gauge/
  - ../panels/visualizations/gauge-panel/
description: Gauge panel docs
keywords:
  - grafana
  - gauge
  - gauge panel
title: Gauge
weight: 400
---

# Gauge

Gauge is a single-value visualization that can repeat a gauge for every series, column or row.

{{< figure src="/static/img/docs/v66/gauge_panel_cover.png" max-width="1025px" >}}

## Value options

Use the following options to refine how your visualization displays the value:

### Show

Choose how Grafana displays your data.

#### Calculate

Show a calculated value based on all rows.

- **Calculation -** Select a reducer function that Grafana will use to reduce many fields to a single value. For a list of available calculations, refer to [List of calculations]({{< relref "../panels/reference-calculation-types.md" >}}).
- **Fields -** Select the fields display in the panel.

#### All values

Show a separate stat for every row. If you select this option, then you can also limit the number of rows to display.

- **Limit -** The maximum number of rows to display. Default is 5,000.
- **Fields -** Select the fields display in the panel.

## Gauge

Adjust how the gauge is displayed.

- **Show threshold labels -** Controls if threshold values are shown.
- **Show threshold markers -** Controls if a threshold band is shown outside the inner gauge value band.

## Text size

Adjust the sizes of the gauge text.

- **Title -** Enter a numeric value for the gauge title size.
- **Value -** Enter a numeric value for the gauge value size.
