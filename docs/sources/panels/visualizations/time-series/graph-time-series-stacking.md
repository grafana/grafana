+++
title = "Graph stacked time series"
keywords = ["grafana", "time series panel", "documentation", "guide", "graph"]
weight = 400
+++

# Graph stacked time series

> **Note:** This is a beta feature. Time series panel is going to replace the Graph panel in a future release.

This section explains how to use Time series field options to control the stacking of the series and illustrates what the stacking options do.

Use the following field settings to configure your series stacking.

For more information about applying these options, refer to:

- [Configure all fields]({{< relref "../../field-options/configure-all-fields.md" >}})
- [Configure specific fields]({{< relref "../../field-options/configure-specific-fields.md" >}})

Some field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

## Stack series

![Stack series editor](/img/docs/time-series-panel/stack-series-editor-8-0.png)

Enable/disable series stacking

### Off

Do not stack series

![No series stacking example](/img/docs/time-series-panel/stacking-off-8-0.png)

### Normal

Stack series on top of each other

![Normal series stacking example](/img/docs/time-series-panel/stacking-normal-8-0.png)

## Stack series in groups

> **Note:** Stacking groups are available via the field overrides

For more information about creating field overrides, refer to [Add a field override]({{< relref "../../field-options/configure-specific-fields.md#add-a-field-override" >}}) 

The following image shows a graph with two stacking groups (A & B) defined.

![Stacking groups example](/img/docs/time-series-panel/stack-series-groups-8-0.png)

1. Create a field override for **Stack series** option.

![Stack series override](/img/docs/time-series-panel/stacking-override-default-8-0.png)

1. Name the stacking group you want the series to appear in. The stacking group name option is only available when creating an override.

![Stack series override](/img/docs/time-series-panel/stack-series-override-editor-8-0)

