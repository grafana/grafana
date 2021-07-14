+++
title = "Visualizations"
weight = 420
+++

# Visualizations

Grafana offers a variety of different visualizations to suit different use cases. This section of the documentation lists the different visualizations available in Grafana, their unique options and use cases. You can add more panel types with [plugins]({{< relref "../../plugins/_index.md" >}}).

* Graphs & charts 
  * [Time series]({{< relref "./time-series/_index.md" >}}) is the default and main Graph visualization.    
  * [State timeline]({{< relref "./state-timeline.md" >}}) for state changes over time.   
  * [Status history]({{< relref "./state-timeline.md" >}}) for periodic state over time. 
  * [Bar chart]({{< relref "./bar-chart.md" >}}) shows any categorical data.
  * [Histogram]({{< relref "./histogram.md" >}}) calculates and shows value distribution in a bar chart.
  * [Heatmap]({{< relref "./heatmap.md" >}}).  
  * [Pie chart]({{< relref "./pie-chart-panel.md" >}}). 
* Stats & numbers
  * [Stat]({{< relref "./stat-panel.md" >}}) for big stats and optional sparkline. 
  * [Gauge]({{< relref "./gauge-panel.md" >}}) is a normal radial gauge.  
  * [Bar gauge]({{< relref "./bar-gauge-panel.md" >}}) is a horizontal or vertical bar gauge. 
* Misc
  * [Table]({{< relref "./table/_index.md" >}}) is the main and only Table visualization.
  * [Node Graph]({{< relref "./node-graph.md" >}}).
* Widgets
  * [Dashboard list]({{< relref "./dashboard-list-panel.md" >}}) can list dashboards.
  * [Alert list]({{< relref "./alert-list-panel.md" >}}) can list alert.
  * [Text panel]({{< relref "./alert-list-panel.md" >}}) can show markdown and html.
  * [News panel]({{< relref "./news-panel.md" >}}) can show RSS feeds.

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

### Heatmaps

To show value distribution over, time use the [heatmap]({{< relref "./heatmap.md" >}}) visualization.

### Table 

To show data in a table layout, use the [Table]({{< relref "./table/_index.md" >}}) visualization.

{{< figure src="/static/img/docs/tables/table_visualization.png" max-width="800px" lightbox="true" caption="Table visualization" >}}

### Pie chart 

Grafana now ships with an included [Pie chart]({{< relref "./pie-chart-panel.md" >}}) visualization.

{{< figure src="/static/img/docs/pie-chart-panel/pie-chart-example.png" max-width="700px" lightbox="true" caption="Table visualization" >}}
