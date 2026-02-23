---
title: Legend mode and legend placement
comments: |
  There are two legend shared files to cover the most common combinations of options. 
  Using two shared files ensures that content remains consistent across visualizations that share the same options and users don't have to figure out which options apply to a specific visualization when reading that content. 
  This file is used in the following visualizations: state timeline, status history
---

When the legend option is enabled it can show either the value mappings or the threshold brackets. To show the value mappings in the legend, it's important that the **Color scheme** as referenced in [Color scheme](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme) is set to **Single color** or **Classic palette**. To see the threshold brackets in the legend set the **Color scheme** to **From thresholds**.

For more information about the legend, refer to [Configure a legend](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-legend/).

### Visibility

Toggle the switch to turn the legend on or off.

### Mode

Use these settings to define how the legend appears in your visualization.

- **List -** Displays the legend as a list. This is a default display mode of the legend.
- **Table -** Displays the legend as a table.

### Placement

Choose where to display the legend.

- **Bottom -** Below the graph.
- **Right -** To the right of the graph.

### Width

Control how wide the legend is when placed on the right side of the visualization. This option is only displayed if you set the legend placement to **Right**.
