---
keywords:
  - grafana
  - schema
labels:
  products:
    - cloud
    - enterprise
    - oss
title: XYChartPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## XYChartPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property              | Type                           | Required | Default | Description                                             |
|-----------------------|--------------------------------|----------|---------|---------------------------------------------------------|
| `FieldConfig`         | [object](#fieldconfig)         | **Yes**  |         |                                                         |
| `Options`             | [object](#options)             | **Yes**  |         |                                                         |
| `ScatterSeriesConfig` | [object](#scatterseriesconfig) | **Yes**  |         |                                                         |
| `ScatterShow`         | string                         | **Yes**  |         | Possible values are: `points`, `lines`, `points+lines`. |
| `SeriesMapping`       | string                         | **Yes**  |         | Possible values are: `auto`, `manual`.                  |
| `XYDimensionConfig`   | [object](#xydimensionconfig)   | **Yes**  |         |                                                         |

### FieldConfig

It extends [HideableFieldConfig](#hideablefieldconfig) and [AxisConfig](#axisconfig).

| Property            | Type                                                | Required | Default | Description                                                                                                                             |
|---------------------|-----------------------------------------------------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisColorMode`     | string                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisLabel`         | string                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisPlacement`     | string                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisShow`          | boolean                                             | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisSoftMax`       | number                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisSoftMin`       | number                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisWidth`         | number                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       |         | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*<br/>TODO docs                                                            |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       |         |                                                                                                                                         |
| `label`             | string                                              | No       |         | TODO docs<br/>Possible values are: `auto`, `never`, `always`.                                                                           |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       |         |                                                                                                                                         |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       |         | TODO docs                                                                                                                               |
| `lineWidth`         | integer                                             | No       |         | Constraint: `>=0 & <=2147483647`.                                                                                                       |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       |         |                                                                                                                                         |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       |         |                                                                                                                                         |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs                                                                              |
| `show`              | string                                              | No       |         | Possible values are: `points`, `lines`, `points+lines`.                                                                                 |

### AxisConfig

TODO docs

| Property            | Type                                                | Required | Default | Description                                                                            |
|---------------------|-----------------------------------------------------|----------|---------|----------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       |         |                                                                                        |
| `axisColorMode`     | string                                              | No       |         | TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |         |                                                                                        |
| `axisLabel`         | string                                              | No       |         |                                                                                        |
| `axisPlacement`     | string                                              | No       |         | TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisShow`          | boolean                                             | No       |         |                                                                                        |
| `axisSoftMax`       | number                                              | No       |         |                                                                                        |
| `axisSoftMin`       | number                                              | No       |         |                                                                                        |
| `axisWidth`         | number                                              | No       |         |                                                                                        |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       |         | TODO docs                                                                              |

### ScaleDistributionConfig

TODO docs

| Property          | Type   | Required | Default | Description                                                              |
|-------------------|--------|----------|---------|--------------------------------------------------------------------------|
| `type`            | string | **Yes**  |         | TODO docs<br/>Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |         |                                                                          |
| `log`             | number | No       |         |                                                                          |

### ColorDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
|----------|--------|----------|---------|--------------------------------------------------------------------------------------------------------------|
| `field`  | string | No       |         | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))*<br/>fixed: T -- will be added by each element |
| `fixed`  | string | No       |         |                                                                                                              |

### BaseDimensionConfig

| Property | Type   | Required | Default | Description                               |
|----------|--------|----------|---------|-------------------------------------------|
| `field`  | string | No       |         | fixed: T -- will be added by each element |

### HideSeriesConfig

TODO docs

| Property  | Type    | Required | Default | Description |
|-----------|---------|----------|---------|-------------|
| `legend`  | boolean | **Yes**  |         |             |
| `tooltip` | boolean | **Yes**  |         |             |
| `viz`     | boolean | **Yes**  |         |             |

### HideableFieldConfig

TODO docs

| Property   | Type                                  | Required | Default | Description |
|------------|---------------------------------------|----------|---------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       |         | TODO docs   |

### LineStyle

TODO docs

| Property | Type     | Required | Default | Description                                            |
|----------|----------|----------|---------|--------------------------------------------------------|
| `dash`   | number[] | No       |         |                                                        |
| `fill`   | string   | No       |         | Possible values are: `solid`, `dash`, `dot`, `square`. |

### ScaleDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
|----------|--------|----------|---------|--------------------------------------------------------------------------------------------------------------|
| `max`    | number | **Yes**  |         |                                                                                                              |
| `min`    | number | **Yes**  |         |                                                                                                              |
| `field`  | string | No       |         | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))*<br/>fixed: T -- will be added by each element |
| `fixed`  | number | No       |         |                                                                                                              |
| `mode`   | string | No       |         | Possible values are: `linear`, `quad`.                                                                       |

### TextDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
|----------|--------|----------|---------|--------------------------------------------------------------------------------------------------------------|
| `mode`   | string | **Yes**  |         | Possible values are: `fixed`, `field`, `template`.                                                           |
| `field`  | string | No       |         | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))*<br/>fixed: T -- will be added by each element |
| `fixed`  | string | No       |         |                                                                                                              |

### Options

It extends [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip).

| Property        | Type                                          | Required | Default | Description                                                                |
|-----------------|-----------------------------------------------|----------|---------|----------------------------------------------------------------------------|
| `dims`          | [XYDimensionConfig](#xydimensionconfig)       | **Yes**  |         |                                                                            |
| `legend`        | [VizLegendOptions](#vizlegendoptions)         | **Yes**  |         | *(Inherited from [OptionsWithLegend](#optionswithlegend))*<br/>TODO docs   |
| `series`        | [ScatterSeriesConfig](#scatterseriesconfig)[] | **Yes**  |         |                                                                            |
| `tooltip`       | [VizTooltipOptions](#viztooltipoptions)       | **Yes**  |         | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))*<br/>TODO docs |
| `seriesMapping` | string                                        | No       |         | Possible values are: `auto`, `manual`.                                     |

### OptionsWithLegend

TODO docs

| Property | Type                                  | Required | Default | Description |
|----------|---------------------------------------|----------|---------|-------------|
| `legend` | [VizLegendOptions](#vizlegendoptions) | **Yes**  |         | TODO docs   |

### VizLegendOptions

TODO docs

| Property      | Type     | Required | Default | Description                                                                                                                             |
|---------------|----------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  |         |                                                                                                                                         |
| `displayMode` | string   | **Yes**  |         | TODO docs<br/>Note: "hidden" needs to remain as an option for plugins compatibility<br/>Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  |         | TODO docs<br/>Possible values are: `bottom`, `right`.                                                                                   |
| `showLegend`  | boolean  | **Yes**  |         |                                                                                                                                         |
| `asTable`     | boolean  | No       |         |                                                                                                                                         |
| `isVisible`   | boolean  | No       |         |                                                                                                                                         |
| `sortBy`      | string   | No       |         |                                                                                                                                         |
| `sortDesc`    | boolean  | No       |         |                                                                                                                                         |
| `width`       | number   | No       |         |                                                                                                                                         |

### OptionsWithTooltip

TODO docs

| Property  | Type                                    | Required | Default | Description |
|-----------|-----------------------------------------|----------|---------|-------------|
| `tooltip` | [VizTooltipOptions](#viztooltipoptions) | **Yes**  |         | TODO docs   |

### VizTooltipOptions

TODO docs

| Property | Type   | Required | Default | Description                                                   |
|----------|--------|----------|---------|---------------------------------------------------------------|
| `mode`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `asc`, `desc`, `none`.     |

### ScatterSeriesConfig

It extends [FieldConfig](#fieldconfig).

| Property            | Type                                                | Required | Default | Description                                                                                                                               |
|---------------------|-----------------------------------------------------|----------|---------|-------------------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `axisColorMode`     | string                                              | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*<br/>TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `axisLabel`         | string                                              | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `axisPlacement`     | string                                              | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisShow`          | boolean                                             | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `axisSoftMax`       | number                                              | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `axisSoftMin`       | number                                              | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `axisWidth`         | number                                              | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*<br/>TODO docs                                                                              |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `label`             | string                                              | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `never`, `always`.                          |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*<br/>TODO docs                                                                              |
| `lineWidth`         | integer                                             | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*<br/>Constraint: `>=0 & <=2147483647`.                                                      |
| `name`              | string                                              | No       |         |                                                                                                                                           |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*                                                                                            |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*<br/>TODO docs                                                                              |
| `show`              | string                                              | No       |         | *(Inherited from [FieldConfig](#fieldconfig))*<br/>Possible values are: `points`, `lines`, `points+lines`.                                |
| `x`                 | string                                              | No       |         |                                                                                                                                           |
| `y`                 | string                                              | No       |         |                                                                                                                                           |

### XYDimensionConfig

| Property  | Type     | Required | Default | Description                       |
|-----------|----------|----------|---------|-----------------------------------|
| `frame`   | integer  | **Yes**  |         | Constraint: `>=0 & <=2147483647`. |
| `exclude` | string[] | No       |         |                                   |
| `x`       | string   | No       |         |                                   |


