---
aliases:
  - panels/visualizations/
title: Visualizations
weight: 75
---

# Visualization panels

Grafana offers a variety of visualizations to support different use cases. This section of the documentation highlights the built-in panels, their options and typical usage.

> **Note:** If you are unsure which visualization to pick, Grafana can provide visualization suggestions based on the panel query. When you select a visualization, Grafana will show a preview with that visualization applied. For more information, see the [add a panel]({{< relref "../panels/working-with-panels/add-panel.md" >}}) documentation.

- Graphs & charts
  - [Time series]({{< relref "./time-series/_index.md" >}}) is the default and main Graph visualization.
  - [State timeline]({{< relref "./state-timeline.md" >}}) for state changes over time.
  - [Status history]({{< relref "./status-history.md" >}}) for periodic state over time.
  - [Bar chart]({{< relref "./bar-chart.md" >}}) shows any categorical data.
  - [Histogram]({{< relref "./histogram.md" >}}) calculates and shows value distribution in a bar chart.
  - [Heatmap]({{< relref "./heatmap.md" >}}) visualizes data in two dimensions, used typically for the magnitude of a phenomenon.
  - [Pie chart]({{< relref "./pie-chart-panel.md" >}}) is typically used where proportionality is important.
  - [Candlestick]({{< relref "./candlestick.md" >}}) is typically for financial data where the focus is price/data movement.
- Stats & numbers
  - [Stat]({{< relref "./stat-panel.md" >}}) for big stats and optional sparkline.
  - [Gauge]({{< relref "./gauge-panel.md" >}}) is a normal radial gauge.
  - [Bar gauge]({{< relref "./bar-gauge-panel.md" >}}) is a horizontal or vertical bar gauge.
- Misc
  - [Table]({{< relref "./table/_index.md" >}}) is the main and only table visualization.
  - [Logs]({{< relref "./logs-panel.md" >}}) is the main visualization for logs.
  - [Node Graph]({{< relref "./node-graph.md" >}}) for directed graphs or networks.
- Widgets
  - [Dashboard list]({{< relref "./dashboard-list-panel.md" >}}) can list dashboards.
  - [Alert list]({{< relref "./alert-list-panel.md" >}}) can list alerts.
  - [Text panel]({{< relref "./text-panel.md" >}}) can show markdown and html.
  - [News panel]({{< relref "./news-panel.md" >}}) can show RSS feeds.

## Get more

You can add more visualization types by installing panel [panel plugins](https://grafana.com/grafana/plugins/?type=panel).

## Examples

Below you can find some good examples for how all the visualizations in Grafana can be configured. You can also explore [play.grafana.org](https://play.grafana.org) which has a large set of demo dashboards that showcase all the different visualizations.

### Graphs

For time based line, area and bar charts we recommend the default [Time series]({{< relref "./time-series/_index.md" >}}) visualization. [This public demo dashboard](https://play.grafana.org/d/000000016/1-time-series-graphs?orgId=1) contains many different examples for how this visualization can be configured and styled.

{{< figure src="/static/img/docs/time-series-panel/time_series_small_example.png" max-width="700px" caption="Time series" >}}

For categorical data use the [Bar chart]({{< relref "./bar-chart.md" >}}) visualization.

{{< figure src="/static/img/docs/bar-chart-panel/barchart_small_example.png" max-width="700px" caption="Bar chart" >}}

### Big numbers & stats

The [Stat](stat-panel/) visualization shows one large stat value with an optional graph sparkline. You can control the background or value color using thresholds or color scales.

{{< figure src="/static/img/docs/v66/stat_panel_dark3.png" max-width="1025px" caption="Stat panel" >}}

### Gauge

If you want to present a value as it relates to a min and max value you have two options. First a standard [Radial Gauge]({{< relref "./gauge-panel.md" >}}) shown below.

{{< figure src="/static/img/docs/v66/gauge_panel_cover.png" max-width="700px" >}}

Secondly Grafana also has a horizontal or vertical [Bar gauge]({{< relref "./bar-gauge-panel.md" >}}) with three different distinct display modes.

{{< figure src="/static/img/docs/v66/bar_gauge_lcd.png" max-width="700px" >}}

### Table

To show data in a table layout, use the [Table]({{< relref "./table/_index.md" >}}) visualization.

{{< figure src="/static/img/docs/tables/table_visualization.png" max-width="700px" lightbox="true" caption="Table visualization" >}}

### Pie chart

Grafana now ships with an included [Pie chart]({{< relref "./pie-chart-panel.md" >}}) visualization.

{{< figure src="/static/img/docs/pie-chart-panel/pie-chart-example.png" max-width="700px" lightbox="true" caption="Pie chart visualization" >}}

### Heatmaps

To show value distribution over, time use the [heatmap]({{< relref "./heatmap.md" >}}) visualization.

{{< figure src="/static/img/docs/v43/heatmap_panel_cover.jpg" max-width="1000px" lightbox="true" caption="Heatmap" >}}

### State timeline

The state timeline panel visualization shows discrete state changes over time. When used with time series, the thresholds are used to turn the numerical values into discrete state regions.

{{< figure src="/static/img/docs/v8/state_timeline_strings.png" max-width="700px" caption="state timeline with string states" >}}
