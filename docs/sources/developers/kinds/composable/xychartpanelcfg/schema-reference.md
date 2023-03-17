---
keywords:
  - grafana
  - schema
title: XYChartPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## XYChartPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property              | Type                           | Required | Description                                             |
|-----------------------|--------------------------------|----------|---------------------------------------------------------|
| `PanelOptions`        | [object](#paneloptions)        | **Yes**  |                                                         |
| `ScatterFieldConfig`  | [object](#scatterfieldconfig)  | **Yes**  |                                                         |
| `ScatterSeriesConfig` | [object](#scatterseriesconfig) | **Yes**  |                                                         |
| `ScatterShow`         | string                         | **Yes**  | Possible values are: `points`, `lines`, `points+lines`. |
| `SeriesMapping`       | string                         | **Yes**  | Possible values are: `auto`, `manual`.                  |
| `XYDimensionConfig`   | [object](#xydimensionconfig)   | **Yes**  |                                                         |

### PanelOptions

It extends [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip).

| Property        | Type                                          | Required | Description                                                                |
|-----------------|-----------------------------------------------|----------|----------------------------------------------------------------------------|
| `dims`          | [XYDimensionConfig](#xydimensionconfig)       | **Yes**  |                                                                            |
| `legend`        | [VizLegendOptions](#vizlegendoptions)         | **Yes**  | *(Inherited from [OptionsWithLegend](#optionswithlegend))*<br/>TODO docs   |
| `series`        | [ScatterSeriesConfig](#scatterseriesconfig)[] | **Yes**  |                                                                            |
| `tooltip`       | [VizTooltipOptions](#viztooltipoptions)       | **Yes**  | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))*<br/>TODO docs |
| `seriesMapping` | string                                        | No       | Possible values are: `auto`, `manual`.                                     |

### OptionsWithLegend

TODO docs

| Property | Type                                  | Required | Description |
|----------|---------------------------------------|----------|-------------|
| `legend` | [VizLegendOptions](#vizlegendoptions) | **Yes**  | TODO docs   |

### VizLegendOptions

TODO docs

| Property      | Type     | Required | Description                                                                                                                             |
|---------------|----------|----------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  |                                                                                                                                         |
| `displayMode` | string   | **Yes**  | TODO docs<br/>Note: "hidden" needs to remain as an option for plugins compatibility<br/>Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  | TODO docs<br/>Possible values are: `bottom`, `right`.                                                                                   |
| `showLegend`  | boolean  | **Yes**  |                                                                                                                                         |
| `asTable`     | boolean  | No       |                                                                                                                                         |
| `isVisible`   | boolean  | No       |                                                                                                                                         |
| `sortBy`      | string   | No       |                                                                                                                                         |
| `sortDesc`    | boolean  | No       |                                                                                                                                         |
| `width`       | number   | No       |                                                                                                                                         |

### OptionsWithTooltip

TODO docs

| Property  | Type                                    | Required | Description |
|-----------|-----------------------------------------|----------|-------------|
| `tooltip` | [VizTooltipOptions](#viztooltipoptions) | **Yes**  | TODO docs   |

### VizTooltipOptions

TODO docs

| Property | Type   | Required | Description                                                   |
|----------|--------|----------|---------------------------------------------------------------|
| `mode`   | string | **Yes**  | TODO docs<br/>Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  | TODO docs<br/>Possible values are: `asc`, `desc`, `none`.     |

### ScatterSeriesConfig

It extends [ScatterFieldConfig](#scatterfieldconfig).

| Property            | Type                                                | Required | Description                                                                                                                                             |
|---------------------|-----------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                                            |
| `axisColorMode`     | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                                            |
| `axisLabel`         | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                                            |
| `axisPlacement`     | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                                            |
| `axisSoftMin`       | number                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                                            |
| `axisWidth`         | number                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                                            |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>TODO docs                                                                              |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                                            |
| `label`             | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `never`, `always`.                          |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>This is actually an empty interface used mainly for naming?                            |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>TODO docs                                                                              |
| `lineWidth`         | integer                                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>Constraint: `>=0 & <=2147483647`.                                                      |
| `name`              | string                                              | No       |                                                                                                                                                         |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>This is actually an empty interface used mainly for naming?                            |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                                            |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>TODO docs                                                                              |
| `show`              | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*<br/>Possible values are: `points`, `lines`, `points+lines`.                                |
| `x`                 | string                                              | No       |                                                                                                                                                         |
| `y`                 | string                                              | No       |                                                                                                                                                         |

### ColorDimensionConfig

This is actually an empty interface used mainly for naming?

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

### BaseDimensionConfig

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

### HideSeriesConfig

TODO docs

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

### LineStyle

TODO docs

| Property | Type     | Required | Description                                            |
|----------|----------|----------|--------------------------------------------------------|
| `dash`   | number[] | No       |                                                        |
| `fill`   | string   | No       | Possible values are: `solid`, `dash`, `dot`, `square`. |

### ScaleDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type    | Required | Description                                                    |
|----------|---------|----------|----------------------------------------------------------------|
| `fixed`  |         | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `max`    | integer | **Yes**  |                                                                |
| `min`    | integer | **Yes**  |                                                                |
| `field`  | string  | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

### ScaleDistributionConfig

TODO docs

| Property          | Type   | Required | Description                                                              |
|-------------------|--------|----------|--------------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs<br/>Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                          |
| `log`             | number | No       |                                                                          |

### ScatterFieldConfig

It extends [HideableFieldConfig](#hideablefieldconfig) and [AxisConfig](#axisconfig).

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
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*<br/>TODO docs                                                            |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       |                                                                                                                                         |
| `label`             | string                                              | No       | TODO docs<br/>Possible values are: `auto`, `never`, `always`.                                                                           |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       | This is actually an empty interface used mainly for naming?                                                                             |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       | TODO docs                                                                                                                               |
| `lineWidth`         | integer                                             | No       | Constraint: `>=0 & <=2147483647`.                                                                                                       |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       | This is actually an empty interface used mainly for naming?                                                                             |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       |                                                                                                                                         |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs                                                                              |
| `show`              | string                                              | No       | Possible values are: `points`, `lines`, `points+lines`.                                                                                 |

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

### HideableFieldConfig

TODO docs

| Property   | Type                                  | Required | Description |
|------------|---------------------------------------|----------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       | TODO docs   |

### TextDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `mode`   | string | **Yes**  | Possible values are: `fixed`, `field`, `template`.             |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

### XYDimensionConfig

| Property  | Type     | Required | Description                       |
|-----------|----------|----------|-----------------------------------|
| `frame`   | integer  | **Yes**  | Constraint: `>=0 & <=2147483647`. |
| `exclude` | string[] | No       |                                   |
| `x`       | string   | No       |                                   |


