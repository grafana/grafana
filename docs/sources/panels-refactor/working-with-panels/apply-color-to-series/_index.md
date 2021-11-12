+++
title = "Apply color to series and fields"
aliases = []
weight = 10
+++

# Apply color to series and fields

{{< figure src="/static/img/docs/v73/color_scheme_dropdown.png" max-width="350px" caption="Color scheme" class="pull-right" >}}

The color scheme option defines how Grafana colors series or fields. There are multiple modes here that work very differently and their utility depends largely on what visualization you currently have selected.

Some visualizations have different color options.

### Color by value

In addition to deriving color from thresholds there are also continuous (gradient) color schemes. These are useful for visualizations that color individual values. For example, stat panels and the table panel.

Continuous color modes use the percentage of a value relative to min and max to interpolate a color.

<div class="clearfix"></div>

### Palettes

Select a palette from the **Color scheme** list.

| Color mode                      | Description                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single color**                | Specify a single color, useful in an override rule                                                                                                       |
| **From thresholds**             | Informs Grafana to take the color from the matching threshold                                                                                            |
| **Classic palette**             | Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations |
| **Green-Yellow-Red (by value)** | Continuous color scheme                                                                                                                                  |
| **Blue-Yellow-Red (by value)**  | Continuous color scheme                                                                                                                                  |
| **Blues (by value)**            | Continuous color scheme (panel background to blue)                                                                                                       |
| **Reds (by value)**             | Continuous color scheme (panel background color to blue)                                                                                                 |
| **Greens (by value)**           | Continuous color scheme (panel background color to blue)                                                                                                 |
| **Purple (by value)**           | Continuous color scheme (panel background color to blue)                                                                                                 |.



