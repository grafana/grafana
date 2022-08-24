---
aliases:
  - /docs/grafana/latest/features/panels/graph/
  - /docs/grafana/latest/panels/visualizations/graph-panel/
  - /docs/grafana/latest/reference/graph/
  - /docs/grafana/latest/visualizations/graph-panel/
keywords:
  - grafana
  - graph panel
  - documentation
  - guide
  - graph
title: Graph (old)
weight: 500
---

# Graph panel (old)

> **Note:** [Time series panel]({{< relref "time-series/" >}}) visualization is going to replace the Graph panel visualization in a future release.

The graph panel can render metrics as a line, a path of dots, or a series of bars. This type of graph is versatile enough to display almost any time-series data.

## Data and field options

Graph visualizations allow you to apply:

- [Alerts]({{< relref "../alerting/" >}}) - This is the only type of visualization that allows you to set alerts.
- [Transform data]({{< relref "../panels/transform-data/#add-a-transformation-function-to-data" >}})
- [Add a field override]({{< relref "../panels/configure-overrides#add-a-field-override" >}})
- [Configure thresholds]({{< relref "../panels/configure-thresholds/" >}})

## Display options

Use these settings to refine your visualization.

- **Bars -** Display values as a bar chart.
- **Lines -** Display values as a line graph.
- **Line width -** The width of the line for a series. (default 1).
- **Staircase -** Draws adjacent points as staircase.
- **Area fill -** Amount of color fill for a series. (default 1, 0 is none)
- **Fill gradient -** Degree of gradient on the area fill. (0 is no gradient, 10 is a steep gradient. Default is 0.)
- **Points -** Display points for values.
- **Point radius -** Controls how large the points are.
- **Alert thresholds -** Display alert thresholds and regions on the panel.

### Stacking and null value

- **Stack -** Each series is stacked on top of another.
- **Percent -** Available when **Stack** is selected. Each series is drawn as a percentage of the total of all series.
- **Null value -** How null values are displayed. _This is a very important setting._ See note below.
  - **connected -** If there is a gap in the series, meaning a null value or values, then the line will skip the gap and connect to the next non-null value.
  - **null -** (default) If there is a gap in the series, meaning a null value, then the line in the graph will be broken and show the gap.
  - **null as zero -** If there is a gap in the series, meaning a null value, then it will be displayed as a zero value in the graph panel.

> **Note:** If you are monitoring a server's CPU load and the load reaches 100%, then the server will lock up and the agent sending statistics will not be able to collect the load statistic. This leads to a gap in the metrics and having the default as _null_ means Grafana will show the gaps and indicate that something is wrong. If this is set to _connected_, then it would be easy to miss this signal.

### Hover tooltip

Use these settings to change the appearance of the tooltip that appears when you hover your cursor over the graph visualization.

- **Mode**
  - **All series -** The hover tooltip shows all series in the graph. Grafana highlights the series that you are hovering over in bold in the series list in the tooltip.
  - **Single -** The hover tooltip shows only a single series, the one that you are hovering over on the graph.
- **Sort order -** Sorts the order of series in the hover tooltip if you have selected **All series** mode. When you hover your cursor on a graph, Grafana displays the values associated with the lines. Generally users are most interested in the highest or lowest values. Sorting these values can make it much easier to find the data of interest.
  - **None -** The order of the series in the tooltip is determined by the sort order in your query. For example, they could be alphabetically sorted by series name.
  - **Increasing -** The series in the hover tooltip are sorted by value and in increasing order, with the lowest value at the top of the list.
  - **Decreasing -** The series in the hover tooltip are sorted by value and in decreasing order, with the highest value at the top of the list.

## Series overrides

Series overrides allow a series in a graph panel to be rendered differently from the others. You can customize display options on a per-series bases or by using regex rules. For example, one series can have a thicker line width to make it stand out or be moved to the right Y-axis.

You can add multiple series overrides.

**Add a series override**

1. Click **Add series override**.
1. In **Alias or regex** Type or select a series. Click in the field to see a list of available series.

   **Example:** `/Network.*/` would match two series named `Network out` and `Network in`.

1. Click **+** and then select a style to apply to the series. You can add multiple styles to each entry.

- **Bars -** Show series as a bar graph.
- **Lines -** Show series as line graph.
- **Line fill -** Show line graph with area fill.
- **Fill gradient -** Area fill gradient amount.
- **Line width -** Set line width.
- **Null point mode -** Option to ignore null values or replace with zero. Important if you want to ignore gaps in your data.
- **Fill below to -** Fill area between two series.
- **Staircase line -** Show series as a staircase line.
- **Dashes -** Show line with dashes.
- **Hidden Series -** Hide the series.
- **Dash Length -** Dashed line length.
- **Dash Space -** Dashed line spacing.
- **Points -** Show series as separate points.
- **Point Radius -** Radius for point rendering.
- **Stack -** Set stack group for series.
- **Color -** Set series color.
- **Y-axis -** Set series y-axis.
- **Z-index -** Set series z-index (rendering order). Important when overlaying different styles (bar charts, area charts).
- **Transform -** Transform value to negative to render below the y-axis.
- **Legend -** Control if a series is shown in legend.
- **Hide in tooltip -** Control if a series is shown in graph tooltip.

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
- **Mode -** The display mode completely changes the visualization of the graph panel. It's like three panels in one. The main mode is the time series mode with time on the X-axis. The other two modes are a basic bar chart mode with series on the X-axis instead of time and a histogram mode.

  - **Time -** (default) The X-axis represents time and that the data is grouped by time (for example, by hour, or by minute).
  - **Series -** The data is grouped by series and not by time. The Y-axis still represents the value.
    - **Value -** The aggregation type to use for the values. The default is total (summing the values together).
  - **Histogram -** Converts the graph into a histogram. A histogram is a kind of bar chart that groups numbers into ranges, often called buckets or bins. Taller bars show that more data falls in that range.

    For more information about histograms, refer to [Introduction to histograms and heatmaps]({{< relref "../basics/intro-histograms/" >}}).

    - **Buckets -** The number of buckets to group the values by. If left empty, then Grafana tries to calculate a suitable number of buckets.
    - **X-Min -** Filters out values from the histogram that are under this minimum limit.
    - **X-Max -** Filters out values that are greater than this maximum limit.

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

Time regions allow you to highlight certain time regions of the graph to make it easier to see for example weekends, business hours and/or off work hours. All configured time regions refer to UTC time.
