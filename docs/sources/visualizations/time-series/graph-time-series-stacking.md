---
aliases:
  - ../../features/panels/histogram/
  - ../../panels/visualizations/time-series/graph-time-series-stacking/
keywords:
  - grafana
  - time series panel
  - documentation
  - guide
  - graph
title: Graph stacked time series
weight: 400
---

# Graph stacked time series

This section explains how to use Time series panel field options to control the stacking of the series and illustrates what the stacking options do.

_Stacking_ allows Grafana to display series on top of each other. Be cautious when using stacking in the visualization as it can easily create misleading graphs. You can read more on why stacking may be not the best approach here: [Stacked Area Graphs Are Not Your Friend](https://everydayanalytics.ca/2014/08/stacked-area-graphs-are-not-your-friend.html).

Use the following field settings to configure your series stacking.

Some field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

## Stack series

Turn series stacking on or off.

![Stack series editor](/static/img/docs/time-series-panel/stack-series-editor-8-0.png)

### Off

Turn off series stacking. A series will share the same space in the visualization.

![No series stacking example](/static/img/docs/time-series-panel/stacking-off-8-0.png)

### Normal

Enable stacking series on top of each other.

![Normal series stacking example](/static/img/docs/time-series-panel/stacking-normal-8-0.png)

## Stack series in groups

The stacking group option is only available as an override.

For more information about creating field overrides, refer to [About field overrides]({{< relref "../../panels/override-field-values/about-field-overrides.md" >}}).

Stack series in the same group. In the Overrides section:

1. Create a field override for **Stack series** option.

   ![Stack series override](/static/img/docs/time-series-panel/stacking-override-default-8-0.png)

1. Click on **Normal** stacking mode.
1. Name the stacking group you want the series to appear in. The stacking group name option is only available when creating an override.

![Stack series override editor](/static/img/docs/time-series-panel/stack-series-override-editor-8-0.png)

A-series and B-series stacked in group A, C-series, and D-series stacked in group B:

![Stacking groups example](/static/img/docs/time-series-panel/stack-series-groups-8-0.png)
