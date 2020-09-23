+++
title = "Table panel"
keywords = ["grafana", "dashboard", "documentation", "panels", "table panel"]
type = "docs"
aliases = ["/docs/grafana/latest/reference/table/", "/docs/grafana/latest/features/panels/table_panel/"]
[menu.docs]
name = "Table panel"
parent = "visualizations"
weight = 1000
+++

# Table panel

The table panel is very flexible, supporting multiple modes for time series and for tables, annotation, and raw JSON data. This panel also provides date formatting, value formatting, and coloring options.

{{< figure src="/img/docs/v72/table_visualization.png" max-width="1200px" lightbox="true" caption="Table visualization" >}}

## Data and field options

Table visualizations allow you to apply:

- [Data transformations]({{< relref "../transformations/_index.md" >}})
- [Field options and overrides]({{< relref "../field-options.md" >}})
- [Thresholds]({{< relref "../thresholds.md" >}})

## Display options

- **Show header -** Show or hide column names imported from your data source..

### Field display options

In the **Field** tab you can set table specific display options that will affect all columns. In the **Override** tab you can customize them per column.

- [Column width](#column-width)
- [Column alignment](#column-alignment)
- [Cell display mode](#cell-display-mode)

### Column alignment

Choose how Grafana should align cell contents:

- Auto (default)
- Left
- Center
- Right

### Column width

By default, Grafana automatically calculates the column width based on the cell contents. In this field option, can override the setting and define the width for all columns in pixels.

For example, if you enter `100` in the field, then when you click outside the field, all the columns will be set to 100 pixels wide.

#### Cell display mode

By default, Grafana automatically chooses display settings. You can override the settings by choosing one of the following options to change all fields.

- **Color text -** If thresholds are set, then the field text is displayed in the appropriate threshold color.
- **Color background -** If thresholds are set, then the field background is displayed in the appropriate threshold color.
- **Gradient gauge -** The threshold levels define a gradient.
- **LCD gauge -** The gauge is split up in small cells that are lit or unlit.
- **JSON view -** Shows value formatted as code. If a value is an object the JSON view allowing browsing the JSON object will appear on hover

## Tips

### Display original string value

Grafana can sometime be too aggressive in parsing strings and displaying them as numbers. To make Grafana show the original
string create a field override and add a unit property with the `string` unit.

### Annotations

Annotations are not currently supported in the new table panel. This might be added back in a future release.
