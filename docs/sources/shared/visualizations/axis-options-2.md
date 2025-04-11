---
title: Axis options
comments: |
  There are three axis options shared files, axis-options-1.md, axis-options-2.md, and axis-options-3.md to cover the most common combinations of options. 
  Using shared files ensures that content remains consistent across visualizations that share the same options and users don't have to figure out which options apply to a specific visualization when reading that content.
  This file is used in the following visualizations: candlestick, trend, xy chart
---

Options under the **Axis** section control how the x- and y-axes are rendered. Some options don't take effect until you click outside of the field option box you're editing. You can also press `Enter`.

<!-- prettier-ignore-start -->

| Option                             | Description       |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| [Placement](#placement)            | Select the placement of the y-axis.  Choose from: **Auto**, **Left**, **Right**, and **Hidden**.  |
| Label                              | Set a y-axis text label. If you have more than one y-axis, then you can assign different labels using an override. |
| Width                              | Set a fixed width for the axis. By default, Grafana dynamically calculates the width of an axis. |
| Show grid lines                    | Set the axis grid line visibility. Choose from: **Auto**, **On**, and **Off**. |
| Color                          | Set the color of the axis. Choose from:<ul><li>**Text** - Uses panel text color.</li><li>**Series** - Uses the colors of the series.</li></ul> |
| Show border                        | Set the axis border visibility. |
| [Scale](#scale)                    | Set the y-axis values scale. Choose from: **Linear**, **Logarithmic**, and **Symlog**.  |
| Centered zero                      | Set the y-axis so it's centered on zero. Applies to the **Linear** or **Symlog** scale options. |
| [Soft min](#soft-min-and-soft-max) | Set a soft min to better control the y-axis limits. |
| [Soft max](#soft-min-and-soft-max) | Set a soft max to better control the y-axis limits. |

<!-- prettier-ignore-end -->

#### Placement

Select the placement of the y-axis. Choose from the following:

- **Auto** - Automatically assigns the y-axis to the series. When there are two or more series with different units, Grafana assigns the left axis to the first unit and the right axis to the units that follow.
- **Left** - Display all y-axes on the left side.
- **Right** - Display all y-axes on the right side.
- **Hidden** - Hide all axes. To selectively hide axes, [Add a field override](ref:add-a-field-override) that targets specific fields.

#### Scale

Set the y-axis values scale. Choose from:

- **Linear** - Divides the scale into equal parts.
- **Logarithmic** - Use a logarithmic scale. If you select this option, in the **Log base** list, choose a binary (base 2) or common (base 10) logarithmic scale.
- **Symlog** - Use a symmetrical logarithmic scale. If you select this option, choose also:
  - **Log base** - Select a binary (base 2) or common (base 10) logarithmic scale.
  - **Linear threshold** - Set the threshold at which the scale changes from linear to logarithmic.

#### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of y-axis limits. By default, Grafana sets the range for the y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent small variations in the data from being magnified when it's mostly flat. In contrast, hard min and max values help prevent obscuring useful detail in the data by clipping intermittent spikes past a specific point.

To define hard limits of the y-axis, set standard min/max options. For more information, refer to [Configure standard options](ref:configure-standard-options).

<!--

![Label example](/static/img/docs/time-series-panel/axis-soft-min-max-7-4.png) -->
