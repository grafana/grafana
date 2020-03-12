+++
title = "Graph Panel"
keywords = ["grafana", "graph panel", "documentation", "guide", "graph"]
type = "docs"
aliases = ["/docs/grafana/latest/reference/graph/"]
[menu.docs]
name = "Graph"
parent = "panels"
weight = 4
+++

# Graph Panel

{{< docs-imagebox img="/img/docs/v45/graph_overview.png" class="docs-image--no-shadow" max-width="850px" >}}

The main panel in Grafana is simply named Graph. It provides a very rich set of graphing options.

1. Clicking the title for a panel exposes a menu.  The `edit` option opens additional configuration
options for the panel.
2. Click to open color and axis selection.
3. Click to only show this series. Shift/Ctrl+Click to hide series.

## General

{{< docs-imagebox img="/img/docs/v51/graph_general.png"  max-width= "800px" >}}

The general tab allows customization of a panel's appearance and menu options.

### Info

- **Title** - The panel title of the dashboard, displayed at the top.
- **Description** - The panel description, displayed on hover of info icon in the upper left corner of the panel.
- **Transparent** - If checked, removes the solid background of the panel (default not checked).

### Repeat
Repeat a panel for each value of a variable.  Repeating panels are described in more detail [here]({{< relref "../../reference/templating.md#repeating-panels" >}}).


## Metrics

The metrics tab defines what series data and sources to render.  Each data source provides different
options.

## Axes

{{< docs-imagebox img="/img/docs/v51/graph_axes_grid_options.png"  max-width= "800px" >}}

The Axes tab controls the display of axes.

### Left Y/Right Y

The **Left Y** and **Right Y** can be customized using:

- **Unit** - The display unit for the Y value
- **Scale** - The scale to use for the Y value, linear or logarithmic. (default linear)
- **Y-Min** - The minimum Y value. (default auto)
- **Y-Max** - The maximum Y value. (default auto)
- **Decimals** - Controls how many decimals are displayed for Y value (default auto)
- **Label** - The Y axis label (default "")

Axes can also be hidden by unchecking the appropriate box from **Show**.

### X-Axis

Axis can be hidden by unchecking **Show**.

For **Mode** there are three options:

- The default option is **Time** and means the x-axis represents time and that the data is grouped by time (for example, by hour or by minute).

- The **Series** option means that the data is grouped by series and not by time. The y-axis still represents the value.

    {{< docs-imagebox img="/img/docs/v51/graph-x-axis-mode-series.png" max-width="800px">}}

- The **Histogram** option converts the graph into a histogram. A Histogram is a kind of bar chart that groups numbers into ranges, often called buckets or bins. Taller bars show that more data falls in that range. Histograms and buckets are described in more detail [here](http://docs.grafana.org/features/panels/heatmap/#histograms-and-buckets).

    <img src="/img/docs/v43/heatmap_histogram.png" class="no-shadow">


### Y-Axes

- **Align** - Check to align left and right Y-axes by value (default unchecked/false)
- **Level** - Available when *Align* is checked. Value to use for alignment of left and right Y-axes, starting from Y=0 (default 0)

## Legend

{{< docs-imagebox img="/img/docs/v51/graph-legend.png" max-width= "800px" >}}

### Options

- **Show** - Uncheck to hide the legend (default checked/true)
- **Table** - Check to display legend in table (default unchecked/false)
- **To the right** - Check to display legend to the right (default unchecked/false)
- **Width** - Available when *To the right* is checked. Value to control the minimum width for the legend (default 0)

### Values

Additional values can be shown along-side the legend names:

- **Min** - Minimum of all values returned from metric query
- **Max** - Maximum of all values returned from the metric query
- **Avg** - Average of all values returned from metric query
- **Current** - Last value returned from the metric query
- **Total** - Sum of all values returned from metric query
- **Decimals** - Controls how many decimals are displayed for legend values (and graph hover tooltips)

The legend values are calculated client side by Grafana and depend on what type of
aggregation or point consolidation your metric query is using. All the above legend values cannot
be correct at the same time. For example if you plot a rate like requests/second, this is probably
using average as aggregator, then the Total in the legend will not represent the total number of requests.
It is just the sum of all data points received by Grafana.

### Hide series

Hide series when all values of a series from a metric query are of a specific value:

- **With only nulls** - Value=*null* (default unchecked)
- **With only zeros** - Value=*zero* (default unchecked)

## Display styles

{{< docs-imagebox img="/img/docs/v51/graph_display_styles.png" max-width= "800px" >}}

Display styles control visual properties of the graph.

### Draw Options

#### Draw Modes

- **Bar** - Display values as a bar chart
- **Lines** - Display values as a line graph
- **Points** - Display points for values

#### Mode Options

- **Fill** - Amount of color fill for a series (default 1). 0 is none.
- **Line Width** - The width of the line for a series (default 1).
- **Staircase** - Draws adjacent points as staircase
- **Points Radius** - Adjust the size of points when *Points* are selected as *Draw Mode*.
- **Hidden Series** - Hide series by default in graph.

#### Hover tooltip

- **Mode** - Controls how many series to display in the tooltip when hover over a point in time, All series or single (default All series).
- **Sort order** - Controls how series displayed in tooltip are sorted, None, Ascending or Descending (default None).
- **Stacked value** - Available when *Stack* are checked and controls how stacked values are displayed in tooltip (default Individual).
   - Individual: the value for the series you hover over
   - Cumulative - sum of series below plus the series you hover over

#### Stacking and Null value

If there are multiple series, they can be displayed as a group.

- **Stack** - Each series is stacked on top of another
- **Percent** - Available when *Stack* are checked. Each series is drawn as a percentage of the total of all series
- **Null value** - How null values are displayed

### Series overrides

{{< docs-imagebox img="/img/docs/v51/graph_display_overrides.png" max-width= "800px" >}}

The section allows a series to be rendered differently from the others. For example, one series can be given
a thicker line width to make it stand out and/or be moved to the right Y-axis.

#### Dashes Drawing Style

There is an option under Series overrides to draw lines as dashes. Set Dashes to the value True to override the line draw setting for a specific series.

### Thresholds

{{< docs-imagebox img="/img/docs/v51/graph_display_thresholds.png" max-width= "800px" >}}

Thresholds allow you to add arbitrary lines or sections to the graph to make it easier to see when
the graph crosses a particular threshold.

### Time Regions

> Only available in Grafana v5.4 and above.

{{< docs-imagebox img="/img/docs/v54/graph_time_regions.png" max-width= "800px" >}}

Time regions allow you to highlight certain time regions of the graph to make it easier to see for example weekends, business hours and/or off work hours.

## Time Range

{{< docs-imagebox img="/img/docs/v51/graph-time-range.png"  max-width= "900px" >}}

The time range tab allows you to override the dashboard time range and specify a panel specific time.
Either through a relative from now time option or through a timeshift.
Panel time overrides and timeshift are described in more detail [here]({{< relref "../../reference/timerange.md#panel-time-overrides-timeshift" >}}).

### Data links

{{< docs-imagebox img="/img/docs/v66/datalinks_graph.png" max-width="1025px" caption="Data links" >}}

Data links allow you add dynamic URL links to your visualizations, [read more on data links]({{< relref "../../reference/datalinks.md" >}}).

