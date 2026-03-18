---
title: Axis options
comments: |
  There are three axis options shared files, axis-options-1.md, axis-options-2.md, and axis-options-3.md to cover the most common combinations of options. 
  Using shared files ensures that content remains consistent across visualizations that share the same options and users don't have to figure out which options apply to a specific visualization when reading that content.
  This file is used in the following visualizations: time series.
---

Options under the **Axis** section control how the x- and y-axes are rendered. Some options don't take effect until you click outside of the field option box you're editing. You can also press `Enter`.

<!-- prettier-ignore-start -->

| Option                             | Description                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Time zone                          | Set the desired time zones to display along the x-axis. Choose from: **Auto**, **Left**, **Right**, and **Hidden**. |
| [Placement](#placement)            | Select the placement of the y-axis.                                                                                |
| Label                              | Set a y-axis text label. If you have more than one y-axis, then you can assign different labels using an override. |
| Width                              | Set a fixed width for the axis. By default, Grafana dynamically calculates the width of an axis.                   |
| Show grid lines                    | Set the axis grid line visibility. Choose from: **Auto**, **On**, and **Off**.                                     |
| Color                              | Set the color of the axis. Choose from:<ul><li>**Text** - Uses panel text color.</li><li>**Series** - Uses the colors of the series.</li></ul> |
| Show border                        | Set the axis border visibility.                                                                                    |
| [Scale](#scale)                    | Set the y-axis values scale. Choose from: **Linear**, **Logarithmic**, and **Symlog**.                             |
| Centered zero                      | Set the y-axis so it's centered on zero.                                                                           |
| [Soft min](#soft-min-and-soft-max) | Set a soft min to better control the y-axis limits.                                                                |
| [Soft max](#soft-min-and-soft-max) | Set a soft max to better control the y-axis limits.                                                                |
| [Tick positions](#tick-positions)   | Set explicit y-axis tick positions as a comma-separated list of values.                                            |
| [Tick interval](#tick-interval)     | Set one or more candidate intervals between y-axis ticks.                                                          |

<!-- prettier-ignore-end -->

#### Placement

Select the placement of the y-axis. Choose from the following:

- **Auto** - Automatically assigns the y-axis to the series. When there are two or more series with different units, Grafana assigns the left axis to the first unit and the right axis to the units that follow.
- **Left** - Display all y-axes on the left side.
- **Right** - Display all y-axes on the right side.
- **Hidden** - Hide all axes. To selectively hide axes, [Add a field override](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/#add-a-field-override) that targets specific fields.

#### Scale

Set the y-axis values scale. Choose from:

- **Linear** - Divides the scale into equal parts.
- **Logarithmic** - Use a logarithmic scale. When you select this option, a list appears for you to choose a binary (base 2) or common (base 10) logarithmic scale.
- **Symlog** - Use a symmetrical logarithmic scale. When you select this option, a list appears for you to choose a binary (base 2) or common (base 10) logarithmic scale. The linear threshold option allows you to set the threshold at which the scale changes from linear to logarithmic.

#### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of y-axis limits. By default, Grafana sets the range for the y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent small variations in the data from being magnified when it's mostly flat. In contrast, hard min and max values help prevent obscuring useful detail in the data by clipping intermittent spikes past a specific point.

To define hard limits of the y-axis, set standard min/max options. For more information, refer to [Configure standard options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#max).

![Label example](/media/docs/grafana/panels-visualizations/screenshot-soft-min-max-v12.0.png)

#### Tick positions

Set explicit y-axis tick positions by entering a comma-separated list of values. When set, ticks, grid lines, and labels appear at exactly the specified values. For example, entering `0, 90, 180, 270, 360` places ticks at those specific positions—useful for wind direction in degrees or other domain-specific reference points.

Values outside the visible scale range are automatically hidden. If both **Tick positions** and **Tick interval** are set, **Tick positions** takes precedence.

This option is hidden when the axis placement is **Hidden** or when the scale is set to **Logarithmic**.

#### Tick interval

Set one or more candidate intervals between y-axis ticks. Grafana automatically selects the best candidate based on the available panel space, making tick density responsive to panel size.

Enter a single value or a comma-separated list of values, sorted from smallest to largest. For example:

- `90` — ticks every 90 units (e.g., 0, 90, 180, 270, 360 for wind direction).
- `22.5, 45, 90` — on a tall panel, Grafana picks `22.5` for fine-grained ticks (0, 22.5, 45, 67.5, 90, ...); on a smaller panel, it picks `90` for coarser ticks (0, 90, 180, 270, 360). Combined with value mappings, this lets you show compass labels like N, NNE, NE that adapt to the panel size.
- `1` — ensures only integer tick values, useful for data that represents discrete counts.

When left empty, Grafana automatically calculates tick spacing. This option is hidden when **Tick positions** is set, when the axis placement is **Hidden**, or when the scale is set to **Logarithmic**.
