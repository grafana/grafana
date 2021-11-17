+++
title = "About transformation"
weight = 10
+++

# About transformation

Transformations process the result set of a query before it’s passed on for visualization. They allow you to rename fields, join separate time series together, do math across queries, and more. For users, with numerous dashboards or with a large volume of queries, the ability to reuse the query result from one panel in another panel can be a huge performance gain.

The transformations feature is accessible from the **Transform** tab of the Grafana panel editor.

Transformations sometimes result in data that cannot be graphed. When that happens, click the `Table view` toggle above the visualization to switch to a table view of the data. This can help you understand
the final result of your transformations.

## Order of transformations

In case there are multiple transformations, Grafana applies them in the exact sequence in which they are listed. Each transformation creates a new result set that is passed onto the next transformation in the pipeline for processing.

The order in which transformations are applied can make a huge difference in how your results look. For example, if you use a Reduce transformation to condense all the results of one column into a single value, then you can only apply transformations to that single value.

Another source input...

> **Note:** This is a new beta transformation introduced in v8.1.

This transformation allow you select one query and from it extract [standard options]({{< relref "../standard-options.md" >}}) like **Min**, **Max**, **Unit** and **Thresholds** and apply it to other query results. This enables dynamic query driven visualization configuration.

If you want to extract a unique config for every row in the config query result then try the [Rows to fields]({{< relref "./rows-to-fields" >}}) transformation instead.

Another source input...

# Value mappings

Value mapping concept allow you to replace values or ranges in your visualizations with words or emojis.

Values mapped via value mappings will skip the unit formatting. This means that a text value mapped to a numerical value will not be formatted using the configured unit.

![Value mappings example](/static/img/docs/value-mappings/value-mappings-example-8-0.png)

If value mappings are present in a panel, then Grafana displays a summary in the side pane of the panel editor.

> **Note:** The new value mappings are not compatible with some visualizations, such as Graph (old), Text, and Heatmap.

## Value mapping examples

Value mappings are displayed differently in different visualizations.

### Time series example

Here's an example showing a Time series visualization with value mappings. Value mapping colors are not applied to this visualization, but the display text is shown on the axis.

![Value mappings time series example](/static/img/docs/value-mappings/value-mappings-summary-example-8-0.png)

### Stat example

Here's an example showing a Stat visualization with value mappings. You might want to hide the sparkline so it doesn't interfere with the values. Value mapping text colors are applied.

![Value mappings stat example](/static/img/docs/value-mappings/value-mappings-stat-example-8-0.png)

### Bar gauge example

Here's an example showing a Bar gauge visualization with value mappings. The value mapping colors are applied to the text but not the gauges.

![Value mappings bar gauge example](/static/img/docs/value-mappings/value-mappings-bar-gauge-example-8-0.png)

### Table example

Here's an example showing a Table visualization with value mappings. If you want value mapping colors displayed on the table, then set the cell display mode to **Color text** or **Color background**.

![Value mappings table example](/static/img/docs/value-mappings/value-mappings-table-example-8-0.png)

Another source input...

# Rows to fields transform

> **Note:** This is a new beta transformation introduced in v8.1.

This transforms rows into separate fields. This can be useful as fields can be styled and configured individually, something rows cannot. It can also use additional fields as sources for dynamic field configuration or map them to field labels. The additional labels can then be used to define better display names for the resulting fields.

Useful when visualizing data in:

- Gauge
- Stat
- Pie chart

If you want to extract config from one query and appply it to another you should use the [Config from query results]({{< relref "./config-from-query.md" >}}) transformation instead.

## Example

Input:

| Name    | Value | Max |
| ------- | ----- | --- |
| ServerA | 10    | 100 |
| ServerB | 20    | 200 |
| ServerC | 30    | 300 |

Output:

| ServerA (config: max=100) | ServerB (config: max=200) | ServerC (config: max=300) |
| ------------------------- | ------------------------- | ------------------------- |
| 10                        | 20                        | 30                        |

As you can see each row in the source data becomes a separate field. Each field now also has a max config option set. Options like **Min**, **Max**, **Unit** and **Thresholds** are all part of field configuration and if set like this will be used by the visualization instead of any options manually configured in the panel editor options pane.
