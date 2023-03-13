---
keywords:
  - grafana
  - schema
title: HeatmapPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## HeatmapPanelCfg

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0



| Property              | Type                           | Required | Description                                                                               |
|-----------------------|--------------------------------|----------|-------------------------------------------------------------------------------------------|
| `CellValues`          | [object](#cellvalues)          | **Yes**  | Controls cell value options                                                               |
| `ExemplarConfig`      | [object](#exemplarconfig)      | **Yes**  | Controls exemplar options                                                                 |
| `FilterValueRange`    | [object](#filtervaluerange)    | **Yes**  | Controls the value filter range                                                           |
| `HeatmapColorMode`    | string                         | **Yes**  | Controls the color mode of the heatmap<br/>Possible values are: `opacity`, `scheme`.      |
| `HeatmapColorOptions` | [object](#heatmapcoloroptions) | **Yes**  | Controls various color options                                                            |
| `HeatmapColorScale`   | string                         | **Yes**  | Controls the color scale of the heatmap<br/>Possible values are: `linear`, `exponential`. |
| `HeatmapLegend`       | [object](#heatmaplegend)       | **Yes**  | Controls legend options                                                                   |
| `HeatmapTooltip`      | [object](#heatmaptooltip)      | **Yes**  | Controls tooltip options                                                                  |
| `PanelFieldConfig`    | [object](#panelfieldconfig)    | **Yes**  |                                                                                           |
| `PanelOptions`        | [object](#paneloptions)        | **Yes**  |                                                                                           |
| `RowsHeatmapOptions`  | [object](#rowsheatmapoptions)  | **Yes**  | Controls frame rows options                                                               |
| `YAxisConfig`         | [object](#yaxisconfig)         | **Yes**  | Configuration options for the yAxis                                                       |

### CellValues

Controls cell value options

| Property   | Type   | Required | Description                                     |
|------------|--------|----------|-------------------------------------------------|
| `decimals` | number | No       | Controls the number of decimals for cell values |
| `unit`     | string | No       | Controls the cell value unit                    |

### ExemplarConfig

Controls exemplar options

| Property | Type   | Required | Description                            |
|----------|--------|----------|----------------------------------------|
| `color`  | string | **Yes**  | Sets the color of the exemplar markers |

### FilterValueRange

Controls the value filter range

| Property | Type   | Required | Description                                                              |
|----------|--------|----------|--------------------------------------------------------------------------|
| `ge`     | number | No       | Sets the filter range to values greater than or equal to the given value |
| `le`     | number | No       | Sets the filter range to values less than or equal to the given value    |

### HeatmapColorOptions

Controls various color options

| Property   | Type    | Required | Description                                                                               |
|------------|---------|----------|-------------------------------------------------------------------------------------------|
| `exponent` | number  | **Yes**  | Controls the exponent when scale is set to exponential                                    |
| `fill`     | string  | **Yes**  | Controls the color fill when in opacity mode                                              |
| `reverse`  | boolean | **Yes**  | Reverses the color scheme                                                                 |
| `scheme`   | string  | **Yes**  | Controls the color scheme used                                                            |
| `steps`    | integer | **Yes**  | Controls the number of color steps<br/>Constraint: `>=2 & <=128`.                         |
| `max`      | number  | No       | Sets the maximum value for the color scale                                                |
| `min`      | number  | No       | Sets the minimum value for the color scale                                                |
| `mode`     | string  | No       | Controls the color mode of the heatmap<br/>Possible values are: `opacity`, `scheme`.      |
| `scale`    | string  | No       | Controls the color scale of the heatmap<br/>Possible values are: `linear`, `exponential`. |

### HeatmapLegend

Controls legend options

| Property | Type    | Required | Description                     |
|----------|---------|----------|---------------------------------|
| `show`   | boolean | **Yes**  | Controls if the legend is shown |

### HeatmapTooltip

Controls tooltip options

| Property     | Type    | Required | Description                                                    |
|--------------|---------|----------|----------------------------------------------------------------|
| `show`       | boolean | **Yes**  | Controls if the tooltip is shown                               |
| `yHistogram` | boolean | No       | Controls if the tooltip shows a histogram of the y-axis values |

### PanelFieldConfig

It extends [HideableFieldConfig](#hideablefieldconfig).

| Property            | Type                                                | Required | Description                                                                  |
|---------------------|-----------------------------------------------------|----------|------------------------------------------------------------------------------|
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*<br/>TODO docs |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | TODO docs                                                                    |

### HideSeriesConfig

TODO docs

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

### HideableFieldConfig

TODO docs

| Property   | Type                                  | Required | Description |
|------------|---------------------------------------|----------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       | TODO docs   |

### ScaleDistributionConfig

TODO docs

| Property          | Type   | Required | Description                                                              |
|-------------------|--------|----------|--------------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs<br/>Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                          |
| `log`             | number | No       |                                                                          |

### PanelOptions

| Property       | Type                                                    | Required | Description                                                                                                     |
|----------------|---------------------------------------------------------|----------|-----------------------------------------------------------------------------------------------------------------|
| `color`        | [object](#color)                                        | **Yes**  | Controls the color options Default: `map[exponent:0.5 fill:dark-orange reverse:false scheme:Oranges steps:64]`. |
| `exemplars`    | [ExemplarConfig](#exemplarconfig)                       | **Yes**  | Controls exemplar options                                                                                       |
| `legend`       | [HeatmapLegend](#heatmaplegend)                         | **Yes**  | Controls legend options                                                                                         |
| `showValue`    | string                                                  | **Yes**  | TODO docs<br/>Possible values are: `auto`, `never`, `always`.                                                   |
| `tooltip`      | [HeatmapTooltip](#heatmaptooltip)                       | **Yes**  | Controls tooltip options                                                                                        |
| `yAxis`        | [YAxisConfig](#yaxisconfig)                             | **Yes**  | Configuration options for the yAxis                                                                             |
| `calculate`    | boolean                                                 | No       | Controls if the heatmap should be calculated from data Default: `false`.                                        |
| `calculation`  | [HeatmapCalculationOptions](#heatmapcalculationoptions) | No       |                                                                                                                 |
| `cellGap`      | integer                                                 | No       | Controls gap between cells Default: `1`.<br/>Constraint: `>=0 & <=25`.                                          |
| `cellRadius`   | number                                                  | No       | Controls cell radius                                                                                            |
| `cellValues`   | [object](#cellvalues)                                   | No       | Controls cell value unit Default: `map[]`.                                                                      |
| `filterValues` | [object](#filtervalues)                                 | No       | Filters values between a given range Default: `map[le:1e-09]`.                                                  |
| `rowsFrame`    | [RowsHeatmapOptions](#rowsheatmapoptions)               | No       | Controls frame rows options                                                                                     |

### HeatmapCalculationOptions

| Property   | Type                                                              | Required | Description |
|------------|-------------------------------------------------------------------|----------|-------------|
| `xBuckets` | [HeatmapCalculationBucketConfig](#heatmapcalculationbucketconfig) | No       |             |
| `yBuckets` | [HeatmapCalculationBucketConfig](#heatmapcalculationbucketconfig) | No       |             |

### HeatmapCalculationBucketConfig

| Property | Type                                                | Required | Description                                              |
|----------|-----------------------------------------------------|----------|----------------------------------------------------------|
| `mode`   | string                                              | No       | Possible values are: `size`, `count`.                    |
| `scale`  | [ScaleDistributionConfig](#scaledistributionconfig) | No       | TODO docs                                                |
| `value`  | string                                              | No       | The number of buckets to use for the axis in the heatmap |

### RowsHeatmapOptions

Controls frame rows options

| Property | Type   | Required | Description                                              |
|----------|--------|----------|----------------------------------------------------------|
| `layout` | string | No       | Possible values are: `le`, `ge`, `unknown`, `auto`.      |
| `value`  | string | No       | Sets the name of the cell when not calculating from data |

### YAxisConfig

Configuration options for the yAxis

It extends [AxisConfig](#axisconfig).

| Property            | Type                                                | Required | Description                                                                                                                             |
|---------------------|-----------------------------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisColorMode`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisLabel`         | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisPlacement`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisSoftMin`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisWidth`         | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `decimals`          | number                                              | No       | Controls the number of decimals for yAxis values                                                                                        |
| `max`               | number                                              | No       | Sets the maximum value for the yAxis                                                                                                    |
| `min`               | number                                              | No       | Sets the minimum value for the yAxis                                                                                                    |
| `reverse`           | boolean                                             | No       | Reverses the yAxis                                                                                                                      |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs                                                                              |
| `unit`              | string                                              | No       | Sets the yAxis unit                                                                                                                     |

### AxisConfig

TODO docs

| Property            | Type                                                | Required | Description                                                                            |
|---------------------|-----------------------------------------------------|----------|----------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       |                                                                                        |
| `axisColorMode`     | string                                              | No       | TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |                                                                                        |
| `axisLabel`         | string                                              | No       |                                                                                        |
| `axisPlacement`     | string                                              | No       | TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       |                                                                                        |
| `axisSoftMin`       | number                                              | No       |                                                                                        |
| `axisWidth`         | number                                              | No       |                                                                                        |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | TODO docs                                                                              |

### CellValues

Controls cell value unit

| Property | Type                              | Required | Description |
|----------|-----------------------------------|----------|-------------|
| `object` | Possible types are: [](#), [](#). |          |             |

### Color

Controls the color options

| Property | Type                              | Required | Description |
|----------|-----------------------------------|----------|-------------|
| `object` | Possible types are: [](#), [](#). |          |             |

### FilterValues

Filters values between a given range

| Property | Type                              | Required | Description |
|----------|-----------------------------------|----------|-------------|
| `object` | Possible types are: [](#), [](#). |          |             |


