+++
title = "Singlestat Panel"
keywords = ["grafana", "dashboard", "documentation", "panels", "singlestat"]
type = "docs"
aliases = ["/docs/grafana/latest/reference/singlestat/"]
[menu.docs]
name = "Singlestat"
parent = "panels"
weight = 4
+++


# Singlestat Panel

{{< docs-imagebox img="/img/docs/v45/singlestat-panel.png" class="docs-image--no-shadow" max-width="900px" >}}

The Singlestat Panel allows you to show the one main summary stat of a SINGLE series. It reduces the series into a single number (by looking at the max, min, average, or sum of values in the series). Singlestat also provides thresholds to color the stat or the Panel background. It can also translate the single number into a text value, and show a sparkline summary of the series.

### Singlestat Panel Configuration

The singlestat panel has a normal query editor to allow you define your exact metric queries like many other Panels. In the Options tab, you can access the Singlestat-specific functionality.

{{< docs-imagebox img="/img/docs/v45/singlestat-value-options.png" class="docs-image--no-shadow" max-width="900px" >}}

1. **Stats**: The Stats field let you set the function (min, max, average, current, total, first, delta, range) that your entire query is reduced into a single value with. This reduces the entire query into a single summary value that is displayed.
   * **min** - The smallest value in the series
   * **max** - The largest value in the series
   * **avg** - The average of all the non-null values in the series
   * **current** - The last value in the series. If the series ends on null the previous value will be used.
   * **total** - The sum of all the non-null values in the series
   * **first** - The first value in the series
   * **delta** - The total incremental increase (of a counter) in the series. An attempt is made to account for counter resets, but this will only be accurate for single instance metrics. Used to show total counter increase in time series.
   * **diff** - The difference between 'current' (last value) and 'first'.
   * **range** - The difference between 'min' and 'max'. Useful the show the range of change for a gauge.
2. **Prefix/Postfix**: The Prefix/Postfix fields let you define a custom label to appear *before/after* the value. The `$__name` variable can be used here to use the series name or alias from the metric query.
3. **Units**: Units are appended to the Singlestat  within the panel, and will respect the color and threshold settings for the value.
4. **Decimals**: The Decimal field allows you to override the automatic decimal precision, and set it explicitly.
5. **Font Size**: You can use this section to select the font size of the different texts in the Singlestat Panel, i.e. prefix, value and postfix.

### Coloring

The coloring options of the Singlestat Panel config allow you to dynamically change the colors based on the Singlestat value.

{{< docs-imagebox img="/img/docs/v45/singlestat-color-options.png" max-width="500px" class="docs-image--right docs-image--no-shadow">}}

1. **Background**: This checkbox applies the configured thresholds and colors to the entirety of the Singlestat Panel background.
2. **Thresholds**: Change the background and value colors dynamically within the panel, depending on the Singlestat value. The threshold field accepts **2 comma-separated** values which represent 3 ranges that correspond to the three colors directly to the right. For example: if the thresholds are 70, 90 then the first color represents < 70, the second color represents between 70 and 90 and the third color represents > 90.
3. **Colors**: Select a color and opacity
4. **Value**: This checkbox applies the configured thresholds and colors to the summary stat.
5. **Invert order**: This link toggles the threshold color order.</br>For example: Green, Orange, Red (<img class="no-shadow" src="/img/docs/v1/gyr.png">) will become Red, Orange, Green (<img class="no-shadow" src="/img/docs/v1/ryg.png">).

### Spark Lines

Sparklines are a great way of seeing the historical data related to the summary stat, providing valuable context at a glance. Sparklines act differently than traditional Graph Panels and do not include x or y axis, coordinates, a legend, or ability to interact with the graph.

{{< docs-imagebox img="/img/docs/v45/singlestat-spark-options.png" max-width="500px" class="docs-image--right docs-image--no-shadow">}}

1. **Show**: The show checkbox will toggle whether the spark line is shown in the Panel. When unselected, only the Singlestat value will appear.
2. **Full Height**: Check if you want the sparklines to take up the full panel height, or uncheck if they should be below the main Singlestat value.
3. **Y-Min**: The minimum Y value. (default auto)
4. **Y-Max**: The maximum Y value. (default auto)
5. **Line Color**: This color selection applies to the color of the sparkline itself.
6. **Fill Color**: This color selection applies to the area below the sparkline.

<div class="clearfix"></div>

> ***Pro-tip:*** Reduce the opacity on  fill colors for nice looking panels.

### Value/Range to text mapping

{{< docs-imagebox img="/img/docs/v45/singlestat-value-mapping.png" class="docs-image--right docs-image--no-shadow">}}

Value/Range to text mapping allows you to translate the value of the summary stat into explicit text. The text will respect all styling, thresholds and customization defined for the value. This can be useful to translate the number of the main Singlestat value into a context-specific human-readable word or message.

If you want to replace the default "No data" text being displayed when no data is available, add a `value to text mapping` from `null` to your preferred custom text value.

<div class="clearfix"></div>

## Troubleshooting

### Multiple Series Error

{{< docs-imagebox img="/img/docs/v45/singelstat-multiple-series-error.png" class="docs-image--right docs-image--no-shadow">}}

Grafana 2.5 introduced stricter checking for multiple-series on singlestat panels. In previous versions, the panel logic did not verify that only a single series was used, and instead, displayed the first series encountered. Depending on your data source, this could have lead to inconsistent data being shown and/or a general confusion about which metric was being displayed.

To fix your singlestat panel:

- Edit your panel by clicking the Panel Title and selecting *Edit*.

- Do you have multiple queries in the metrics tab?
    - Solution: Select a single query to visualize. You can toggle whether a query is visualized by clicking the eye icon on each line. If the error persists, continue to the next solution.

- Do you have one query?
    - Solution: This likely means your query is returning multiple series. You will want to reduce this down to a single series. This can be accomplished in many ways, depending on your data source. Some common practices include summing the series, averaging or any number of other functions. Consult the documentation for your data source for additional information.

### Gauge

The Gauge feature in this panel is deprecated, please use the new [Gauge panel]({{< relref
"../../features/panels/gauge.md" >}}) instead.

