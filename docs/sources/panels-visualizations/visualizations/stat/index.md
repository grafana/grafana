---
aliases:
  - ../../features/panels/singlestat/
  - ../../features/panels/stat/
  - ../../panels/visualizations/stat-panel/
  - ../../reference/singlestat/
  - ../../visualizations/stat-panel/
description: Configure options for Grafana's stat visualization
keywords:
  - grafana
  - docs
  - stat panel
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Stat
weight: 100
refs:
  calculation-types:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/calculation-types/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types/
  create-dashboard:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/create-dashboard/
---

# Stat

{{< admonition type="note" >}}
This visualization replaces the Singlestat visualization, which was deprecated in Grafana 7.0 and removed in Grafana 8.0.
{{< /admonition >}}

A stat visualization displays your data in single values of interest&mdash;such as the latest or current value of a series&mdash;with an optional graph sparkline. A graph sparkline, which is only available in stat visualizations, is a small time-series graph shown in the background of each value in the visualization.

For example, if you're monitoring the utilization of various services, you can use a stat visualization to show their latest usage:

![A stat panel showing latest usage of various services](/media/docs/grafana/panels-visualizations/screenshot-stat-visualization-v11.3.png)

Use a stat visualization when you need to:

- Monitor key metrics at a glance, such as the latest health of your application, number of high priority bugs in your application, or total number of sales.
- Display aggregated data, such as the average response time of your services.
- Highlight values above your normal thresholds to quickly identify if any metrics are outside your expected range.

{{< docs/play title="Stat Visualizations in Grafana" url="https://play.grafana.org/d/Zb3f4veGk/" >}}

## Configure a stat visualization

Once you've [created a dashboard](ref:create-dashboard), the following video shows you how to configure a stat visualization:

{{< youtube id="yNRnLyVntUw" start="1048" >}}

Alternatively, refer to this blog post on [how to easily retrieve values from a range in Grafana using a stat visualization](https://grafana.com/blog/2023/10/18/how-to-easily-retrieve-values-from-a-range-in-grafana-using-a-stat-panel/).

## Supported data formats

The stat visualization supports a variety of formats for displaying data. Supported formats include:

- **Single values** - The most common format and can be numerical, strings, or boolean values.
- **Time-series data** - [Calculation types](ref:calculation-types) can be applied to your time-series data to display single values over a specified time range.

### Examples

The following tables are examples of the type of data you need for a stat visualization and how it should be formatted.

#### Single numerical values

| Number of high priority bugs |
| ---------------------------- |
| 80                           |
| 52                           |
| 59                           |
| 40                           |

The data is visualized as follows, with the last value displayed, along with a sparkline and [percentage change](#value-options):

![A stat panel showing the latest number of high priority bugs](/media/docs/grafana/panels-visualizations/screenshot-stat-single-value-v11.3.png)

#### Time-series data

| Time                | Cellar | Living room | Porch | Bedroom | Guest room | Kitchen |
| ------------------- | ------ | ----------- | ----- | ------- | ---------- | ------- |
| 2024-03-20 06:34:40 | 12.3   | 18.3        | 18.8  | 15.9    | 9.29       | 9.61    |
| 2024-03-20 06:41:40 | 16.8   | 17.1        | 21.5  | 14.1    | 10.5       | 17.5    |
| 2024-03-20 06:48:40 | 16.7   | 18.0        | 21.0  | 9.51    | 13.6       | 20.1    |
| 2024-03-20 06:55:40 | 14.3   | 18.7        | 16.5  | 9.11    | 14.8       | 12.5    |
| 2024-03-20 07:02:40 | 12.8   | 15.2        | 21.1  | 15.6    | 7.98       | 13.0    |

The data is visualized as follows, with the mean value displayed for each room, along with the room name, sparkline, and unit of measurement:

![A stat panel showing some statistics for each room in square meters](/media/docs/grafana/panels-visualizations/screenshot-stat-multiple-values-v11.3.png)

By default, a stat displays one of the following:

- Just the value for a single series or field.
- Both the value and name for multiple series or fields.

You can use the [**Text mode**](#text-mode) to control how the text is displayed.

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value options

Use the following options to refine how your visualization displays its values:

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Show | Display a single value per column or series, or show values for each row. Choose from: <ul><li>**Calculate** - Display a calculated value based on all rows.</li><li>**All values** - Show a separate stat for every row. If you select this option, then you can also limit the number of rows to display.</li> |
| Calculation | This option is displayed when you select **Calculate** as your **Show** option. Select a reducer function that Grafana will use to reduce many fields to a single value. For a list of available calculations, refer to [Calculation types](ref:calculation-types). |
| Limit | This option is displayed when you select **All values** as your **Show** option. Set the maximum number of rows to display. Default is 5,000. |
| Fields | Select the fields displayed in the visualization. |

<!-- prettier-ignore-end -->

### Stat styles

The stat visualization automatically adjusts the layout depending on available width and height in the dashboard, but you can also use the following options to further style the visualization.

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Orientation | Select a stacking direction. Choose from: <ul><li>**Auto** - Grafana selects the ideal orientation.</li><li>**Horizontal** - Bars stretch horizontally, left to right.</li><li>**Vertical** - Bars stretch vertically, top to bottom.</li></ul> |
| [Text mode](#text-mode) | You can use the **Text mode** option to control what text the visualization renders. If the value is not important, only the name and color is, then change the **Text mode** to **Name**. The value will still be used to determine color and is displayed in a tooltip. |
| [Wide layout](#wide-layout) | Set whether wide layout is enabled or not. Wide layout is enabled by default. This option is only applicable when **Text mode** is set to **Value and name**. |
| Color mode | Select a color mode. Choose from: <ul><li>**None** - No color applied to the value.</li><li>**Value** - Applies color to the value and graph area.</li><li>**Background Gradient** - Applies color to the value, graph area, and background, with a slight background gradient.</li><li>**Background Solid** - Applies color to the value, graph area, and background, with a solid background color.</li></ul> |
| Graph mode | Select a graph sparkline mode. Choose from: <ul><li>**None** - Hides the graph sparkline and only shows the value.</li><li>**Area** - Shows the graph sparkline below the value. This requires that your query returns a time column.</li></ul> The graph sparkline is automatically hidden if the panel becomes too small.|
| Text alignment | Select an alignment mode. Choose from: <ul><li>**Auto** - If only a single value is shown (no repeat), then the value is centered. If multiple series or rows are shown, then the value is left-aligned.</li><li>**Center** - Stat value is centered.</li></ul> |
| Show percent change | Set whether percent change is displayed or not. Disabled by default. This option is applicable when the **Show** setting, under **Value options**, is set to **Calculate**. |
| Percent change color mode | This option is only displayed when **Show percent change** is enabled. Choose from: <ul><li>**Standard** - Green if the percent change is positive, red if the percent change is negative.</li><li>**Inverted** - Red if the percent change is positive, green if the percent change is negative.</li><li>**Same as Value** - Use the same color as the value.</li></ul> |
<!-- prettier-ignore-end -->

#### Text mode

You can use the Text mode option to control what text the visualization renders. If the value is not important, only the name and color is, then change the **Text mode** to **Name**. The value will still be used to determine color and is displayed in a tooltip.

- **Auto** - If the data contains multiple series or fields, show both name and value.
- **Value** - Show only value, never name. Name is displayed in the hover tooltip instead.
- **Value and name** - Always show value and name.
- **Name** - Show name instead of value. Value is displayed in the hover tooltip.
- **None** - Show nothing (empty). Name and value are displayed in the hover tooltip.

#### Wide layout

Set whether wide layout is enabled or not. Wide layout is enabled by default.

- **On** - Wide layout is enabled.
- **Off** - Wide layout is disabled.

This option is only applicable when **Text mode** is set to **Value and name**. When wide layout is enabled, the value and name are displayed side-by-side with the value on the right, if the panel is wide enough. When wide layout is disabled, the value is always rendered underneath the name.

### Text size

Adjust the sizes of the gauge text.

- **Title** - Enter a numeric value for the gauge title size.
- **Value** - Enter a numeric value for the gauge value size.

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
