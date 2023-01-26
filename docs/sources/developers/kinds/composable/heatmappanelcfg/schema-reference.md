---
keywords:
  - grafana
  - schema
title: HeatmapPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# HeatmapPanelCfg kind

## Maturity: merged
## Version: 0.0

## Properties

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

## CellValues

### Properties

| Property   | Type   | Required | Description |
|------------|--------|----------|-------------|
| `decimals` | number | No       |             |
| `unit`     | string | No       |             |

## ExemplarConfig

### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `color`  | string | **Yes**  |             |

## FilterValueRange

### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `ge`     | number | No       |             |
| `le`     | number | No       |             |

## HeatmapColorOptions

### Properties

| Property   | Type    | Required | Description                                   |
|------------|---------|----------|-----------------------------------------------|
| `exponent` | number  | **Yes**  |                                               |
| `fill`     | string  | **Yes**  |                                               |
| `mode`     | string  | **Yes**  | Possible values are: `opacity`, `scheme`.     |
| `reverse`  | boolean | **Yes**  |                                               |
| `scale`    | string  | **Yes**  | Possible values are: `linear`, `exponential`. |
| `scheme`   | string  | **Yes**  |                                               |
| `steps`    | integer | **Yes**  |                                               |
| `max`      | number  | No       |                                               |
| `min`      | number  | No       |                                               |

## HeatmapLegend

### Properties

| Property | Type    | Required | Description |
|----------|---------|----------|-------------|
| `show`   | boolean | **Yes**  |             |

## HeatmapTooltip

### Properties

| Property     | Type    | Required | Description |
|--------------|---------|----------|-------------|
| `show`       | boolean | **Yes**  |             |
| `yHistogram` | boolean | No       |             |

## PanelFieldConfig

### Properties

| Property            | Type                                                | Required | Description |
|---------------------|-----------------------------------------------------|----------|-------------|
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | TODO docs   |

### ScaleDistributionConfig

TODO docs

#### Properties

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

## PanelOptions

### Properties

| Property       | Type                              | Required | Description                                                                                                        |
|----------------|-----------------------------------|----------|--------------------------------------------------------------------------------------------------------------------|
| `exemplars`    | [ExemplarConfig](#exemplarconfig) | **Yes**  |                                                                                                                    |
| `legend`       | [HeatmapLegend](#heatmaplegend)   | **Yes**  |                                                                                                                    |
| `showValue`    | string                            | **Yes**  | TODO docs Possible values are: `auto`, `never`, `always`.                                                          |
| `tooltip`      | [HeatmapTooltip](#heatmaptooltip) | **Yes**  |                                                                                                                    |
| `yAxis`        | [object](#yaxis)                  | **Yes**  | Default: `map[axisPlacement:left]`.                                                                                |
| `calculate`    | boolean                           | No       | Default: `false`.                                                                                                  |
| `cellGap`      | integer                           | No       | Default: `1`.                                                                                                      |
| `cellRadius`   | number                            | No       |                                                                                                                    |
| `cellValues`   | [object](#cellvalues)             | No       | Default: `map[]`.                                                                                                  |
| `color`        | [object](#color)                  | No       | Default: `map[exponent:0.5 fill:dark-orange mode:scheme reverse:false scale:exponential scheme:Oranges steps:64]`. |
| `filterValues` | [object](#filtervalues)           | No       | Default: `map[le:1e-09]`.                                                                                          |
| `rowsFrame`    | [object](#rowsframe)              | No       | Default: `map[layout:auto]`.                                                                                       |

### ExemplarConfig

#### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `color`  | string | **Yes**  |             |

### HeatmapLegend

#### Properties

| Property | Type    | Required | Description |
|----------|---------|----------|-------------|
| `show`   | boolean | **Yes**  |             |

### HeatmapTooltip

#### Properties

| Property     | Type    | Required | Description |
|--------------|---------|----------|-------------|
| `show`       | boolean | **Yes**  |             |
| `yHistogram` | boolean | No       |             |

### cellValues

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### color

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### filterValues

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### rowsFrame

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### yAxis

| Property | Type | Required | Description |
|----------|------|----------|-------------|

## RowsHeatmapOptions

### Properties

| Property | Type   | Required | Description                                         |
|----------|--------|----------|-----------------------------------------------------|
| `layout` | string | No       | Possible values are: `le`, `ge`, `unknown`, `auto`. |
| `value`  | string | No       |                                                     |

## YAxisConfig

### Properties

| Property   | Type    | Required | Description |
|------------|---------|----------|-------------|
| `decimals` | number  | No       |             |
| `max`      | number  | No       |             |
| `min`      | number  | No       |             |
| `reverse`  | boolean | No       |             |
| `unit`     | string  | No       |             |


