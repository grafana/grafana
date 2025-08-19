---
aliases:
  - ../../features/panels/bar_gauge/
  - ../../panels/visualizations/bar-gauge-panel/
  - ../../visualizations/bar-gauge-panel/
description: Configure options for Grafana's bar gauge visualization
keywords:
  - grafana
  - bar
  - bar gauge
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Bar gauge
weight: 100
refs:
  calculation-types:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/calculation-types/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types/
---

# Bar gauge

Bar gauges simplify your data by reducing every field to a single value. You choose how Grafana calculates the reduction. This visualization can show one or more bar gauges depending on how many series, rows, or columns your query returns.

{{< figure src="/static/img/docs/v66/bar_gauge_cover.png" max-width="1025px" alt="Bar gauge panel" >}}

The bar gauge visualization displays values as bars with various lengths or fills proportional to the values they represent. They differ from traditional bar charts in that they act as gauges displaying metrics between ranges. One example is a thermometer displaying body temperature in a bar filling up.

You can use a bar gauge visualization when you need to show:

- Key performance indicators (KPIs)
- System health
- Savings goals
- Attendance
- Process completion rates

## Configure a bar gauge visualization

The following video shows you how to create and configure a bar gauge visualization:

{{< youtube id="7PhDysObEXA" >}}

{{< docs/play title="Bar Gauge" url="https://play.grafana.org/d/vmie2cmWz/" >}}

## Supported data formats

To create a bar gauge visualization, you need a dataset querying at least one numeric field. Every numeric field in the dataset is displayed as a bar gauge. Text or time fields aren't required but if they're present, they're used for labeling.

### Example 1

| Label | Value1 | Value2 | Value3 |
| ----- | ------ | ------ | ------ |
| Row1  | 5      | 3      | 2      |

![Bar gauge with single row of data](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.1-bargauge-example1.png)

The minimum and maximum range for the bar gauges is automatically pulled from the largest and smallest numeric values in the dataset. You can also manually define the minimum and maximum values as indicated in the [Standard options](#standard-options) section.

You can also define the minimum and maximum from the dataset provided.

### Example 2

| Label | Value | Max | Min |
| ----- | ----- | --- | --- |
| Row1  | 3     | 6   | 1   |

![Bar gauge with single row of data including maximum and minimum](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.1-bargauge-example2.png)

If you don’t want to show gauges for the min and max values, you can configure only one field to be displayed as described in the [Value options](#value-options) section.

![Bar gauge, single row of data with max and min displaying value](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.1-bargauge-example3.png)

Even if the min and max aren’t displayed, the visualization still pulls the range from the data set.

### Example 3

The bar gauge visualization also supports multiple records (rows) in the dataset.

| Label | Value1 | Value2 | Value3 |
| ----- | ------ | ------ | ------ |
| Row1  | 5      | 3      | 2      |
| Row2  | 10     | 6      | 4      |
| Row3  | 20     | 8      | 2      |

![Bar gauge with multiple rows of data displaying last row](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.1-bargauge-example4.png)

By default, the visualization is configured to [calculate](#value-options) a single value per column or series and to display only the last set of data. However, it derives the minimum and maximum from the full dataset even if those values aren’t visible. In this example, that means only the last row of data is displayed in the gauges and the minimum and maximum values are defined as 2 and 20, pulled from the whole dataset.

If you want to show one gauge per cell you can change the **Show** setting from **Calculate** to **All values** and each bar is labeled by concatenating the text column with each value's column name.

![Bar gauge with multiple rows of data displaying all the values](/media/docs/grafana/panels-visualizations/screenshot-grafana-12.1-bargauge-example5.png)

For more information on these settings, refer to [Value options](#value-options).

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value options

Use the following options to refine how your visualization displays the value:

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Show | Set how Grafana displays your data. Choose from:<ul><li>**Calculate** - Show a calculated value based on all rows.</li><li>**All values** - Show a separate value for every row. If you select this option, then you can also limit the number of rows to display.</li></ul> |
| Calculation | If you chose **Calculate** as your **Show** option, select a reducer function that Grafana will use to reduce many fields to a single value. For a list of available calculations, refer to [Calculation types](ref:calculation-types). |
| Limit | If you chose **All values** as your **Show** option, enter the maximum number of rows to display. The default is 5,000. |
| Fields | Select the fields display in the panel. |

<!-- prettier-ignore-end -->

### Bar gauge options

Adjust how the gauge is displayed.

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Orientation | Choose a stacking direction:<ul><li>**Auto** - Grafana determines the best orientation.</li><li>**Horizontal** - Bars stretch horizontally, left to right.</li><li>**Vertical** - Bars stretch vertically, bottom to top.</li></ul> |
| Display mode | Choose a display mode:<ul><li>**Gradient** - Threshold levels define a gradient.</li><li>**Retro LCD** - The bar is split into sections that are lit or unlit.</li><li>**Basic** - Single color based on the matching threshold.</li></ul> |
| Value display | Choose a value display mode:<ul><li>**Value color** - Value color is determined by value.</li><li>**Text color** - Value color is default text color.</li><li>**Hidden** - Values are hidden.</li></ul> |
| Name placement | Set the name placement mode when the bar gauge orientation is **Auto** or **Horizontal**. Choose from:<ul><li>**Auto** - Grafana determines the best placement.</li><li>**Top** - Names are placed on top of each bar gauge.</li><li>**Left** - Names are placed to the left of each bar gauge.</li><li>**Hidden** - Names are hidden.</li></ul> <p>When the bar gauge is in the vertical orientation, choose from **Auto** (names are always placed at the bottom of each bar) or **Hidden**.</p>|
| Show unfilled area | Select if you want to render the unfilled region of the bars as dark gray. Not applicable to **Retro LCD** display mode. |
| Bar size | Choose a bar size mode:<ul><li>**Auto** - Grafana determines the best bar size.</li><li>**Manual** - Manually configure the bar size.</li></ul> |
| Min width | Limit the minimum width of the bar column when the gauge is oriented vertically or is in **Auto** mode. Automatically shows the x-axis scroll bar when there's a large amount of data.<p>This option only applies when the **Bar size** mode is set to **Manual**.</p> |
| Min height | Limit the minimum height of the bar row when the bar gauge is oriented horizontally or is in **Auto** mode. Automatically shows the y-axis scroll bar when there's a large amount of data. <p>This option only applies when the **Bar size** mode is set to **Manual**.</p> |
| Max height | Limit the maximum height of the bar row when the bar gauge is oriented horizontally or is in **Auto** mode. Automatically shows the y-axis scroll bar when there's a large amount of data. <p>This option only applies when the **Bar size** mode is set to **Manual**.</p> |

<!-- prettier-ignore-end -->

### Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Text size options

Set the sizes of the following text elements in pixels:

- **Title** - Bar name
- **Value** - Bar value

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data links and actions

{{< docs/shared lookup="visualizations/datalink-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
