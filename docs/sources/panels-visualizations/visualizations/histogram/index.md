---
aliases:
  - ../../features/panels/histogram/
  - ../../panels/visualizations/histogram/
  - ../../visualizations/histogram/
description: Configure options for Grafana's histogram visualization
keywords:
  - grafana
  - docs
  - bar chart
  - panel
  - barchart
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Histogram
weight: 100
refs:
  standard-calculations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/calculation-types/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types/
  color-scheme:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#color-scheme
---

# Histogram

Histograms calculate the distribution of values and present them as a bar chart. Each bar represents a bucket; the y-axis and the height of each bar represent the count of values that fall into each bucket, and the x-axis represents the value range.

For example, if you want to understand the distribution of people's heights, you can use a histogram visualization to identify patterns or insights in the data distribution:

{{< figure src="/static/img/docs/histogram-panel/histogram-example-v8-0.png" max-width="1025px" alt="A histogram visualization showing the distribution of people's heights" >}}

You can use a histogram visualization if you need to:

- Visualize and analyze data distributions over a specific time range to see how frequently certain values occur.
- Identify any outliers in your data distribution.
- Provide statistical analysis to help with decision-making

## Configure a histogram visualization

Once you’ve created a [dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/), the following video shows you how to configure a histogram visualization:

{{< youtube id="QfJ480j9-KM" >}}

{{< docs/play title="Histogram Examples" url="https://play.grafana.org/d/histogram_tests/" >}}

## Supported data formats

Histograms support time series and any table results with one or more numerical fields.

### Examples

The following tables are examples of the type of data you need for a histogram visualization and how it should be formatted.

#### Time-series table

| Time                | Walking (km) |
| ------------------- | ------------ |
| 2024-03-25 21:13:09 | 37.2         |
| 2024-03-25 21:13:10 | 37.1         |
| 2024-03-25 21:13:10 | 37.0         |
| 2024-03-25 21:13:11 | 37.2         |
| 2024-03-25 21:13:11 | 36.9         |
| 2024-03-25 21:13:12 | 36.7         |
| 2024-03-25 21:13:13 | 36.3         |

The data is converted as follows:

{{< figure src="/static/img/docs/histogram-panel/histogram-example-time-series.png" max-width="1025px" alt="A histogram visualization showing the random walk distribution." >}}

#### Basic numerical table

| Gender | Height (kg) | Weight (lbs) |
| ------ | ----------- | ------------ |
| Male   | 73.8        | 242          |
| Male   | 68.8        | 162          |
| Male   | 74.1        | 213          |
| Male   | 71.7        | 220          |
| Male   | 69.9        | 206          |
| Male   | 67.3        | 152          |
| Male   | 68.8        | 184          |

The data is converted as follows:

{{< figure src="/static/img/docs/histogram-panel/histogram-example-height-weight.png" max-width="1025px" alt="A histogram visualization showing the male height and weight distribution" >}}

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Histogram options

Use the following options to refine your histogram visualization.

### Bucket count

Specifies the number of bins used to group your data in the histogram, affecting the granularity of the displayed distribution. Leave this empty for automatic bucket count of 30.

### Bucket size

The size of the buckets. Leave this empty for automatic bucket sizing (~10% of the full range).

### Bucket offset

If the first bucket should not start at zero. A non-zero offset has the effect of shifting the aggregation window. For example, 5-sized buckets that are 0-5, 5-10, 10-15 with a default 0 offset would become 2-7, 7-12, 12-17 with an offset of 2; offsets of 0, 5, or 10, in this case, would effectively do nothing. Typically, this option would be used with an explicitly defined bucket size rather than automatic. For this setting to affect, the offset amount should be greater than 0 and less than the bucket size; values outside this range will have the same effect as values within this range.

### Combine series

This will merge all series and fields into a combined histogram.

### Stacking

Controls how multiple series are displayed in the histogram. Choose from the following:

- **Off** - Series are not stacked, but instead shown side by side.
- **Normal** - Series are stacked on top of each other, showing cumulative values.
- **100%** - Series are stacked to fill 100% of the chart, showing the relative proportion of each series.

### Line width

Controls line width of the bars.

### Fill opacity

Controls the fill opacity bars.

### Gradient mode

Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard [color scheme](ref:color-scheme) field option.

Gradient display is influenced by the **Fill opacity** setting.

Choose from the following:

- **None** - No gradient fill. This is the default setting.
- **Opacity** - Transparency of the gradient is calculated based on the values on the Y-axis. The opacity of the fill is increasing with the values on the Y-axis.
- **Hue** - Gradient color is generated based on the hue of the line color.
- **Scheme** - The selected [color palette](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/#color-scheme) is applied to the histogram bars.

## Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

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
