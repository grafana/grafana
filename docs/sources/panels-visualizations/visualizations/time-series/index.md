---
aliases:
  - ../../features/panels/histogram/
  - ../../panels/visualizations/time-series/
  - ../../panels/visualizations/time-series/annotate-time-series/
  - ../../panels/visualizations/time-series/change-axis-display/
  - ../../panels/visualizations/time-series/graph-color-scheme/
  - ../../panels/visualizations/time-series/graph-time-series-as-bars/
  - ../../panels/visualizations/time-series/graph-time-series-as-lines/
  - ../../panels/visualizations/time-series/graph-time-series-as-points/
  - ../../panels/visualizations/time-series/graph-time-series-stacking/
  - ../../visualizations/time-series/
  - ../../visualizations/time-series/annotate-time-series/
  - ../../visualizations/time-series/change-axis-display/
  - ../../visualizations/time-series/graph-color-scheme/
  - ../../visualizations/time-series/graph-time-series-as-bars/
  - ../../visualizations/time-series/graph-time-series-as-lines/
  - ../../visualizations/time-series/graph-time-series-as-points/
  - ../../visualizations/time-series/graph-time-series-stacking/
keywords:
  - grafana
  - graph panel
  - time series panel
  - documentation
  - guide
  - graph
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's time series visualization
title: Time series
menuTitle: Time series
weight: 10
refs:
  link-alert:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
  panel-data-section:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-editor-overview/#data-section
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/panel-editor-overview/#data-section
---

# Time series

Time series visualizations are the default way to show the variations of a set of data values over time. Each data point is matched to a timestamp and this _time series_ is displayed as a graph. The visualization can render series as lines, points, or bars and it's versatile enough to display almost any type of [time-series data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries/).

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-time-series-v12.0.png" max-width="750px" alt="Time series visualization" >}}

{{< admonition type="note" >}}
You can migrate from the legacy Graph visualization to the time series visualization. To migrate, open the panel and click the **Migrate** button in the side pane.
{{< /admonition >}}

A time series visualization displays an x-y graph with time progression on the x-axis and the magnitude of the values on the y-axis. This visualization is ideal for displaying large numbers of timed data points that would be hard to track in a table or list.

You can use the time series visualization if you need track:

- Temperature variations throughout the day
- The daily progress of your retirement account
- The distance you jog each day over the course of a year

## Configure a time series visualization

The following video guides you through the creation steps and common customizations of time series visualizations, and is great for beginners:

{{< youtube id="RKtW87cPxsw" >}}

{{< docs/play title="Time Series Visualizations in Grafana" url="https://play.grafana.org/d/000000016/" >}}

## Supported data formats

Time series visualizations require time-series data—a sequence of measurements, ordered in time, and formatted as a table—where every row in the table represents one individual measurement at a specific time. Learn more about [time-series data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries/).

The dataset must contain at least one numeric field, and in the case of multiple numeric fields, each one is plotted as a new line, point, or bar labeled with the field name in the tooltip.

### Example 1

In the following example, there are three numeric fields represented by three lines in the chart:

| Time                | value1 | value2 | value3 |
| ------------------- | ------ | ------ | ------ |
| 2022-11-01 10:00:00 | 1      | 2      | 3      |
| 2022-11-01 11:00:00 | 4      | 5      | 6      |
| 2022-11-01 12:00:00 | 7      | 8      | 9      |
| 2022-11-01 13:00:00 | 4      | 5      | 6      |

![Time series line chart with multiple numeric fields](/media/docs/grafana/panels-visualizations/screenshot-grafana-11.1-timeseries-example1v2.png 'Time series line chart with multiple numeric fields')

If the time field isn't automatically detected, you might need to convert the data to a time format using a [data transformation](ref:panel-data-section).

### Example 2

The time series visualization also supports multiple datasets. If all datasets are in the correct format, the visualization plots the numeric fields of all datasets and labels them using the column name of the field.

#### Query1

| Time                | value1 | value2 | value3 |
| ------------------- | ------ | ------ | ------ |
| 2022-11-01 10:00:00 | 1      | 2      | 3      |
| 2022-11-01 11:00:00 | 4      | 5      | 6      |
| 2022-11-01 12:00:00 | 7      | 8      | 9      |

#### Query2

| timestamp           | number1 | number2 | number3 |
| ------------------- | ------- | ------- | ------- |
| 2022-11-01 10:30:00 | 11      | 12      | 13      |
| 2022-11-01 11:30:00 | 14      | 15      | 16      |
| 2022-11-01 12:30:00 | 17      | 18      | 19      |
| 2022-11-01 13:30:00 | 14      | 15      | 16      |

![Time series line chart with two datasets](/media/docs/grafana/panels-visualizations/screenshot-grafana-11.1-timeseries-example2v2.png 'Time series line chart with two datasets')

### Example 3

If you want to more easily compare events between different, but overlapping, time frames, you can do this by using a time offset while querying the compared dataset:

#### Query1

| Time                | value1 | value2 | value3 |
| ------------------- | ------ | ------ | ------ |
| 2022-11-01 10:00:00 | 1      | 2      | 3      |
| 2022-11-01 11:00:00 | 4      | 5      | 6      |
| 2022-11-01 12:00:00 | 7      | 8      | 9      |

#### Query2

| timestamp(-30min)   | number1 | number2 | number3 |
| ------------------- | ------- | ------- | ------- |
| 2022-11-01 10:30:00 | 11      | 12      | 13      |
| 2022-11-01 11:30:00 | 14      | 15      | 16      |
| 2022-11-01 12:30:00 | 17      | 18      | 19      |
| 2022-11-01 13:30:00 | 14      | 15      | 16      |

![Time Series Example with second Data Set offset](/media/docs/grafana/panels-visualizations/screenshot-grafana-11.1-timeseries-example3v2.png 'Time Series Example with second Data Set offset')

When you add the offset, the resulting visualization makes the datasets appear to be occurring at the same time so that you can compare them more easily.

## Alert rules

You can [link alert rules](ref:link-alert) to time series visualizations in the form of annotations to observe when alerts fire and are resolved. In addition, you can create alert rules from the **Alert** tab within the [panel editor](ref:panel-data-section).

## Special overrides

The following overrides help you further refine a time series visualization.

### Transform override property

Use the **Graph styles > Transform** [override property](#field-overrides) to transform series values without affecting the values shown in the tooltip, context menu, or legend. Choose from the following transform options:

- **Constant** - Show the first value as a constant line.
- **Negative Y transform** - Flip the results to negative values on the y-axis.

### Fill below to override property

The **Graph styles > Fill below to** [override property](#field-overrides) fills the area between two series. When you configure the property, select the series for which you want the fill to stop.

The following example shows three series: Min, Max, and Value. The Min and Max series have **Line width** set to 0. Max has a **Fill below to** override set to Min, which fills the area between Max and Min with the Max line color.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-fill-below-to-v12.0.png" max-width="600px" alt="Fill below to example" >}}

{{< docs/shared lookup="visualizations/multiple-y-axes.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+2" >}}

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-2.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1">}}

### Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Axis options

{{< docs/shared lookup="visualizations/axis-options-1.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Graph styles options

The options under the **Graph styles** section let you control the general appearance of the graph, excluding [color](#standard-options).

{{< docs/shared lookup="visualizations/graph-styles-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

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
