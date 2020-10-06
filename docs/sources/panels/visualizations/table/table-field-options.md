+++
title = "Table field options"
keywords = ["grafana", "table options", "documentation", "format tables"]
type = "docs"
weight = 500
+++

# Table field options

This section explains all available table field options. They are listed in the same order as in Grafana. Options listed in this topic apply only to table panel visualizations.

Most field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

For more information about applying these options, refer to:
- [Configure all fields]({{< relref "../../field-options/configure-all-fields.md" >}})
- [Configure specific fields]({{< relref "../../field-options/configure-specific-fields.md" >}})

## Column alignment

Choose how Grafana should align cell contents:

- Auto (default)
- Left
- Center
- Right

## Column width

By default, Grafana automatically calculates the column width based on the cell contents. In this field option, can override the setting and define the width for all columns in pixels.

For example, if you enter `100` in the field, then when you click outside the field, all the columns will be set to 100 pixels wide.

## Cell display mode

By default, Grafana automatically chooses display settings. You can override the settings by choosing one of the following options to change all fields.

> **Note:** If you set these in the Field tab, then the display modes will apply to all fields, including the time field. Many options will work best if you set them in the Override tab.

### Color text

If thresholds are set, then the field text is displayed in the appropriate threshold color.

{{< docs-imagebox img="/img/docs/tables/color-text.png" max-width="500px" caption="Color text" class="docs-image--no-shadow" >}}

### Color background

If thresholds are set, then the field background is displayed in the appropriate threshold color.

{{< docs-imagebox img="/img/docs/tables/color-background.png" max-width="500px" caption="Color background" class="docs-image--no-shadow" >}}

### Gradient gauge

The threshold levels define a gradient.

{{< docs-imagebox img="/img/docs/tables/gradient-gauge.png" max-width="500px" caption="Gradient gauge" class="docs-image--no-shadow" >}}

### LCD gauge

The gauge is split up in small cells that are lit or unlit.

{{< docs-imagebox img="/img/docs/tables/lcd-gauge.png" max-width="500px" caption="LCD gauge" class="docs-image--no-shadow" >}}

### JSON view

Shows value formatted as code. If a value is an object the JSON view allowing browsing the JSON object will appear on hover.

{{< docs-imagebox img="/img/docs/tables/json-view.png" max-width="500px" caption="JSON view" class="docs-image--no-shadow" >}}

## Column filter

> **Note:** This feature is available in Grafana 7.2+.
> 
Turn this on to enable table field filters. For more information, refer to [Filter table columns]({{< relref "filter-table-columns.md" >}}).
