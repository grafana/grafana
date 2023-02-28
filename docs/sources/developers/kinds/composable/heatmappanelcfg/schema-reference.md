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



| Property              | Type                           | Required | Description                                   |
|-----------------------|--------------------------------|----------|-----------------------------------------------|
| `CellValues`          | [object](#cellvalues)          | **Yes**  |                                               |
| `ExemplarConfig`      | [object](#exemplarconfig)      | **Yes**  |                                               |
| `FilterValueRange`    | [object](#filtervaluerange)    | **Yes**  |                                               |
| `HeatmapColorMode`    | string                         | **Yes**  | Possible values are: `opacity`, `scheme`.     |
| `HeatmapColorOptions` | [object](#heatmapcoloroptions) | **Yes**  |                                               |
| `HeatmapColorScale`   | string                         | **Yes**  | Possible values are: `linear`, `exponential`. |
| `HeatmapLegend`       | [object](#heatmaplegend)       | **Yes**  |                                               |
| `HeatmapTooltip`      | [object](#heatmaptooltip)      | **Yes**  |                                               |
| `PanelFieldConfig`    | [object](#panelfieldconfig)    | **Yes**  |                                               |
| `PanelOptions`        | [object](#paneloptions)        | **Yes**  |                                               |
| `RowsHeatmapOptions`  | [object](#rowsheatmapoptions)  | **Yes**  |                                               |
| `YAxisConfig`         | [object](#yaxisconfig)         | **Yes**  |                                               |

### CellValues

| Property   | Type   | Required | Description |
|------------|--------|----------|-------------|
| `decimals` | number | No       |             |
| `unit`     | string | No       |             |

### ExemplarConfig

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `color`  | string | **Yes**  |             |

### FilterValueRange

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `ge`     | number | No       |             |
| `le`     | number | No       |             |

### HeatmapColorOptions

| Property   | Type    | Required | Description                                   |
|------------|---------|----------|-----------------------------------------------|
| `exponent` | number  | **Yes**  |                                               |
| `fill`     | string  | **Yes**  |                                               |
| `mode`     | string  | **Yes**  | Possible values are: `opacity`, `scheme`.     |
| `reverse`  | boolean | **Yes**  |                                               |
| `scale`    | string  | **Yes**  | Possible values are: `linear`, `exponential`. |
| `scheme`   | string  | **Yes**  |                                               |
| `steps`    | integer | **Yes**  | Constraint: `>=2 & <=128`.                    |
| `max`      | number  | No       |                                               |
| `min`      | number  | No       |                                               |

### HeatmapLegend

| Property | Type    | Required | Description |
|----------|---------|----------|-------------|
| `show`   | boolean | **Yes**  |             |

### HeatmapTooltip

| Property     | Type    | Required | Description |
|--------------|---------|----------|-------------|
| `show`       | boolean | **Yes**  |             |
| `yHistogram` | boolean | No       |             |

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

| Property       | Type                              | Required | Description                                                                                                        |
|----------------|-----------------------------------|----------|--------------------------------------------------------------------------------------------------------------------|
| `exemplars`    | [ExemplarConfig](#exemplarconfig) | **Yes**  |                                                                                                                    |
| `legend`       | [HeatmapLegend](#heatmaplegend)   | **Yes**  |                                                                                                                    |
| `showValue`    | string                            | **Yes**  | TODO docs<br/>Possible values are: `auto`, `never`, `always`.                                                      |
| `tooltip`      | [HeatmapTooltip](#heatmaptooltip) | **Yes**  |                                                                                                                    |
| `yAxis`        | [object](#yaxis)                  | **Yes**  | Default: `map[axisPlacement:left]`.                                                                                |
| `calculate`    | boolean                           | No       | Default: `false`.                                                                                                  |
| `cellGap`      | integer                           | No       | Default: `1`.<br/>Constraint: `>=0 & <=25`.                                                                        |
| `cellRadius`   | number                            | No       |                                                                                                                    |
| `cellValues`   | [object](#cellvalues)             | No       | Default: `map[]`.                                                                                                  |
| `color`        | [object](#color)                  | No       | Default: `map[exponent:0.5 fill:dark-orange mode:scheme reverse:false scale:exponential scheme:Oranges steps:64]`. |
| `filterValues` | [object](#filtervalues)           | No       | Default: `map[le:1e-09]`.                                                                                          |
| `rowsFrame`    | [object](#rowsframe)              | No       | Default: `map[layout:auto]`.                                                                                       |

### CellValues

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### Color

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### FilterValues

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### RowsFrame

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### YAxis

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### RowsHeatmapOptions

| Property | Type   | Required | Description                                         |
|----------|--------|----------|-----------------------------------------------------|
| `layout` | string | No       | Possible values are: `le`, `ge`, `unknown`, `auto`. |
| `value`  | string | No       |                                                     |

### YAxisConfig

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
| `decimals`          | number                                              | No       |                                                                                                                                         |
| `max`               | number                                              | No       |                                                                                                                                         |
| `min`               | number                                              | No       |                                                                                                                                         |
| `reverse`           | boolean                                             | No       |                                                                                                                                         |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs                                                                              |
| `unit`              | string                                              | No       |                                                                                                                                         |

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


