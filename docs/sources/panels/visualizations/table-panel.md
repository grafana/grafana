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

> **Note:** Annotations are not currently supported in the table panel.

## Data and field options

Table visualizations allow you to apply:

- [Data transformations]({{< relref "../transformations.md" >}})
- [Field options and overrides]({{< relref "../field-options/_index.md" >}})
- [Thresholds]({{< relref "../thresholds.md" >}})

## Display options

- **Show header -** Show or hide column names imported from your data source.
- [Table field options]({{< relref "../field-options/table-field-options.md" >}}) allow you to change [field options]({{< relref "../field-options/_index.md" >}}) such as column width, alignment, and cell display mode.
