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
title: Visualizations and widgets
weight: 75
---

# Visualizations and widgets

Grafana offers a variety of visualizations to support different use cases. Visualizations require a data source and, typically, at least one query to display your data effectively.

{{% admonition type="note" %}}
If you are unsure which visualization to pick, Grafana can provide visualization suggestions based on the panel query. When you select a visualization, Grafana displays a preview with that visualization applied.
{{% /admonition %}}

Click the following links for documentation that highlights the built-in visualizations, their options, and typical usage. The [Examples](#examples) section of this page also describes common use cases.

- Graphs & charts
  - [Time series][] is the default and main Graph visualization.
  - [Bar chart][] shows any categorical data.
  - [Candlestick][] is typically for financial data where the focus is price/data movement.
  - [Heatmap][] visualizes data in two dimensions, and is typically used to show the magnitude of a phenomenon.
  - [Histogram][] calculates and shows value distribution in a bar chart.
  - [Pie chart][] is typically used where proportionality is important.
  - [State timeline][] for state changes over time.
  - [Status history][] for periodic state, over time.
- Stats & numbers
  - [Bar gauge][] is a horizontal or vertical bar gauge.
  - [Stat][] for big stats and optional sparkline.
- Misc
  - [Flame graph][] is the main visualization for profiling.
  - [Logs][] is the main visualization for logs.
  - [Node graph][] for directed graphs or networks.
  - [Table][] is the main and only table visualization.
  - [Traces][] is the main visualization for traces.

Go to [play.grafana.org](https://play.grafana.org) to explore a large set of demo dashboards that showcase all the different visualizations.

## Widgets

Grafana also offers widgets, which help you display information that doesn't require a data source.

- [Alert list][] can list alerts.
- [Annotations list][] can list annotations used in dashboards.
- [Dashboard list][] can list dashboards.
- [News][] widget can show RSS feeds.
- [Text][] widget can show markdown and html.

You can also explore [play.grafana.org](https://play.grafana.org), which has a large set of demo dashboards that showcase different widgets.

## Get more

You can add more visualization types by installing panel [panel plugins](https://grafana.com/grafana/plugins/?type=panel).

## Examples

Below you can find some good examples for how all the visualizations in Grafana can be configured.

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

{{< figure src="/static/img/docs/v66/gauge_panel_cover.png" max-width="700px" >}}

Secondly Grafana also has a horizontal or vertical [bar gauge][] with three different distinct display modes.

{{< figure src="/static/img/docs/v66/bar_gauge_lcd.png" max-width="700px" >}}

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
[Alert list]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/alert-list"
[Alert list]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/alert-list"

[Annotations list]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/annotations"
[Annotations list]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/annotations"

[Bar chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-chart"
[Bar chart]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-chart"

[Bar gauge]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-gauge"
[Bar gauge]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-gauge"

[Candlestick]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/candlestick"
[Candlestick]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/candlestick"

[News]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/news"
[News]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/news"

[Dashboard list]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/dashboard-list"
[Dashboard list]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/dashboard-list"

[Flame graph]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/flame-graph"
[Flame graph]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/flame-graph"

[Gauge]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/gauge"
[Gauge]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/gauge"

[Heatmap]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/heatmap"
[Heatmap]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/heatmap"

[Histogram]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/histogram"
[Histogram]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/histogram"

[Logs]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/logs"
[Logs]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/logs"

[Node graph]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/node-graph"
[Node graph]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/node-graph"

[Pie chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/pie-chart"
[Pie chart]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/pie-chart"

[Stat]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/stat"
[Stat]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/stat"

[State timeline]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"
[State timeline]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"

[Status history]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/status-history"
[Status history]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/status-history"

[Table]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/table"
[Table]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/table"

[Text]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/text"
[Text]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/text"

[Time series]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"
[Time series]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"

[Traces]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/traces"
[Traces]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/traces"
{{% /docs/reference %}}
