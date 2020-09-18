+++
title = "Table field options"
keywords = ["grafana", "table options", "documentation", "format tables"]
type = "docs"
weight = 500
+++

# Table field options

This section explains all available field options. They are listed in alphabetical order.

Most field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

> **Note:** Grafana can sometime be too aggressive in parsing strings and displaying them as numbers. To make Grafana show the original string create a field override and add a unit property with the `string` unit.

- [Table field options](#table-field-options)
    - [Column alignment](#column-alignment)
    - [Column width](#column-width)
      - [Cell display mode](#cell-display-mode)

### Column alignment

This custom field option applies only to table visualizations.

Choose how Grafana should align cell contents:

- Auto (default)
- Left
- Center
- Right

### Column width

This custom field option applies only to table visualizations.

By default, Grafana automatically calculates the column width based on the cell contents. In this field option, can override the setting and define the width for all columns in pixels.

For example, if you enter `100` in the field, then when you click outside the field, all the columns will be set to 100 pixels wide.

#### Cell display mode

This custom field option applies only to table visualizations.

By default, Grafana automatically chooses display settings. You can override the settings by choosing one of the following options to change all fields.

- **Color text -** If thresholds are set, then the field text is displayed in the appropriate threshold color.
- **Color background -** If thresholds are set, then the field background is displayed in the appropriate threshold color.
- **Gradient gauge -** The threshold levels define a gradient.
- **LCD gauge -** The gauge is split up in small cells that are lit or unlit.
- **JSON view -** Shows value formatted as code. If a value is an object the JSON view allowing browsing the JSON object will appear on hover
