+++
draft = "false"
date = "2020-02-19"
title = "Bar gauge panel"
description = "Bar gauge panel docs"
keywords = ["grafana", "enter", "keywords", "here"]
type = "docs"
+++

# Bar gauge panel

{{< docs-imagebox img="/img/docs/v66/bar_gauge_cover.png" max-width="1025px" caption="Stat panel" >}}

This panel can show one or more bar gauges depending on how many series, rows or columns your query returns. The
thresholds control the bar & value color.

## Display options

* Show
  * `Calculation` - Show a calculated value like min or max based on all rows.
  * `All values` - Show a separate stat for every row.
* Calc
  * Specify calculation / reducer function. Since this panel is designed to only show a single value Grafana needs to
    know how to reduce a fields many values to a single value.
* Orientation
  * `Horizontal` - The bar will stretch horizontally from left to right.
  * `Vertical` - The bar will stretch vertically from top to bottom.
* Mode
  * `Gradient` - The threshold levels define a gradient.
  * `Retro LCD` - The gauge is split up in small cells that are lit or unlit.
  * `Basic` - Single color based on the matching threshold.

Retro LCD example:

{{< docs-imagebox img="/img/docs/v66/bar_gauge_lcd.png" max-width="1025px" caption="Stat panel" >}}

### Field

* `Title` - When multiple stats are shown this field controls the title in each stat. By default this is the series name
 and field name. You can use expressions like `${__series.name}` or `${__field.name}` to use only series name or field
 name in title or `${__cell_2}` to refer to other fields (2 being field/column with index 2).
* `Min` - The minimum value, leave blank for auto calculation based on all series & fields. Used by Graph to set y-axis min.
* `Max` - The maximum value, leave blank for auto calculation based on all series & fields. Used by Graph to set y-axis max.
* `Decimals` - Number of decimals to render value with. Leave empty for Grafana to automatically figure out the best
 number of decimals to use.

### Thresholds

Define thresholds that will set the color of either the value or the background depending on your `Color` display option. The
thresholds are automatically sorted from lowest value to highest. The `Base` value represents minus infinity.


### Value mappings

Map a number or a range of numbers to a text value.

### Data links

Data links allow you add dynamic URL links to your visualizations, [read more on data links]({{< relref "../../reference/datalinks.md" >}}).

