+++
title = "Panels"
type = "docs"
aliases = ["/docs/grafana/latest/features/panels/panels/"]
[menu.docs]
identifier = "panels"
weight = 4
draft = "true"
+++

# Panel overview

The *panel* is the basic visualization building block in Grafana. Each panel has a query editor specific to the data source selected in the panel. The query editor allows you to extract the perfect visualization to display on the panel.

With the exception of a few special use panels, a panel is a visual representation of one or more queries. The queries display data over time. This can range from temperature fluctuations to current server status to a list of logs or alerts.

In order to display data, you need to have at least one data source added to Grafana. Refer to [Add a data source]({{< relref "../datasources/add-a-data-source.md" >}}) for instructions, or see our [Getting started]({{< relref "../getting-started/getting-started.md" >}}) guide if you want to make your first dashboard and panel using our TestData DB data source.

There are a wide variety of styling and formatting options for each panel. Panels can be dragged and dropped and rearranged on the dashboard. They can also be resized.

## Move or resize panels

You can drag and drop panels by clicking and holding the panel title, then dragging it to its new location. You can also easily resize panels by clicking the (-) and (+) icons.

![](/img/docs/animated_gifs/drag_drop.gif)

## Tips and shortcuts

- Click the graph title and in the dropdown menu quickly duplicate the panel.
- Click the colored icon in the legend to change a series color or the y-axis.
- Click series name in the legend to hide series.
- Ctrl/Shift/Meta + click legend name to hide other series.
- Hover your cursor over a panel and press `e` to open the panel editor.
- Hover your cursor over a panel and press `v` to open the panel in fullscreen view.