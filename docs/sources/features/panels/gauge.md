+++
draft = "false"
date = "2020-02-19"
title = "Gauge panel"
description = "Gauge panel docs"
keywords = ["grafana", "enter", "keywords", "here"]
type = "docs"
+++

# Gauge panel

{{< docs-imagebox img="/img/docs/v66/gauge_panel_cover.png" max-width="1025px" caption="Stat panel" >}}

The Gauge is a single value panel that can repeat a gauge for every series, column or row.

## Display options

* Show
  * `Calculation` - Show a calculated value like min or max based on all rows.
  * `All values` - Show a separate stat for every row.
* Calc
  * Specify calculation / reducer function. Since this panel is designed to only show a single value Grafana needs to
    know how to reduce a fields many values to a single value.
** Labels - Controls if thresholds values are shown.
** Markers - Controls if a thresholds band is shown outside the inner gauge value band.

## Field

* `Title` - When multiple stats are shown this field controls the title in each stat. By default this is the series name
 and field name. You can use expressions like `${__series.name}` or `${__field.name}` to use only series name or field
 name in title or `${__cell_2}` to refer to other fields (2 being field/column with index 2).
* `Min` - The minimum value, leave blank for auto calculation based on all series & fields. Used by Graph to set y-axis min.
* `Max` - The maximum value, leave blank for auto calculation based on all series & fields. Used by Graph to set y-axis max.
* `Decimals` - Number of decimals to render value with. Leave empty for Grafana to automatically figure out the best
 number of decimals to use.

### Thresholds

Define thresholds that will set the color of either the value or the background depending on your `Color` display option. The
thresholds are automatically sorted from lowerst value to highest. The `Base` value represents minus infinity.


### Value mappings

Map a number or a range of numbers to a text value.

### Data links

Data links allow you add dynamic URL links to your visualizations, [read more on data links]({{< relref "../../reference/datalinks.md" >}}).

