---
aliases:
  - /docs/sources/panels/format-data/about-value-mapping/
title: About value mapping
weight: 10
---

# About value mapping

Value mapping allows you to replace values or ranges in your visualizations with words or emojis.

Values mapped via value mappings will skip the unit formatting. This means that a text value mapped to a numerical value will not be formatted using the configured unit.

![Value mappings example](/static/img/docs/value-mappings/value-mappings-example-8-0.png)

If value mappings are present in a panel, then Grafana displays a summary in the side pane of the panel editor.

> **Note:** The new value mappings are not compatible with some visualizations, such as Graph (old), Text, and Heatmap.

## Types of value mappings

Grafana supports the following value mappings:

- **Value** maps text values to a color or different display text. For example, if a value is `10`, I want Grafana to display **Perfection!** rather than the number.
- **Range** maps numerical ranges to a display text and color. For example, if a value is within a certain range, I want Grafana to display **Low** or **High** rather than the number.
- **Regex** maps regular expressions to replacement text and a color. For example, if a value is 'www.example.com', I want Grafana to display just **www**, truncating the domain.
- **Special** maps special values like `Null`, `NaN` (not a number), and boolean values like `true` and `false` to a display text and color. For example, if Grafana encounters a `null`, I want Grafana to display **N/A**.

You can also use the dots on the left as a "handle" to drag and reorder value mappings in the list.

## Time series example

Here's an example showing a Time series visualization with value mappings. Value mapping colors are not applied to this visualization, but the display text is shown on the axis.

![Value mappings time series example](/static/img/docs/value-mappings/value-mappings-summary-example-8-0.png)

## Stat example

Here's an example showing a Stat visualization with value mappings. You might want to hide the sparkline so it doesn't interfere with the values. Value mapping text colors are applied.

![Value mappings stat example](/static/img/docs/value-mappings/value-mappings-stat-example-8-0.png)

## Bar gauge example

Here's an example showing a Bar gauge visualization with value mappings. The value mapping colors are applied to the text but not the gauges.

![Value mappings bar gauge example](/static/img/docs/value-mappings/value-mappings-bar-gauge-example-8-0.png)

## Table example

Here's an example showing a Table visualization with value mappings. If you want value mapping colors displayed on the table, then set the cell display mode to **Color text** or **Color background**.

![Value mappings table example](/static/img/docs/value-mappings/value-mappings-table-example-8-0.png)
