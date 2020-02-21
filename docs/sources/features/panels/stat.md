+++
draft = "false"
date = "2020-02-19"
title = "Stat panel"
description = "Stat panel documentation"
keywords = ["grafana", "docs", "stat panel"]
type = "docs"
+++

# Stat panel

{{< docs-imagebox img="/img/docs/v66/stat_panel_dark3.png" max-width="1025px" caption="Stat panel" >}}

The stat panel is designed to show a big single stat values with an optional graph sparkline. You can control
background or value color using thresholds.

## Display options

* Show
  * `Calculation` - Show a calculated value like min or max based on all rows.
  * `All values` - Show a separate stat for every row.
* Calc
  * Specify calculation / reducer function. Since this panel is designed to only show a single value Grafana needs to
    know how to reduce a fields many values to a single value.
* Orientation
  * If your query returns multiple series or you have set **Show** to `All values` then the visualization
    will repeat for every series or row. This orientation option will control in what direction it will repeat.
** Color
  * `Value` - Color the value and graph area only.
  * `Background` - Color the background.
** Graph
  * `None` - Disable the graph / sparkline
  * `Area graph` - Show area graph below value. This requires that your query returns a time column.
** Justify
  * `Auto` - If only a single value is shown (no repeat) the value is centered. If multiple series or rows the value is
  * left aligned.
  * `Center` - Force center alignment.


### Auto layout

The panel will try to auto adjust layout depending on width & height. The graph will also hide if the panel becomes
to small.

Example of stacked layout where graph is automatically hidden due to each stat being too small:

{{< docs-imagebox img="/img/docs/v66/stat_panel_stacked.png" max-width="405px" caption="Stat panel" >}}

### Color mode

Example of value color mode:

{{< docs-imagebox img="/img/docs/v66/stat_panel_dark4.png" max-width="900px" caption="Stat panel" >}}

### Field

* `Title` - When multiple stats are shown this field controls the title in each stat. By default this is the series name
 and field name. You can use expressions like `${__series.name}` or `${__field.name}` to use only series name or field
 name in title or `${__cell_2}` to refer to other fields (2 being field/column with index 2).
* `Min` - The minimum value, leave blank for auto calculation based on all series & fields. Used by graph/sparkline
* (when enabled) to set y-axis min.
* `Max` - The maximum value, leave blank for auto calculation based on all series & fields. Used by graph/sparkline
* (when enabled) to set y-axis max.
* `Decimals` - Number of decimals to render value with. Leave empty for Grafana to automatically figure out the best
 number of decimals to use.

### Thresholds

Define thresholds that will set the color of either the value or the background depending on your `Color` display option. The
thresholds are automatically sorted from lowerst value to highest. The `Base` value represents minus infinity.


### Value mappings

Map a number or a range of numbers to a text value.

### Data links

Data links allow you add dynamic URL links to your visualizations, [read more on data links]({{< relref "../../reference/datalinks.md" >}}).

