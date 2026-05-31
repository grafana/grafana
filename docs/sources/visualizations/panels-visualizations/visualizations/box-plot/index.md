---
description: Configure options for Grafana's box plot visualization
keywords:
  - grafana
  - box plot
  - boxplot
  - box-and-whisker
  - quartiles
  - panel
  - documentation
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Box plot
weight: 100
refs:
  reduce-transformation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#reduce
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/#reduce
  data-transformation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/
  color-scheme:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#color-scheme
  configure-field-overrides:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/
---

# Box plot

The box plot visualization shows the distribution of a set of values using box-and-whisker geometry.
Each row in your data becomes one box on a categorical x-axis, which makes it useful for comparing how
values spread across groups such as services, regions, or time buckets.

The box plot is a _drawing_ visualization: it maps the summary statistics in your data onto box-and-whisker
shapes. It doesn't calculate the statistics for you. To turn raw values into the summary your data needs,
add a [Reduce transformation](ref:reduce-transformation) first. For more information, refer to
[Transform data](ref:data-transformation).

Use a box plot when you need to:

- Compare the spread and skew of values across several categories at a glance.
- Highlight the median and interquartile range (IQR) of each group.
- Surface outliers that fall outside the whiskers.

Each box spans the first quartile (Q1) to the third quartile (Q3), with a line drawn at the median. The
whiskers extend from the box to the lowest and highest values that aren't outliers, and outliers appear as
individual points beyond the whiskers.

## Supported data formats

The box plot expects one row per box, where each numeric field holds a summary statistic. The category label
for each box comes from the first string field, then the first time field, and finally the row index if
neither exists.

The visualization maps fields to box dimensions automatically by name, so a query that already returns the
summary renders with no extra configuration. You can override any mapping in the panel options.

To draw a box, your data must include the following fields:

- **Lower quartile (Q1)** - The lower edge of the box.
- **Median** - The line inside the box.
- **Upper quartile (Q3)** - The upper edge of the box.

Rows that don't have Q1, median, and Q3 are skipped.

### Five-number summary

When your data provides `min`, `q1`, `median`, `q3`, and `max`, the box plot draws a five-number summary. The
whiskers extend to the minimum and maximum, and no outliers appear.

| Service | min | q1  | median | q3  | max |
| ------- | --- | --- | ------ | --- | --- |
| auth    | 12  | 28  | 41     | 55  | 88  |
| search  | 8   | 19  | 24     | 33  | 61  |
| upload  | 21  | 44  | 60     | 79  | 140 |

### Seven-number summary

When your data also provides a lower whisker and an upper whisker, the box plot draws a seven-number summary.
The whiskers extend to the lower and upper whisker values, and the minimum and maximum render as outlier
points when they fall beyond the whiskers.

| Service | min | lowerWhisker | q1  | median | q3  | upperWhisker | max |
| ------- | --- | ------------ | --- | ------ | --- | ------------ | --- |
| auth    | 2   | 18           | 28  | 41     | 55  | 76           | 120 |
| search  | 1   | 11           | 19  | 24     | 33  | 49           | 90  |

The data decides whether the box plot draws a five- or seven-number summary. There's no panel option to switch
between them — map a lower and upper whisker to get outliers, or leave them unmapped to draw whiskers to the
minimum and maximum.

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Box plot options

The following options let you map your data fields to box dimensions and control how each box appears. Leave a
field mapping empty to detect it automatically by name.

| Option              | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| Minimum             | Lowest value. Drawn as an outlier when a lower whisker is mapped.       |
| Lower quartile (Q1) | First quartile (25th percentile). Lower edge of the box.                |
| Median              | Median (50th percentile). Line inside the box.                          |
| Upper quartile (Q3) | Third quartile (75th percentile). Upper edge of the box.                |
| Maximum             | Highest value. Drawn as an outlier when an upper whisker is mapped.     |
| Lower whisker       | Optional lower whisker end. Enables outliers below it.                  |
| Upper whisker       | Optional upper whisker end. Enables outliers above it.                  |
| Box width           | Set the width of each box relative to its category slot, from 0.1 to 1. |
| Outlier size        | Set the radius of outlier points, in pixels, from 1 to 20.              |

#### Automatic field mapping

The box plot matches fields by their lowercased display name, including the column names produced by the
[Reduce transformation](ref:reduce-transformation). For example, `q1`, `p25`, `25%`, `25th %`, and
`lower quartile` all map to the lower quartile. When more than one field could match a dimension, the first
matching field in the data wins. Map a field manually to override automatic detection.

### Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Axis options

{{< docs/shared lookup="visualizations/axis-options-2.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

Use the **Color scheme** standard option to set the color of each box. For more information, refer to
[Color scheme](ref:color-scheme). To color boxes individually, use a [field override](ref:configure-field-overrides).

### Data links and actions

{{< docs/shared lookup="visualizations/datalink-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
