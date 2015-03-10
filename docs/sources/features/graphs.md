---
title: Docs - Graphing
---

# Graphing

The main panel for in Grafana is simply named Graph. It provides a very rich set of graphing options.

<img src="/img/v1/graph_overview.png" class="no-shadow">

## Axes, Grid & Legend options
![](/img/v1/graph_axes_grid_options.png)

### Legens values

Check ``Include Values`` under legend styles.

- Total   - Sum of all values returned from metric query
- Current - Last value returned from the metric query

This means that if your series represents a rate, for example requests / second then the Total in the legend will
not represent the total number of requests. It is just the sum of all data points.


## Display options
![](/img/v1/graph_display_styles.png)

If you have stack enabled you can select what the mouse hover feature should show.

- Cumulative - Sum of series below plus the series you hover over
- Individual - Just the value for the series you hover over

