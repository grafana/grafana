----
page_title: Singlestat Panel
page_description: Singlestat Panel Reference
page_keywords: grafana, singlestat, panel, documentation
---

# Singlestat Panel

![](/img/v1/singlestat_panel2.png)

The Singlestat Panel allows you to show the one main summary stat of a SINGLE series. It reduces the series into a single number (by looking at the max, min, average, or sum of values in the series). Singlestat also provides thresholds to color the stat or the Panel background. It can also translate the single number into a text value, and show a sparkline summary of the series.

### Singlestat Panel Configuration

The singlestat panel has a normal query editor to allow you define your exact metric queries like many other Panels. Through the Options tab, you can access the Singlestat-specific functionality.

<img class="no-shadow" src="/img/v1/Singlestat-BaseSettings.png">

1. `Big Value`: Big Value refers to how we display the main stat for the Singlestat Panel. This is always a single value that is displayed in the Panel in between two strings, `Prefix` and  `Suffix`. The single number is calculated by choosing a function (min,max,average,current,total) of your metric query. This functions reduces your query into a single numeric value.
2. `Font Size`: You can use this section to select the font size of the different texts in the Singlestat Panel, i.e. prefix, value and postfix.
3. `Values`: The Value fields let you set the function (min, max, average, current, total) that your entire query is reduced into a single value with. You can also set the font size of the Value field and font-size (as a %) of the metric query that the Panel is configured with. This reduces the entire query into a single summary value that is displayed.
4. `Postfixes`: The Postfix fields let you define a custom label and font-size (as a %) to appear *after* the value
5. `Units`: Units are appended to the the Singlestat  within the panel, and will respect the color and threshold settings for the value.
6. `Decimals`: The Decimal field allows you to override the automatic decimal precision, and set it explicitly.

### Coloring

The coloring options of the Singlestat Panel config allow you to dynamically change the colors based on the Singlestat value.

<img class="no-shadow" src="/img/v1/Singlestat-Coloring.png">

1. `Background`: This checkbox applies the configured thresholds and colors to the entirety of the Singlestat Panel background.
2. `Value`: This checkbox applies the configured thresholds and colors to the summary stat.
3. `Thresholds`: Change the background and value colors dynamically within the panel, depending on the Singlestat value. The threshold field accepts **3 comma-separated** values, corresponding to the three colors directly to the right.
4. `Colors`: Select a color and opacity
5. `Invert order`: This link toggles the threshold color order.</br>For example: Green, Orange, Red (<img class="no-shadow" src="/img/v1/gyr.png">) will become Red, Orange, Green (<img class="no-shadow" src="/img/v1/ryg.png">).

### Spark Lines

Sparklines are a great way of seeing the historical data related to the summary stat, providing valuable context at a glance. Sparklines act differently than traditional Graph Panels and do not include x or y axis, coordinates, a legend, or ability to interact with the graph.

<img class="no-shadow" src="/img/v1/Singlestat-Sparklines.png">

1. `Show`: The show checkbox will toggle whether the spark line is shown in the Panel. When unselected, only the Singlestat value will appear.
2. `Background`: Check if you want the sparklines to take up the full panel width, or uncheck if they should be below the main Singlestat value.
3. `Line Color`: This color selection applies to the color of the sparkline itself.
4. `Fill Color`: This color selection applies to the area below the sparkline.

> ***Pro-tip:*** Reduce the opacity on  fill colors for nice looking panels.

### Value to text mapping

Value to text mapping allows you to translate the value of the summary stat into explicit text. The text will respect all styling, thresholds and customization defined for the value. This can be useful to translate the number of the main Singlestat value into a context-specific human-readable word or message.

<img class="no-shadow" src="/img/v1/Singlestat-ValueMapping.png">

## Troubleshooting

### Multiple Series Error

<img class="no-shadow" src="/img/v2/Singlestat-MultiSeriesError.png">


Grafana 2.5 introduced stricter checking for multiple-series on singlestat panels. In previous versions, the panel logic did not verify that only a single series was used, and instead, displayed the first series encountered. Depending on your data source, this could have lead to inconsistent data being shown and/or a general confusion about which metric was being displayed.

To fix your singlestat panel:

- Edit your panel by clicking the Panel Title and selecting *Edit*.

- Do you have multiple queries in the metrics tab?
    - Solution: Select a single query to vizualize. You can toggle whether a query is vizualized by clicking the eye icon on each line. If the error persists, continue to the next solution.

- Do you have one query?
    - Solution: This likely means your query is returning multiple series. You will want to reduce this down to a single series. This can be accomplished in many ways, depending on your data source. Some common practices include summing the series, averaging or any number of other functions. Consult the documentation for your data source for additional information.
