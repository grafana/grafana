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

| Property              | Type                           | Required | Description                                                                                               |
|-----------------------|--------------------------------|----------|-----------------------------------------------------------------------------------------------------------|
| `PanelOptions`        | [object](#paneloptions)        | **Yes**  | This kind extends: [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip). |
| `ScatterFieldConfig`  | [object](#scatterfieldconfig)  | **Yes**  | This kind extends: [HideableFieldConfig](#hideablefieldconfig) and [AxisConfig](#axisconfig).             |
| `ScatterSeriesConfig` | [object](#scatterseriesconfig) | **Yes**  | This kind extends: [ScatterFieldConfig](#scatterfieldconfig).                                             |
| `ScatterShow`         | string                         | **Yes**  | Possible values are: `points`, `lines`, `points+lines`.                                                   |
| `SeriesMapping`       | string                         | **Yes**  | Possible values are: `auto`, `manual`.                                                                    |
| `XYDimensionConfig`   | [object](#xydimensionconfig)   | **Yes**  |                                                                                                           |

## PanelOptions


This kind extends: [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip).

### Properties

| Property        | Type                                          | Required | Description                                                  |
|-----------------|-----------------------------------------------|----------|--------------------------------------------------------------|
| `dims`          | [XYDimensionConfig](#xydimensionconfig)       | **Yes**  |                                                              |
| `legend`        | [VizLegendOptions](#vizlegendoptions)         | **Yes**  | *(Inherited from [OptionsWithLegend](#optionswithlegend))*   |
| `series`        | [ScatterSeriesConfig](#scatterseriesconfig)[] | **Yes**  |                                                              |
| `tooltip`       | [VizTooltipOptions](#viztooltipoptions)       | **Yes**  | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))* |
| `seriesMapping` | string                                        | No       | Possible values are: `auto`, `manual`.                       |

### OptionsWithLegend

TODO docs

#### Properties

| Property | Type                                  | Required | Description |
|----------|---------------------------------------|----------|-------------|
| `legend` | [VizLegendOptions](#vizlegendoptions) | **Yes**  | TODO docs   |

#### VizLegendOptions

TODO docs

##### Properties

| Property      | Type     | Required | Description                                                                                                                         |
|---------------|----------|----------|-------------------------------------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  |                                                                                                                                     |
| `displayMode` | string   | **Yes**  | TODO docs<br/>Note: "hidden" needs to remain as an option for plugins compatibility Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  | TODO docs Possible values are: `bottom`, `right`.                                                                                   |
| `showLegend`  | boolean  | **Yes**  |                                                                                                                                     |
| `asTable`     | boolean  | No       |                                                                                                                                     |
| `isVisible`   | boolean  | No       |                                                                                                                                     |
| `sortBy`      | string   | No       |                                                                                                                                     |
| `sortDesc`    | boolean  | No       |                                                                                                                                     |
| `width`       | number   | No       |                                                                                                                                     |

### OptionsWithTooltip

TODO docs

#### Properties

| Property  | Type                                    | Required | Description |
|-----------|-----------------------------------------|----------|-------------|
| `tooltip` | [VizTooltipOptions](#viztooltipoptions) | **Yes**  | TODO docs   |

#### VizTooltipOptions

TODO docs

##### Properties

| Property | Type   | Required | Description                                               |
|----------|--------|----------|-----------------------------------------------------------|
| `mode`   | string | **Yes**  | TODO docs Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  | TODO docs Possible values are: `asc`, `desc`, `none`.     |

### ScatterSeriesConfig


This kind extends: [ScatterFieldConfig](#scatterfieldconfig).

#### Properties

| Property            | Type                                                | Required | Description                                                                                                                           |
|---------------------|-----------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisColorMode`     | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))* Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisLabel`         | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisPlacement`     | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))* Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisSoftMin`       | number                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisWidth`         | number                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `label`             | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))* Possible values are: `auto`, `never`, `always`.                          |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `lineWidth`         | integer                                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `name`              | string                                              | No       |                                                                                                                                       |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `show`              | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))* Possible values are: `points`, `lines`, `points+lines`.                  |
| `x`                 | string                                              | No       |                                                                                                                                       |
| `y`                 | string                                              | No       |                                                                                                                                       |

#### ColorDimensionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

##### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

##### BaseDimensionConfig

###### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

#### ColorDimensionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

##### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

##### BaseDimensionConfig

###### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

#### HideSeriesConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

##### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

#### LineStyle

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

##### Properties

| Property | Type     | Required | Description                                            |
|----------|----------|----------|--------------------------------------------------------|
| `dash`   | number[] | No       |                                                        |
| `fill`   | string   | No       | Possible values are: `solid`, `dash`, `dot`, `square`. |

#### ScaleDimensionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

##### Properties

| Property | Type    | Required | Description                                                    |
|----------|---------|----------|----------------------------------------------------------------|
| `fixed`  |         | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `max`    | integer | **Yes**  |                                                                |
| `min`    | integer | **Yes**  |                                                                |
| `field`  | string  | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

##### BaseDimensionConfig

###### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

#### ScaleDistributionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

##### Properties

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

#### ScatterFieldConfig


This kind extends: [HideableFieldConfig](#hideablefieldconfig) and [AxisConfig](#axisconfig).

##### Properties

| Property            | Type                                                | Required | Description                                                                                                                     |
|---------------------|-----------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisColorMode`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))* Possible values are: `text`, `series`.                                             |
| `axisGridShow`      | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisLabel`         | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisPlacement`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))* Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`.           |
| `axisSoftMax`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisSoftMin`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisWidth`         | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*                                                                  |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       | This kind extends: [BaseDimensionConfig](#basedimensionconfig).                                                                 |
| `label`             | string                                              | No       | TODO docs Possible values are: `auto`, `never`, `always`.                                                                       |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       | This is actually an empty interface used mainly for naming?<br/>This kind extends: [BaseDimensionConfig](#basedimensionconfig). |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       | TODO docs                                                                                                                       |
| `lineWidth`         | integer                                             | No       |                                                                                                                                 |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       | This is actually an empty interface used mainly for naming?<br/>This kind extends: [BaseDimensionConfig](#basedimensionconfig). |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       | This kind extends: [BaseDimensionConfig](#basedimensionconfig).                                                                 |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `show`              | string                                              | No       | Possible values are: `points`, `lines`, `points+lines`.                                                                         |

##### AxisConfig

TODO docs

###### Properties

| Property            | Type                                                | Required | Description                                                                        |
|---------------------|-----------------------------------------------------|----------|------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       |                                                                                    |
| `axisColorMode`     | string                                              | No       | TODO docs Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |                                                                                    |
| `axisLabel`         | string                                              | No       |                                                                                    |
| `axisPlacement`     | string                                              | No       | TODO docs Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       |                                                                                    |
| `axisSoftMin`       | number                                              | No       |                                                                                    |
| `axisWidth`         | number                                              | No       |                                                                                    |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | TODO docs                                                                          |

###### ScaleDistributionConfig

TODO docs

**Properties**

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

##### ColorDimensionConfig

This is actually an empty interface used mainly for naming?
This kind extends: [BaseDimensionConfig](#basedimensionconfig).

###### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

###### BaseDimensionConfig

**Properties**

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

##### ColorDimensionConfig

This is actually an empty interface used mainly for naming?
This kind extends: [BaseDimensionConfig](#basedimensionconfig).

###### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

###### BaseDimensionConfig

**Properties**

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

##### HideSeriesConfig

*(Inherited from [HideableFieldConfig](#hideablefieldconfig))*

###### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

##### HideableFieldConfig

TODO docs

###### Properties

| Property   | Type                                  | Required | Description |
|------------|---------------------------------------|----------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       | TODO docs   |

###### HideSeriesConfig

TODO docs

**Properties**

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

##### LineStyle

TODO docs

###### Properties

| Property | Type     | Required | Description                                            |
|----------|----------|----------|--------------------------------------------------------|
| `dash`   | number[] | No       |                                                        |
| `fill`   | string   | No       | Possible values are: `solid`, `dash`, `dot`, `square`. |

##### ScaleDimensionConfig


This kind extends: [BaseDimensionConfig](#basedimensionconfig).

###### Properties

| Property | Type    | Required | Description                                                    |
|----------|---------|----------|----------------------------------------------------------------|
| `fixed`  |         | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `max`    | integer | **Yes**  |                                                                |
| `min`    | integer | **Yes**  |                                                                |
| `field`  | string  | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

###### BaseDimensionConfig

**Properties**

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

##### ScaleDistributionConfig

*(Inherited from [AxisConfig](#axisconfig))*

###### Properties

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

##### TextDimensionConfig


This kind extends: [BaseDimensionConfig](#basedimensionconfig).

###### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `mode`   | string | **Yes**  | Possible values are: `fixed`, `field`, `template`.             |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

###### BaseDimensionConfig

**Properties**

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

#### TextDimensionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

##### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `mode`   | string | **Yes**  | Possible values are: `fixed`, `field`, `template`.             |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

##### BaseDimensionConfig

###### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

### VizLegendOptions

*(Inherited from [OptionsWithLegend](#optionswithlegend))*

#### Properties

| Property      | Type     | Required | Description                                                                                                                         |
|---------------|----------|----------|-------------------------------------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  |                                                                                                                                     |
| `displayMode` | string   | **Yes**  | TODO docs<br/>Note: "hidden" needs to remain as an option for plugins compatibility Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  | TODO docs Possible values are: `bottom`, `right`.                                                                                   |
| `showLegend`  | boolean  | **Yes**  |                                                                                                                                     |
| `asTable`     | boolean  | No       |                                                                                                                                     |
| `isVisible`   | boolean  | No       |                                                                                                                                     |
| `sortBy`      | string   | No       |                                                                                                                                     |
| `sortDesc`    | boolean  | No       |                                                                                                                                     |
| `width`       | number   | No       |                                                                                                                                     |

### VizTooltipOptions

*(Inherited from [OptionsWithTooltip](#optionswithtooltip))*

#### Properties

| Property | Type   | Required | Description                                               |
|----------|--------|----------|-----------------------------------------------------------|
| `mode`   | string | **Yes**  | TODO docs Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  | TODO docs Possible values are: `asc`, `desc`, `none`.     |

### XYDimensionConfig

#### Properties

| Property  | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `frame`   | integer  | **Yes**  |             |
| `exclude` | string[] | No       |             |
| `x`       | string   | No       |             |

## ScatterFieldConfig


This kind extends: [HideableFieldConfig](#hideablefieldconfig) and [AxisConfig](#axisconfig).

### Properties

| Property            | Type                                                | Required | Description                                                                                                                     |
|---------------------|-----------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisColorMode`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))* Possible values are: `text`, `series`.                                             |
| `axisGridShow`      | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisLabel`         | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisPlacement`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))* Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`.           |
| `axisSoftMax`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisSoftMin`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisWidth`         | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*                                                                  |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       | This kind extends: [BaseDimensionConfig](#basedimensionconfig).                                                                 |
| `label`             | string                                              | No       | TODO docs Possible values are: `auto`, `never`, `always`.                                                                       |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       | This is actually an empty interface used mainly for naming?<br/>This kind extends: [BaseDimensionConfig](#basedimensionconfig). |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       | TODO docs                                                                                                                       |
| `lineWidth`         | integer                                             | No       |                                                                                                                                 |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       | This is actually an empty interface used mainly for naming?<br/>This kind extends: [BaseDimensionConfig](#basedimensionconfig). |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       | This kind extends: [BaseDimensionConfig](#basedimensionconfig).                                                                 |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `show`              | string                                              | No       | Possible values are: `points`, `lines`, `points+lines`.                                                                         |

### AxisConfig

TODO docs

#### Properties

| Property            | Type                                                | Required | Description                                                                        |
|---------------------|-----------------------------------------------------|----------|------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       |                                                                                    |
| `axisColorMode`     | string                                              | No       | TODO docs Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |                                                                                    |
| `axisLabel`         | string                                              | No       |                                                                                    |
| `axisPlacement`     | string                                              | No       | TODO docs Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       |                                                                                    |
| `axisSoftMin`       | number                                              | No       |                                                                                    |
| `axisWidth`         | number                                              | No       |                                                                                    |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | TODO docs                                                                          |

#### ScaleDistributionConfig

TODO docs

##### Properties

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

### ColorDimensionConfig

This is actually an empty interface used mainly for naming?
This kind extends: [BaseDimensionConfig](#basedimensionconfig).

#### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

#### BaseDimensionConfig

##### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

### ColorDimensionConfig

This is actually an empty interface used mainly for naming?
This kind extends: [BaseDimensionConfig](#basedimensionconfig).

#### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

#### BaseDimensionConfig

##### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

### HideSeriesConfig

*(Inherited from [HideableFieldConfig](#hideablefieldconfig))*

#### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

### HideableFieldConfig

TODO docs

#### Properties

| Property   | Type                                  | Required | Description |
|------------|---------------------------------------|----------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       | TODO docs   |

#### HideSeriesConfig

TODO docs

##### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

### LineStyle

TODO docs

#### Properties

| Property | Type     | Required | Description                                            |
|----------|----------|----------|--------------------------------------------------------|
| `dash`   | number[] | No       |                                                        |
| `fill`   | string   | No       | Possible values are: `solid`, `dash`, `dot`, `square`. |

### ScaleDimensionConfig


This kind extends: [BaseDimensionConfig](#basedimensionconfig).

#### Properties

| Property | Type    | Required | Description                                                    |
|----------|---------|----------|----------------------------------------------------------------|
| `fixed`  |         | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `max`    | integer | **Yes**  |                                                                |
| `min`    | integer | **Yes**  |                                                                |
| `field`  | string  | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

#### BaseDimensionConfig

##### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

### ScaleDistributionConfig

*(Inherited from [AxisConfig](#axisconfig))*

#### Properties

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

### TextDimensionConfig


This kind extends: [BaseDimensionConfig](#basedimensionconfig).

#### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `mode`   | string | **Yes**  | Possible values are: `fixed`, `field`, `template`.             |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

#### BaseDimensionConfig

##### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

## ScatterSeriesConfig


This kind extends: [ScatterFieldConfig](#scatterfieldconfig).

### Properties

| Property            | Type                                                | Required | Description                                                                                                                           |
|---------------------|-----------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisColorMode`     | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))* Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisLabel`         | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisPlacement`     | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))* Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisSoftMin`       | number                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `axisWidth`         | number                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `label`             | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))* Possible values are: `auto`, `never`, `always`.                          |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `lineWidth`         | integer                                             | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `name`              | string                                              | No       |                                                                                                                                       |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*                                                                          |
| `show`              | string                                              | No       | *(Inherited from [ScatterFieldConfig](#scatterfieldconfig))* Possible values are: `points`, `lines`, `points+lines`.                  |
| `x`                 | string                                              | No       |                                                                                                                                       |
| `y`                 | string                                              | No       |                                                                                                                                       |

### ColorDimensionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

#### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

#### BaseDimensionConfig

##### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

### ColorDimensionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

#### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

#### BaseDimensionConfig

##### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

### HideSeriesConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

#### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

### LineStyle

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

#### Properties

| Property | Type     | Required | Description                                            |
|----------|----------|----------|--------------------------------------------------------|
| `dash`   | number[] | No       |                                                        |
| `fill`   | string   | No       | Possible values are: `solid`, `dash`, `dot`, `square`. |

### ScaleDimensionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

#### Properties

| Property | Type    | Required | Description                                                    |
|----------|---------|----------|----------------------------------------------------------------|
| `fixed`  |         | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `max`    | integer | **Yes**  |                                                                |
| `min`    | integer | **Yes**  |                                                                |
| `field`  | string  | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

#### BaseDimensionConfig

##### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

### ScaleDistributionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

#### Properties

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

### ScatterFieldConfig


This kind extends: [HideableFieldConfig](#hideablefieldconfig) and [AxisConfig](#axisconfig).

#### Properties

| Property            | Type                                                | Required | Description                                                                                                                     |
|---------------------|-----------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisColorMode`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))* Possible values are: `text`, `series`.                                             |
| `axisGridShow`      | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisLabel`         | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisPlacement`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))* Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`.           |
| `axisSoftMax`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisSoftMin`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `axisWidth`         | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*                                                                  |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       | This kind extends: [BaseDimensionConfig](#basedimensionconfig).                                                                 |
| `label`             | string                                              | No       | TODO docs Possible values are: `auto`, `never`, `always`.                                                                       |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       | This is actually an empty interface used mainly for naming?<br/>This kind extends: [BaseDimensionConfig](#basedimensionconfig). |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       | TODO docs                                                                                                                       |
| `lineWidth`         | integer                                             | No       |                                                                                                                                 |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       | This is actually an empty interface used mainly for naming?<br/>This kind extends: [BaseDimensionConfig](#basedimensionconfig). |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       | This kind extends: [BaseDimensionConfig](#basedimensionconfig).                                                                 |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                                    |
| `show`              | string                                              | No       | Possible values are: `points`, `lines`, `points+lines`.                                                                         |

#### AxisConfig

TODO docs

##### Properties

| Property            | Type                                                | Required | Description                                                                        |
|---------------------|-----------------------------------------------------|----------|------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       |                                                                                    |
| `axisColorMode`     | string                                              | No       | TODO docs Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |                                                                                    |
| `axisLabel`         | string                                              | No       |                                                                                    |
| `axisPlacement`     | string                                              | No       | TODO docs Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       |                                                                                    |
| `axisSoftMin`       | number                                              | No       |                                                                                    |
| `axisWidth`         | number                                              | No       |                                                                                    |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | TODO docs                                                                          |

##### ScaleDistributionConfig

TODO docs

###### Properties

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

#### ColorDimensionConfig

This is actually an empty interface used mainly for naming?
This kind extends: [BaseDimensionConfig](#basedimensionconfig).

##### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

##### BaseDimensionConfig

###### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

#### ColorDimensionConfig

This is actually an empty interface used mainly for naming?
This kind extends: [BaseDimensionConfig](#basedimensionconfig).

##### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

##### BaseDimensionConfig

###### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

#### HideSeriesConfig

*(Inherited from [HideableFieldConfig](#hideablefieldconfig))*

##### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

#### HideableFieldConfig

TODO docs

##### Properties

| Property   | Type                                  | Required | Description |
|------------|---------------------------------------|----------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       | TODO docs   |

##### HideSeriesConfig

TODO docs

###### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

#### LineStyle

TODO docs

##### Properties

| Property | Type     | Required | Description                                            |
|----------|----------|----------|--------------------------------------------------------|
| `dash`   | number[] | No       |                                                        |
| `fill`   | string   | No       | Possible values are: `solid`, `dash`, `dot`, `square`. |

#### ScaleDimensionConfig


This kind extends: [BaseDimensionConfig](#basedimensionconfig).

##### Properties

| Property | Type    | Required | Description                                                    |
|----------|---------|----------|----------------------------------------------------------------|
| `fixed`  |         | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `max`    | integer | **Yes**  |                                                                |
| `min`    | integer | **Yes**  |                                                                |
| `field`  | string  | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

##### BaseDimensionConfig

###### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

#### ScaleDistributionConfig

*(Inherited from [AxisConfig](#axisconfig))*

##### Properties

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

#### TextDimensionConfig


This kind extends: [BaseDimensionConfig](#basedimensionconfig).

##### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `mode`   | string | **Yes**  | Possible values are: `fixed`, `field`, `template`.             |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

##### BaseDimensionConfig

###### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

### TextDimensionConfig

*(Inherited from [ScatterFieldConfig](#scatterfieldconfig))*

#### Properties

| Property | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `fixed`  |        | **Yes**  | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |
| `mode`   | string | **Yes**  | Possible values are: `fixed`, `field`, `template`.             |
| `field`  | string | No       | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))* |

#### BaseDimensionConfig

##### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `fixed`  |        | **Yes**  |             |
| `field`  | string | No       |             |

## XYDimensionConfig

### Properties

| Property  | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `frame`   | integer  | **Yes**  |             |
| `exclude` | string[] | No       |             |
| `x`       | string   | No       |             |


