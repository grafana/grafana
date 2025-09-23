---
canonical: https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/xy-chart/
keywords:
  - grafana
  - chart
  - xy chart
  - documentation
  - guide
  - graph
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's xy chart
title: XY chart
weight: 100
refs:
  panel-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-panel-options/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-panel-options/
  data-links:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-data-links/
  configure-standard-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#max
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#max
  standard-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/
  color-scheme:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#color-scheme
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#color-scheme
  add-a-field-override:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/#add-a-field-override
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/#add-a-field-override
  configure-field-overrides:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/
---

# XY chart

XY charts provide a way to visualize arbitrary x and y values in a graph so that you can easily show the relationship between two variables. XY charts are typically used to create scatter plots. You can also use them to create bubble charts where field values determine the size of each bubble:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-xy-charts-v11.6.png" max-width="750px" alt="An xy chart showing height weight distribution" >}}

## Supported data formats

You can use any type of tabular data with at least two numeric fields in an xy chart. This type of visualization doesn't require time data.

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### XY Chart options

The following options let you control how data is displayed in an xy chart:

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| [Series mapping](#series-mapping) | Set how series data is mapped in the chart. Choose from: **Auto** and **Manual**. Depending on your series mapping selection, the **Frame**, **X-field**, and **Y-field** options differ. For information on setting these specific fields, refer to the [Series mapping section](#series-mapping). |
| Size field | Set which field's values control the size of the points in the chart. This value is relative to the min and max of all the values in the data frame. When you select this option, you can then set the **Min point size** and **Max point size** options. Required in **Manual** mode. |
| Color field | Set which field's values control the color of the points in the chart. To use the color value options under the **Standard** options, you must set this field. Typically, this field is used when you only have one series displayed in the chart. Required in **Manual** mode. |
| [Show](#show) | Set how values are represented in the visualization. Choose from: **Points**, **Lines**, or **Both**. |
| Point size | Set the size of all points in the chart, from one to one hundred pixels in diameter. The default size is five pixels. You can set an [override](ref:configure-field-overrides) to set the pixel size by series (y-field). |
| Min/Max point size | Use these options to control the minimum or maximum point size when you've set the **Size field** option. You can [override](ref:configure-field-overrides) these options for specific series. |
| Point shape | Set the shape of the points in the chart. Choose from:<ul><li>**Circle** - The default setting</li><li>**Square** </li></ul> |
| Point stroke width | The width of the point stroke in pixels. The default is one pixel. |
| Fill opacity | The opacity of the point fill. The default is 50. |
| [Line style](#line-style) | Set the style of the lines that connect points. Choose from: **Solid**, **Dash**, or **Dots**. |
| Line width | The width of the lines that connect points, in pixels. |

<!-- prettier-ignore-end -->

#### Series mapping

Set how series data is mapped in the chart. Choose from:

- **Auto** - Automatically generates series from all available data frames (or datasets). You can filter to select only one frame.
- **Manual** - Explicitly define the series by selecting from available data frames.

Depending on your series mapping selection, the **Frame**, **X-field**, and **Y-field** options differ.
These options are described in the tabs that follow:

{{< tabs >}}
{{< tab-content name="Auto series mapping options" >}}

When you select **Auto** as your series mapping mode, the following options are preconfigured, but you can also define them yourself:

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Frame | By default, an xy chart displays all data frames. You can filter to select only one frame. |
| [X field](#x-field) | Select which field or fields x represents. By default, this is the first number field in each data frame. For an example of this in **Auto** mode, refer to the [X field section](#x-field). |
| [Y field](#y-field) | After the x-field is set, by default, all the remaining number fields in the data frame are designated as the y-fields. You can use this option to explicitly choose which fields to use for y. For more information on how to use this in **Auto** mode, refer to the [Y field section](#y-field). |

<!-- prettier-ignore-end -->

{{< /tab-content >}}
{{< tab-content name="Manual series mapping options" >}}

When you select **Manual** as your series mode, you can add, edit, and delete series.
To manage a series, click the **Series** field; to rename the series, click the series name.

In **Manual** mode, these fields are required:

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Frame | Select your data frame or dataset. You can add as many frames as you want. |
| X field | Select which field x represents. |
| Y field | Select which field y represents. |

<!-- prettier-ignore-end -->

{{< /tab-content >}}
{{< /tabs >}}

#### X field

In **Auto** series mapping mode, select which field or fields x represents. By default, this is the first number field in each data frame. For example, you enter the following CSV content:

| a   | b   | c   |
| --- | --- | --- |
| 0   | 0   | 0   |
| 1   | 1   | 9   |
| 2   | 2   | 4   |

In the resulting chart, the x-field is generated from the values in column "a" unless you define it differently.

#### Y field

In **Auto** series mapping mode, after the x-field is set, by default, all the remaining number fields in the data frame are designated as the y-fields.
You can use this option to explicitly choose which fields to use for y.

The series of the chart are generated from the y-fields.
To make changes to a series in an xy chart, make [overrides](ref:configure-field-overrides) to the y-field.

{{< admonition type=note >}}
Any field you use in the **Size field** or **Color field** doesn't generate a series.
{{< /admonition >}}

You can also use [overrides](ref:configure-field-overrides) to exclude y-fields individually.
To do so, add an override with the following properties for each y-field you want removed:

- Override type: **Fields with name**
- Override property: **Series > Hide in area**
- Area: **Viz**

#### Show

Set how values are represented in the visualization. Choose from:

- **Points** - Display values as points. When you select this option, the **Point size** option is also displayed.
- **Lines** - Add a line between values. When you select this option, the [Line style](#line-style) and **Line width** options are also displayed.
- **Both** - Display both points and lines.

#### Line style

Set the style of the lines that connect points. To change the color, use the standard [Color scheme](ref:color-scheme) field option.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-line-style-options-v11.6.png" max-width="400px" alt="Line style options" >}}

- **Solid** - Display a solid line. This is the default setting.
- **Dash** - Display a dashed line. When you choose this option, a drop-down list is displayed where you can select the length and gap setting for the line dashes. By default, the length and gap are set to `10, 10`.
- **Dots** - Display dotted lines. When you choose this option, a drop-down list is displayed where you can select dot spacing. By default, the dot spacing is set to `0, 10` (the first number represents dot length, which is always zero).

### Tooltip options

Tooltip options control the information overlay that appears when you hover over data points in the visualization.

<!-- prettier-ignore-start -->

| Option       | Description |
| ------------ | ----------- |
| Tooltip mode | When you hover your cursor over the visualization, Grafana can display tooltips. Choose how they behave:<ul><li>**Single** - The hover tooltip shows only a single series, the one that you are hovering over on the visualization.</li><li>**Hidden** - Do not display the tooltip when you interact with the visualization.</li></ul> |
| Max width    | Set the maximum width of the tooltip box. |

<!-- prettier-ignore-end -->

### Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Axis options

{{< docs/shared lookup="visualizations/axis-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Standard options

**Standard options** in the panel editor pane let you change how field data is displayed in your visualizations. When you set a standard option, the change is applied to all fields or series. For more granular control over the display of fields, refer to [Configure field overrides](ref:configure-field-overrides).

You can customize the following standard options:

- **Field min/max** - Enable **Field min/max** to have Grafana calculate the min or max of each field individually, based on the minimum or maximum value of the field.
- **Color scheme** - Set single or multiple colors for your entire visualization. To learn more about color schemes, refer to [Configure standard options](ref:configure-standard-options).

### Data links and actions

{{< docs/shared lookup="visualizations/datalink-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
