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

Gauges are single-value visualizations that allow you to quickly visualize where a value falls within a defined or calculated min and max range. With repeat options, you can display multiple gauges, each corresponding to a different series, column, or row.

{{< figure src="/static/img/docs/v66/gauge_panel_cover.png" max-width="1025px" alt="A gauge visualization">}}

You can use gauges if you need to track:

- Service level objectives (SLOs)
- How full a piece of equipment is
- How fast a vehicle is moving within a set of limits
- Network latency
- Equipment state with setpoint and alarm thresholds
- CPU consumption (0-100%)
- RAM availability

## Configure a time series visualization

The following video provides beginner steps for creating gauge panels. You'll learn the data requirements and caveats, special customizations, and much more:

{{< youtube id="QwXj3y_YpnE" >}}

{{< docs/play title="Grafana Gauge Visualization" url="https://play.grafana.org/d/KIhkVD6Gk/" >}}

## Supported data formats

To create a gauge visualization you need a dataset containing at least one numeric field. These values are identified by the field name. Additional text fields aren’t required but can be used for identification and labeling.

### Example - One value

| GaugeName | GaugeValue |
| --------- | ---------- |
| MyGauge   | 5          |

![Gauge with single numeric value](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.2-gauge-example1.png 'Gauge with single numeric value')

This dataset generates a visualization with one empty gauge showing the numeric value. This is because the gauge visualization automatically defines the upper and lower range from the minimum and maximum values in the dataset. This dataset has only one value, so it’s set as both minimum and maximum.

If you only have one value, but you want to define a different minimum and maximum, you can set them manually in the [Standard options](#standard-options) settings to generate a more typical looking gauge.

![Gauge with single numeric value and hardcoded max and min](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.2-gauge-example2.png 'Gauge with single numeric value and hardcoded max-min')

### Example - One row, multiple values

The gauge visualization can support multiple fields in a dataset. <!-- In this case, multiple gauges are displayed. -->

| Identifier | value1 | value2 | value3 |
| ---------- | ------ | ------ | ------ |
| Gauges     | 5      | 3      | 10     |

![Gauge visualization with multiple numeric values in a single row](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.2-gauge-example3.png 'Gauge with multiple numeric values in a single row')

When there are multiple values in the dataset, the visualization displays multiple gauges and automatically defines the minimum and maximum. In this case, those are 3 and 10. Because the minimum and maximum values are defined, each gauge is shaded in to show that value in relation to the minimum and maximum.

### Example - Multiple rows and values

The gauge visualization can display datasets with multiple rows of data or even multiple datasets.

| Identifier | value1 | value2 | value3 |
| ---------- | ------ | ------ | ------ |
| Gauges     | 5      | 3      | 10     |
| Indicators | 6      | 9      | 15     |
| Defaults   | 1      | 4      | 8      |

![Gauge visualization with multiple rows and columns of numeric values showing the last row](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.2-gauge-example6.png 'Gauge viz with multiple rows and columns of numeric values showing the last row')

By default, the visualization is configured to [calculate](#value-options) a single value per column or series and to display only the last row of data. However, it derives the minimum and maximum from the full dataset, even if those values aren’t visible.

In this example, that means only the last row of data is displayed in the gauges and the minimum and maximum values are 1 and 10. The value 1 is displayed because it’s in the last row, while 10 is not.

If you want to show one gauge per table cell, you can change the **Show** setting from **Calculate** to **All values**, and each gauge is labeled by concatenating the text column with each value's column name.

![Gauge visualization with multiple rows and columns of numeric values showing all the values](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.2-gauge-example7.png 'Gauge viz with multiple rows and columns of numeric values showing all the values')

### Example - Defined min and max

You can also define minimum and maximum values as part of the dataset.

| Identifier | value | max | min |
| ---------- | ----- | --- | --- |
| Gauges     | 5     | 10  | 2   |

![Gauge visualization with numeric values defining max and minimum](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.2-gauge-example4.png 'Gauge with numeric values defining max and minimum')

If you don’t want to display gauges for the `min` and `max` values, you can configure only one field to be displayed as described in the [value options](#value-options) section.

![Gauge visualization with numeric values defining max and minimum but hidden](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.2-gauge-example5.png 'Gauge with numeric values defining max and minimum but hidden')

Even when minimum and maximum values aren’t displayed, the visualization still pulls the range from them.

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

Last, gauge colors and thresholds (the outer bar markers) of the gauge can be configured as described above.

![Gauge viz with multiple rows and columns of numeric values showing all the values and thresholds defined for 0-6-11](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.2-gauge-example8.png 'Gauge viz with multiple rows and columns of numeric values showing all the values and thresholds defined for 0-6-11')

## Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
