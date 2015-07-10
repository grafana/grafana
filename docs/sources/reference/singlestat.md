----
page_title: Singlestat Panel
page_description: Singlestat Panel Reference
page_keywords: grafana, singlestat, panel, documentation
---

# Singlestat Panel

![](/img/v1/singlestat_panel2.png)

The singlestat panel allows you to show the one main summery stat of a single series (like max, min, avg, sum). It also
provides thresholds to color that singlestat metric or the panel background.

### Big Value Configuration

The big value configuration allows you to both customize the look of your singlestat metric, as well as add additional labels to contexualize the metric.

<img class="no-shadow" src="/img/v1/Singlestat-BaseSettings.png">

1. `Big Value`: Big Value refers to the collection of values displayed in the singlestat panel.
2. `Prefixes`: The Prefix fields let you define a custom label and font-size (as a %) to appear *before* the singlestat metric.
3. `Values`: The Value fields let you set the (min, max, average, current, total) and font-size (as a %) of the singlestat metric.
4. `Potsfixes`: The Postfix fields let you define a custom label and font-size (as a %) to appear *after* the singlestat metric.
5. `Units`: Units are appended to the the singlestat metric within the panel, and will respect the color and threshold settings for the Value.
6. `Decimals`: The Decimal field allows you to override automatic decimal precision, inceasing the digits displayed for your singlestat metric.

### Coloring

The coloring options of the singlestat config allow you to dynamically change the colors based on the displayed data.

<img class="no-shadow" src="/img/v1/Singlestat-Coloring.png">

1. `Background`: The Background checkbox applies the configured thresholds and colors to the entirity of the singlestat panel background.
2. `Value`: The Value checkbox applies the configured thresholds and colors to the value within the singlestat panel.
3. `Thresholds`: Thresholds allow you to change the background and value colors dyanmically within the panel. The threshold field accepts **3 comma-separated** values, corresponding to the three colors directly to the right.
4. `Colors`: The color picker allows you to select a color and opacity
5. `Invert order`: This link toggles the threshold color order.</br>For example: Green, Orange, Red (<img src="/images/GYR.png">) will become Red, Orange, Green (<img src="/images/RYG.png">).


### Spark Lines

Spark lines are a great way of seeing the historical data associated with a single stat value, providing valuable context at a glance. Spark lines act differently than traditional graph panels and do not include x or y axis, coordinates, a legend, or ability to interact with the graph.

<img class="no-shadow" src="/img/v1/Singlestat-Sparklines.png">

1. `Show`: The show checkbox will toggle whether the spark line is shown in the panel. When unselected, only the value will appear.
2. `Background`: **ASK TORKEL.**
3. `Line Color`: This color selection applies to the color of the sparkline itself.
4. `Fill Color`: This color selection applies to the area below the sparkline.

> ***Pro-tip:*** Reduce the opacity on  fill colors for nice looking panels.

### Value to text mapping

Value to text mapping allows you to translate values into explcit text. The text will respect all styling, thresholds and customization defined for the value.

<img class="no-shadow" src="/img/v1/Singlestat-ValueMapping.png">


