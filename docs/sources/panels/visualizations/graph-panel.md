+++
title = "Graph panel"
keywords = ["grafana", "graph panel", "documentation", "guide", "graph"]
type = "docs"
aliases = ["/docs/grafana/latest/reference/graph/", "/docs/grafana/latest/features/panels/graph/"]
[menu.docs]
parent = "visualizations"
weight = 100
draft = "true"
+++

# Graph panel

This visualization is the most-used in the Grafana ecosystem. It can render as a line, a path of dots, or a series of bars. This type of graph is versatile enough to display almost any time-series data.

## Data and field options

Graph visualizations allow you to apply:
- Data transformations
- Alerts - This is the only type of visualization that allows you to set alerts. For more information, see [LINK TO UPDATED ALERTING TOPIC]
- [Thresholds]({{< relref "../thresholds.md" >}})

## Display options

Use these settings to refine your visualization.

- **Bars -** Display values as a bar chart.
- **Lines -** Display values as a line graph.
- **Line width -** The width of the line for a series. (default 1).
- **Staircase -** Draws adjacent points as staircase.
- **Area fill -** Amount of color fill for a series. (default 1, 0 is none)
- **Fill gradient -**
- **Points -** Display points for values.
- **Point radius -** Controls how large the points are.

### Hover tooltip

- **Mode**
  - **All series -**
  - **Single -**
- **Sort order**
  - **None -**
  - **Increasing -**
  - **Decreasing -**

### Stacking and null value

- **Stack -** Each series is stacked on top of another.
- **Percent -** Available when **Stack** is selected. Each series is drawn as a percentage of the total of all series.
- **Null value -** How null values are displayed.
  - **connected -**
  - **null -**
  - **null as zero -**

## Series overrides

For more information about series overrides, refer to [Add series overrides](ADD LINK WHEN TOPIC IS MERGED).

## Axes

Use these options to control the display of axes in the visualization.

### Left Y/Right Y

Options are identical for both Y-axes.

- **Show -** Click to show or hide the axis.
- **Unit -** The display unit for the Y value.
- **Scale -** The scale to use for the Y value, linear, or logarithmic. (default linear)
- **Y-Min -** The minimum Y value. (default auto)
- **Y-Max -** The maximum Y value. (default auto)
- **Decimals -** Defines how many decimals are displayed for Y value. (default auto)
- **Label -** The Y axis label. (default “")

### Y-Axes
- **Align -** Select to align left and right Y-axes by value. (default unchecked/false)
- **Level -** Available when **Align** is selected. Value to use for alignment of left and right Y-axes, starting from Y=0. (default 0)


### X-Axis

- **Show -** Click to show or hide the axis.
- **Mode -**
  - **Time -** (default) The X-axis represents time and that the data is grouped by time (for example, by hour, or by minute).
  - **Series -** The data is grouped by series and not by time. The Y-axis still represents the value.
    - **Value -** 
  - **Histogram -** Converts the graph into a histogram. A histogram is a kind of bar chart that groups numbers into ranges, often called buckets or bins. Taller bars show that more data falls in that range. For more information about histograms, refer to [Introduction to histograms and heatmaps]({{< relref "../../getting-started/intro-histograms.md" >}}).
    - **Buckets -**
    - **X-Min -**
    - **X-Max -**
	
## Legend

Use these settings to refine how the legend appears in your visualization.

### Options

- **Show -** Uncheck to hide the legend. (default checked/true)
- **As Table -** Check to display legend in table. (default checked/true)
- **To the right -** Check to display legend to the right.
- **Width -** Available when **To the right** is selected. Enter the minimum width for the legend in pixels.

### Values

Additional values can be shown along-side the legend names:

- **Min -** Minimum of all values returned from the metric query.
- **Max -** Maximum of all values returned from the metric query.
- **Avg -** Average of all values returned from the metric query.
- **Current** - Last value returned from the metric query.
- **Total -** Sum of all values returned from the metric query.
- **Decimals -** Controls how many decimals are displayed for legend values and graph hover tooltips.

The legend values are calculated on the client side by Grafana and depend on what type of aggregation or point consolidation your metric query is using. All the above legend values cannot be correct at the same time. 

For example, if you plot a rate like requests/second, this is probably using average as an aggregator, then the Total in the legend will not represent the total number of requests. It is just the sum of all data points received by Grafana.

### Hide series

Hide series when all values of a series from a metric query are of a specific value.

- **With only nulls -** Value=null (default unchecked)
- **With only zeroes -** Value=zero (default unchecked) 

### Time regions

Time regions allow you to highlight certain time regions of the graph to make it easier to see for example weekends, business hours and/or off work hours.
