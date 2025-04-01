---
title: Axis options
comments: |
  This file is used in the following visualizations: time series.
---

Options under the **Axis** section control how the x- and y-axes are rendered. Some options don't take effect until you click outside of the field option box you're editing. You can also press `Enter`.

| Option                             | Description                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Time zone                          | Set the desired time zones to display along the x-axis.                                                            |
| [Placement](#placement)            | Select the placement of the y-axis.                                                                                |
| Label                              | Set a y-axis text label. If you have more than one y-axis, then you can assign different labels using an override. |
| Width                              | Set a fixed width for the axis. By default, Grafana dynamically calculates the width of an axis.                   |
| Show grid lines                    | Set the axis grid line visibility.<br>                                                                             |
| Color                              | Set the color of the axis.                                                                                         |
| Show border                        | Set the axis border visibility.                                                                                    |
| Scale                              | Set the y-axis values scale.<br>                                                                                   |
| Centered zero                      | Set the y-axis so it's centered on zero.                                                                           |
| [Soft min](#soft-min-and-soft-max) | Set a soft min to better control the y-axis limits. zero.                                                          |
| [Soft max](#soft-min-and-soft-max) | Set a soft max to better control the y-axis limits. zero.                                                          |

#### Placement

Select the placement of the y-axis. Choose from the following:

- **Auto** - Automatically assigns the y-axis to the series. When there are two or more series with different units, Grafana assigns the left axis to the first unit and the right axis to the units that follow.
- **Left** - Display all y-axes on the left side.
- **Right** - Display all y-axes on the right side.
- **Hidden** - Hide all axes. To selectively hide axes, [Add a field override](ref:add-a-field-override) that targets specific fields.

#### Soft min and soft max

Set a **Soft min** or **soft max** option for better control of y-axis limits. By default, Grafana sets the range for the y-axis automatically based on the dataset.

**Soft min** and **soft max** settings can prevent small variations in the data from being magnified when it's mostly flat. In contrast, hard min and max values help prevent obscuring useful detail in the data by clipping intermittent spikes past a specific point.

To define hard limits of the y-axis, set standard min/max options. For more information, refer to [Configure standard options](ref:configure-standard-options).

![Label example](/static/img/docs/time-series-panel/axis-soft-min-max-7-4.png)