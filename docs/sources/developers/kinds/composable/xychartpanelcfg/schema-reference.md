---
keywords:
  - grafana
  - schema
title: XYChartPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# XYChartPanelCfg kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property              | Type                           | Required | Description                                             |
|-----------------------|--------------------------------|----------|---------------------------------------------------------|
| `PanelOptions`        | [object](#paneloptions)        | **Yes**  |                                                         |
| `ScatterFieldConfig`  | [object](#scatterfieldconfig)  | **Yes**  |                                                         |
| `ScatterSeriesConfig` | [object](#scatterseriesconfig) | **Yes**  |                                                         |
| `ScatterShow`         | string                         | **Yes**  | Possible values are: `points`, `lines`, `points+lines`. |
| `SeriesMapping`       | string                         | **Yes**  | Possible values are: `auto`, `manual`.                  |
| `XYDimensionConfig`   | [object](#xydimensionconfig)   | **Yes**  |                                                         |

## PanelOptions

### Properties

| Property        | Type                                          | Required | Description                            |
|-----------------|-----------------------------------------------|----------|----------------------------------------|
| `dims`          | [XYDimensionConfig](#xydimensionconfig)       | No       |                                        |
| `seriesMapping` | string                                        | No       | Possible values are: `auto`, `manual`. |
| `series`        | [ScatterSeriesConfig](#scatterseriesconfig)[] | No       |                                        |

### ScatterSeriesConfig

#### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `name`   | string | No       |             |
| `x`      | string | No       |             |
| `y`      | string | No       |             |

### XYDimensionConfig

#### Properties

| Property  | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `frame`   | integer  | **Yes**  |             |
| `exclude` | string[] | No       |             |
| `x`       | string   | No       |             |

## ScatterFieldConfig

### Properties

| Property     | Type                                          | Required | Description                                                 |
|--------------|-----------------------------------------------|----------|-------------------------------------------------------------|
| `labelValue` | [TextDimensionConfig](#textdimensionconfig)   | No       |                                                             |
| `label`      | string                                        | No       | TODO docs Possible values are: `auto`, `never`, `always`.   |
| `lineColor`  | [ColorDimensionConfig](#colordimensionconfig) | No       | This is actually an empty interface used mainly for naming? |
| `lineStyle`  | [LineStyle](#linestyle)                       | No       | TODO docs                                                   |
| `lineWidth`  | integer                                       | No       |                                                             |
| `pointColor` | [ColorDimensionConfig](#colordimensionconfig) | No       | This is actually an empty interface used mainly for naming? |
| `pointSize`  | [ScaleDimensionConfig](#scaledimensionconfig) | No       |                                                             |
| `show`       | string                                        | No       | Possible values are: `points`, `lines`, `points+lines`.     |

### ColorDimensionConfig

This is actually an empty interface used mainly for naming?

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### ColorDimensionConfig

This is actually an empty interface used mainly for naming?

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### LineStyle

TODO docs

#### Properties

| Property | Type     | Required | Description                                            |
|----------|----------|----------|--------------------------------------------------------|
| `dash`   | number[] | No       |                                                        |
| `fill`   | string   | No       | Possible values are: `solid`, `dash`, `dot`, `square`. |

### ScaleDimensionConfig

#### Properties

| Property | Type    | Required | Description |
|----------|---------|----------|-------------|
| `max`    | integer | No       |             |
| `min`    | integer | No       |             |

### TextDimensionConfig

#### Properties

| Property | Type   | Required | Description                                        |
|----------|--------|----------|----------------------------------------------------|
| `mode`   | string | No       | Possible values are: `fixed`, `field`, `template`. |

## ScatterSeriesConfig

### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `name`   | string | No       |             |
| `x`      | string | No       |             |
| `y`      | string | No       |             |

## XYDimensionConfig

### Properties

| Property  | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `frame`   | integer  | **Yes**  |             |
| `exclude` | string[] | No       |             |
| `x`       | string   | No       |             |


