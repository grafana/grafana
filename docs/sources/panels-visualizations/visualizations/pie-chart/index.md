---
aliases:
  - ../../panels/visualizations/pie-chart-pane/
  - ../../visualizations/pie-chart-panel/
keywords:
  - grafana
  - pie chart
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's pie chart visualization
title: Pie chart
weight: 100
refs:
  calculation-types:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/calculation-types/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/calculation-types/
---

# Pie chart

{{< figure src="/static/img/docs/pie-chart-panel/pie-chart-example.png" max-width="1200px" lightbox="true" caption="Pie charts" >}}

Pie charts display reduced series, or values in a series, from one or more queries, as they relate to each other, in the form of slices of a pie. The arc length, area and central angle of a slice are all proportional to the slices value, as it relates to the sum of all values. This type of chart is best used when you want a quick comparison of a small set of values in an aesthetically pleasing form.

## Configure a pie chart visualization

The following video guides you through the creation steps and common customizations of pie chart visualizations and is great for beginners:

{{< youtube id="A_lDhM9w4_g" >}}

{{< docs/play title="Grafana Bar Charts and Pie Charts" url="https://play.grafana.org/d/ktMs4D6Mk/" >}}

## Supported data formats

The pie chart visualization requires a dataset with at least one row of numeric values to be added together. If the first row contains column titles, it's used to display and identify the values in the pie chart. Cells with non-numeric values are not displayed in the pie chart.

Example:

| Description   | Internet Explorer | Chrome |
| ------------- | ----------------- | ------ |
| Other users   | 1.5               | 7      |
| English users | 17.5              | 50     |

If the dataset contains multiple rows, the visualization displays the last row by default, but multiple rows can be configured as described in the [Value options](#value-options) section. If you configure multiple rows to be displayed, the panel concatenates the text fields of each row with the numeric column titles.

It is recommended to use only one data set with the pie chart, if multiple data sets are present the numeric values configured in the _Value options_ section will be added up and displayed from all the data sets.

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Value options

Use the following options to refine the value in your visualization.

### Show

Choose how much information to show.

- **Calculate -** Reduces each value to a single value per series.
- **All values -** Displays every value from a single series.

### Calculation

Select a calculation to reduce each series when Calculate has been selected. For information about available calculations, refer to [Calculation types](ref:calculation-types).

### Limit

When displaying every value from a single series, this limits the number of values displayed.

### Fields

Select which field or fields to display in the visualization. Each field name is available on the list, or you can select one of the following options:

- **Numeric fields -** All fields with numerical values.
- **All fields -** All fields that are not removed by transformations.
- **Time -** All fields with time values.

## Pie chart options

Use these options to refine how your visualization looks.

### Pie chart type

Select the pie chart display style.

### Pie

![Pie type chart](/static/img/docs/pie-chart-panel/pie-type-chart-7-5.png)

### Donut

![Donut type chart](/static/img/docs/pie-chart-panel/donut-type-chart-7-5.png)

### Labels

Select labels to display on the pie chart. You can select more than one.

- **Name -** The series or field name.
- **Percent -** The percentage of the whole.
- **Value -** The raw numerical value.

Labels are displayed in white over the body of the chart. You might need to select darker chart colors to make them more visible. Long names or numbers might be clipped.

The following example shows a pie chart with **Name** and **Percent** labels displayed.

![Pie chart labels](/static/img/docs/pie-chart-panel/pie-chart-labels-7-5.png)

## Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Legend options

Use these settings to define how the legend appears in your visualization. For more information about the legend, refer to [Configure a legend]({{< relref "../../configure-legend" >}}).

### Visibility

Toggle the switch to turn the legend on or off.

### Mode

Use these settings to define how the legend appears in your visualization.

- **List -** Displays the legend as a list. This is a default display mode of the legend.
- **Table -** Displays the legend as a table.

### Placement

Choose where to display the legend.

- **Bottom -** Below the graph.
- **Right -** To the right of the graph.

#### Width

Control how wide the legend is when placed on the right side of the visualization. This option is only displayed if you set the legend placement to **Right**.

### Values

Select values to display in the legend. You can select more than one.

- **Percent:** The percentage of the whole.
- **Value:** The raw numerical value.

## Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Data links

{{< docs/shared lookup="visualizations/datalink-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
