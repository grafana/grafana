---
aliases:
  - ../features/panels/graph/
  - ../panels/visualizations/
  - ../panels/visualizations/graph-panel/
  - ../reference/graph/
  - ../visualizations/
  - ../visualizations/graph-panel/
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Visualizations
description: Apply visualizations to your data
weight: 10
---

# Visualizations

Grafana offers a variety of visualizations to support different use cases. This section of the documentation highlights the built-in visualizations, their options and typical usage.

{{% admonition type="note" %}}
If you are unsure which visualization to pick, Grafana can provide visualization suggestions based on the panel query. When you select a visualization, Grafana will show a preview with that visualization applied.
{{% /admonition %}}

- Graphs & charts
  - [Time series][] is the default and main Graph visualization.
  - [State timeline][] for state changes over time.
  - [Status history][] for periodic state over time.
  - [Bar chart][] shows any categorical data.
  - [Histogram][] calculates and shows value distribution in a bar chart.
  - [Heatmap][] visualizes data in two dimensions, used typically for the magnitude of a phenomenon.
  - [Pie chart][] is typically used where proportionality is important.
  - [Candlestick][] is typically for financial data where the focus is price/data movement.
  - [Gauge][] is the traditional rounded visual showing how far a single metric is from a threshold.
- Stats & numbers
  - [Stat][] for big stats and optional sparkline.
  - [Bar gauge][] is a horizontal or vertical bar gauge.
- Misc
  - [Table][] is the main and only table visualization.
  - [Logs][] is the main visualization for logs.
  - [Node graph][] for directed graphs or networks.
  - [Traces][] is the main visualization for traces.
  - [Flame graph][] is the main visualization for profiling.
  - [Canvas][] allows you to explicitly place elements within static and dynamic layouts.
  - [Geomap][] helps you visualize geospatial data.
- Widgets
  - [Dashboard list][] can list dashboards.
  - [Alert list][] can list alerts.
  - [Text][] can show markdown and html.
  - [News][] can show RSS feeds.

## Get more

You can add more visualization types by installing panel [panel plugins](https://grafana.com/grafana/plugins/?type=panel).

## Examples

Below you can find some good examples for how all the visualizations in Grafana can be configured. You can also explore [play.grafana.org](https://play.grafana.org) which has a large set of demo dashboards that showcase all the different visualizations.

### Graphs

For time based line, area and bar charts we recommend the default [time series][] visualization. [This public demo dashboard](https://play.grafana.org/d/000000016/1-time-series-graphs?orgId=1) contains many different examples for how this visualization can be configured and styled.

{{< figure src="/static/img/docs/time-series-panel/time_series_small_example.png" max-width="700px" caption="Time series" >}}

For categorical data use a [bar chart][].

{{< figure src="/static/img/docs/bar-chart-panel/barchart_small_example.png" max-width="700px" caption="Bar chart" >}}

### Big numbers & stats

A [stat][] shows one large stat value with an optional graph sparkline. You can control the background or value color using thresholds or color scales.

{{< figure src="/static/img/docs/v66/stat_panel_dark3.png" max-width="1025px" caption="Stat" >}}

### Gauge

If you want to present a value as it relates to a min and max value you have two options. First a standard radial [gauge][] shown below.

{{< figure src="/static/img/docs/v66/gauge_panel_cover.png" max-width="700px" alt="A gauge visualization" >}}

Secondly Grafana also has a horizontal or vertical [bar gauge][] with three different distinct display modes.

{{< figure src="/static/img/docs/v66/bar_gauge_lcd.png" max-width="700px" alt="A bar gauge visualization" >}}

### Table

To show data in a table layout, use a [table][].

{{< figure src="/static/img/docs/tables/table_visualization.png" max-width="700px" lightbox="true" caption="Table visualization" >}}

### Pie chart

To display reduced series, or values in a series, from one or more queries, as they relate to each other, use a [pie chart][].

{{< figure src="/static/img/docs/pie-chart-panel/pie-chart-example.png" max-width="700px" lightbox="true" caption="Pie chart" >}}

### Heatmaps

To show value distribution over, time use a [heatmap][].

{{< figure src="/static/img/docs/v43/heatmap_panel_cover.jpg" max-width="1000px" lightbox="true" caption="Heatmap" >}}

### State timeline

A state timeline shows discrete state changes over time. When used with time series, the thresholds are used to turn the numerical values into discrete state regions.

{{< figure src="/static/img/docs/v8/state_timeline_strings.png" max-width="700px" caption="State timeline with string states" >}}

{{% docs/reference %}}
[News]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/news"
[News]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/news"

[Histogram]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/histogram"
[Histogram]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/histogram"

[Text]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/text"
[Text]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/text"

[Dashboard list]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/dashboard-list"
[Dashboard list]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/dashboard-list"

[Flame graph]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/flame-graph"
[Flame graph]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/flame-graph"

[Canvas]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/canvas"
[Canvas]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/canvas"

[Geomap]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/geomap"
[Geomap]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/geomap"

[Status history]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/status-history"
[Status history]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/status-history"

[Candlestick]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/candlestick"
[Candlestick]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/candlestick"

[Gauge]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/gauge"
[Gauge]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/gauge"

[Alert list]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/alert-list"
[Alert list]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/alert-list"

[Pie chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/pie-chart"
[Pie chart]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/pie-chart"

[Bar gauge]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-gauge"
[Bar gauge]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-gauge"

[Bar chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-chart"
[Bar chart]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-chart"

[Node graph]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/node-graph"
[Node graph]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/node-graph"

[State timeline]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"
[State timeline]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"

[heatmap]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/heatmap"
[heatmap]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/heatmap"

[Traces]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/traces"
[Traces]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/traces"

[Logs]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/logs"
[Logs]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/logs"

[Heatmap]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/heatmap"
[Heatmap]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/heatmap"

[Stat]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/stat"
[Stat]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/stat"

[Table]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/table"
[Table]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/table"

[Time series]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"
[Time series]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"
{{% /docs/reference %}}
