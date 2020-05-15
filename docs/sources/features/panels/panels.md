+++
title = "Panel overview"
keywords = ["grafana", "panel", "documentation", "guide"]
type = "docs"
[menu.docs]
name = "Panels"
parent = "panels"
weight = 1
+++

# Panel overview

The *panel* is the basic visualization building block in Grafana. Each panel has a Query Editor specific to the data source selected in the panel. The query editor allows you to extract the perfect visualization to display on the panel.

There are a wide variety of styling and formatting options for each panel. Panels can be dragged and dropped and rearranged on the Dashboard. They can also be resized.

Panels like the [Graph]({{< relref "graph.md" >}}) panel allow you to graph as many metrics and series as you want. Other panels like [Singlestat]({{< relref "singlestat.md" >}}) require a reduction of a single query into a single number.

Panels can be made more dynamic with [Dashboard Templating]({{< relref "../../variables/templates-and-variables.md" >}}) variable strings within the panel configuration. The template can include queries to your data source configured in the Query Editor.

Panels can be [shared]({{< relref "../../reference/share_panel.md" >}}) easily in a variety of ways.

## Adding and editing graphs and panels

![](/img/docs/v45/metrics_tab.png)

1. You add panels by clicking the Add panel icon on the top menu.
1. To edit the graph you click on the graph title to open the panel menu, then `Edit`.
1. This should take you to the `Metrics` tab. In this tab you should see the editor for your default data source.

When you click the `Metrics` tab, you are presented with a Query Editor that is specific to the Panel Data Source. Use the Query Editor to build your queries and Grafana will visualize them in real time.

## Move panels

You can drag and drop panels by clicking and holding the panel title, then dragging it to its new location. You can also easily resize panels by clicking the (-) and (+) icons.

![](/img/docs/animated_gifs/drag_drop.gif)

## Tips and shortcuts

* Click the graph title and in the dropdown menu quickly change span or duplicate the panel.
* Click the Save icon in the menu to save the dashboard with a new name.
* Click the Save icon in the menu and then advanced to export the dashboard to json file, or set it as your default dashboard.
* Click the colored icon in the legend to select series color.
* Click series name in the legend to hide series.
* Ctrl/Shift/Meta + click legend name to hide other series.
