---
aliases:
  - /docs/grafana/latest/panels/configure-value-mappings/
  - /docs/grafana/latest/panels/format-data/
  - /docs/grafana/latest/panels/value-mappings/
  - /docs/grafana/latest/panels/format-data/about-value-mapping/
  - /docs/grafana/latest/panels/format-data/edit-value-mapping/
  - /docs/grafana/latest/panels/format-data/map-a-range/
  - /docs/grafana/latest/panels/format-data/map-a-regular-expression/
  - /docs/grafana/latest/panels/format-data/map-a-special-value/
  - /docs/grafana/latest/panels/format-data/map-a-value/
title: Configure value mappings
menuTitle: Configure value mappings
weight: 600
---

# Configure value mappings

In addition to field overrides, value mapping is a technique that you can use to change the visual treatment of data that appears in a visualization.

Values mapped via value mappings bypass the unit formatting. This means that a text value mapped to a numerical value is not formatted using the configured unit.

![Value mappings example](/static/img/docs/value-mappings/value-mappings-example-8-0.png)

If value mappings are present in a panel, then Grafana displays a summary in the side pane of the panel editor.

> **Note:** The new value mappings are not compatible with some visualizations, such as Graph (old), Text, and Heatmap.

## Types of value mappings

Grafana supports the following value mappings:

- **Value:** Maps text values to a color or different display text. For example, you can configure a value mapping so that all instances of the value `10` appear as **Perfection!** rather than the number.
- **Range:** Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display **Low** or **High** rather than the number.
- **Regex:** Maps regular expressions to replacement text and a color. For example, if a value is `www.example.com`, you can configure a regex value mapping so that Grafana displays **www** and truncates the domain.
- **Special** Maps special values like `Null`, `NaN` (not a number), and boolean values like `true` and `false` to a display text and color. For example, you can configure a special value mapping so that `null` values appear as **N/A**.

You can also use the dots on the left to drag and reorder value mappings in the list.

## Examples

Refer to the following examples to learn more about value mapping.

### Time series example

The following image shows a time series visualization with value mappings. Value mapping colors are not applied to this visualization, but the display text is shown on the axis.

![Value mappings time series example](/static/img/docs/value-mappings/value-mappings-summary-example-8-0.png)

### Stat example

The following image shows a Stat visualization with value mappings and text colors applied. You can hide the sparkline so it doesn't interfere with the values.

![Value mappings stat example](/static/img/docs/value-mappings/value-mappings-stat-example-8-0.png)

### Bar gauge example

The following image shows a bar gauge visualization with value mappings. The value mapping colors are applied to the text, but not to the gauges.

![Value mappings bar gauge example](/static/img/docs/value-mappings/value-mappings-bar-gauge-example-8-0.png)

### Table example

The following image shows a table visualization with value mappings. If you want value mapping colors displayed on the table, then set the cell display mode to **Color text** or **Color background**.

![Value mappings table example](/static/img/docs/value-mappings/value-mappings-table-example-8-0.png)

## Map a value

Map a value when you want to format a single value.

1. Open a panel for which you want to map a value.
1. In panel display options, locate the **Value mappings** section and click **Add value mappings**.
1. Click **Add a new mapping** and then select **Value**.
1. Enter the value for Grafana to match.
1. (Optional) Enter display text.
1. (Optional) Set the color.
1. Click **Update** to save the value mapping.

![Map a value](/static/img/docs/value-mappings/map-value-8-0.png)

## Map a range

Map a range of values when you want to format multiple, continuous values.

1. Edit the panel for which you want to map a range of values.
1. In panel display options, in the **Value mappings** section, click **Add value mappings**.
1. Click **Add a new mapping** and then select **Range**.
1. Enter the beginning and ending values in the range for Grafana to match.
1. (Optional) Enter display text.
1. (Optional) Set the color.
1. Click **Update** to save the value mapping.

![Map a range](/static/img/docs/value-mappings/map-range-8-0.png)

## Map a regular expression

Map a regular expression when you want to format the text and color of a regular expression value.

1. Edit the panel for which you want to map a regular expression.
1. In the **Value mappings** section of the panel display options, click **Add value mappings**.
1. Click **Add a new mapping** and then select **Regex**.
1. Enter the regular expression pattern for Grafana to match.
1. (Optional) Enter display text.
1. (Optional) Set the color.
1. Click **Update** to save the value mapping.

## Map a special value

Map a special value when you want to format uncommon, boolean, or empty values.

1. Edit the panel for which you want to map a special value.
1. In panel display options, locate the **Value mappings** section and click **Add value mappings**.
1. Click **Add a new mapping** and then select **Special**.
1. Select the special value for Grafana to match.
1. (Optional) Enter display text.
1. (Optional) Set the color.
1. Click **Update** to save the value mapping.

![Map a value](/static/img/docs/value-mappings/map-special-value-8-0.png)

## Edit a value mapping

You can change a value mapping at any time.

1. Edit the panel that contains the value mapping you want to edit.
1. In the panel display options, in the **Value mappings** section, click **Edit value mappings**.
1. Make the changes and click **Update**.
