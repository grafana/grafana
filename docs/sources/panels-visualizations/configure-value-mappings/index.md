---
aliases:
  - ../panels/configure-value-mappings/
  - ../panels/format-data/
  - ../panels/format-data/about-value-mapping/
  - ../panels/format-data/edit-value-mapping/
  - ../panels/format-data/map-a-range/
  - ../panels/format-data/map-a-regular-expression/
  - ../panels/format-data/map-a-special-value/
  - ../panels/format-data/map-a-value/
  - ../panels/value-mappings/
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure value mappings
title: Configure value mappings
description: Configure value mappings to change how data appears in your visualizations
weight: 90
---

# Configure value mappings

In addition to field overrides, value mapping is a technique you can use to change how data appears in a visualization.

For example, the mapping applied in the following image causes the visualization to display the text `Cold`, `Good`, and `Hot` in blue, green, and red for ranges of temperatures rather than actual temperature values. Using value mappings this way can make data faster and easier to understand and interpret.

![Value mappings applied to a gauge visualization](screenshot-value-mappings-v10.4.png)

Value mappings bypass unit formatting set in the **Standard options** section of panel editor, like color or number of decimal places displayed. When value mappings are present in a panel, Grafana displays a summary of them in the **Value mappings** section of the editor panel.

## Types of value mappings

Grafana supports the following value mapping types:

### Value

A **Value** mapping maps specific values to text and a color. For example, you can configure a mapping so that all instances of the value `10` appear as **Perfection!** rather than the number. Use **Value** mapping when you want to format a single value.
![The value 10 mapped to the text Perfection!](screenshot-map-value-v10.4.png)

### Range

A **Range** mapping maps numerical ranges to text and a color. For example, if a value is within a certain range, you can configure a range value mapping to display **Low** or **High** rather than the number. Use **Range** mapping when you want to format multiple, continuous values.
![Ranges of numbers mapped to the text Low and High with colors yellow and red](screenshot-map-range-v10.4.png)

### Regex

A **Regex** mapping maps regular expressions to text and a color. For example, if a value is `www.example.com`, you can configure a regular expression value mapping so that Grafana displays **www** and truncates the domain. Use the **Regex** mapping when you want to format the text and color of a regular expression value.
![A regular expression used to truncate full URLs to the text wwww](screenshot-map-regex-v10.4.png)

### Special

A **Special** mapping maps special values like `Null`, `NaN` (not a number), and boolean values like `true` and `false` to text and color. For example, you can configure a special value mapping so that `null` values appear as **N/A**. Use the **Special** mapping when you want to format uncommon, boolean, or empty values.
![The value null mapped to the text N/A](screenshot-map-special-v10.4.png)

## Examples

Refer to the following examples to learn more about value mapping.

### Time series example

The following image shows a time series visualization with value mappings. Value mapping colors are not applied to this visualization, but the display text is shown on the axis.

![Value mappings time series example](/static/img/docs/value-mappings/value-mappings-summary-example-8-0.png)

### Stat example

The following image shows a stat visualization with value mappings and text colors applied. You can hide the sparkline so it doesn't interfere with the values.

![Value mappings stat example](/static/img/docs/value-mappings/value-mappings-stat-example-8-0.png)

### Bar gauge example

The following image shows a bar gauge visualization with value mappings. Note that the value mapping colors are applied to the text, but not to the gauges.

![Value mappings bar gauge example](/static/img/docs/value-mappings/value-mappings-bar-gauge-example-8-0.png)

### Table example

The following image shows a table visualization with value mappings. If you want value mapping colors displayed on the table, then set the cell display mode to **Color text** or **Color background**.

![Value mappings table example](/static/img/docs/value-mappings/value-mappings-table-example-8-0.png)

## Add a value mapping

1. Open a panel for which you want to map a value.
1. In panel display options, locate the **Value mappings** section and click **Add value mappings**.
1. Click **Add a new mapping** and then select one of the following:

   - **Value** - Enter the value for Grafana to match.
   - **Range** - Enter the beginning and ending values in the range for Grafana to match.
   - **Regex** - Enter the regular expression pattern for Grafana to match.
   - **Special** - Select the special value for Grafana to match.

1. (Optional) Enter display text.
1. (Optional) Set the color.
1. Click **Update** to save the value mapping.
   You can also use the dots on the left to drag and reorder value mappings in the list.

<!-- ![Value mappings example](/static/img/docs/value-mappings/value-mappings-example-8-0.png) -->
