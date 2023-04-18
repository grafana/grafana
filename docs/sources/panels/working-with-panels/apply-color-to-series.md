---
aliases:
  - /docs/sources/panels/working-with-panels/apply-color-to-series/
title: Apply color to series and fields
weight: 50
---

# Apply color to series and fields

In addition to specifying color based on thresholds, you can configure the color of series and field data. The color options and their effect on the visualization depends on the visualization you are working with. Some visualizations have different color options.

You can specify a single color, or select a continuous (gradient) color schemes, based on a value.
Continuous color interpolates a color using the percentage of a value relative to min and max.

## Before you begin

- [Add a panel to a dashboard]({{< relref "../working-with-panels/add-panel.md" >}}).

**To apply color to series and fields**:

1. In panel display options, scroll to the **Standard options** or **override** section.

1. Click the **Standard options Color scheme** drop-down, and select one of the following palettes:

<div class="clearfix"></div>

| Color mode                      | Description                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **Single color**                | Specify a single color, useful in an override rule                                                                                                       |
| **From thresholds**             | Informs Grafana to take the color from the matching threshold                                                                                            |
| **Classic palette**             | Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations |
| **Green-Yellow-Red (by value)** | Continuous color scheme                                                                                                                                  |
| **Blue-Yellow-Red (by value)**  | Continuous color scheme                                                                                                                                  |
| **Blues (by value)**            | Continuous color scheme (panel background to blue)                                                                                                       |
| **Reds (by value)**             | Continuous color scheme (panel background color to blue)                                                                                                 |
| **Greens (by value)**           | Continuous color scheme (panel background color to blue)                                                                                                 |
| **Purple (by value)**           | Continuous color scheme (panel background color to blue)                                                                                                 | .   |

{{< figure src="/static/img/docs/v73/color_scheme_dropdown.png" max-width="350px" caption="Color scheme" class="pull-right" >}}
