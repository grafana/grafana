---
keywords:
- grafana
- schema
labels:
  products:
  - enterprise
  - oss
title: XYChartPanelCfg kind
---

> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## XYChartPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)

#### Version: 0.0

| Property              | Type                           | Required | Default | Description                                             |
| --------------------- | ------------------------------ | -------- | ------- | ------------------------------------------------------- |
| `FieldConfig`         | [object](#fieldconfig)         | **Yes**  |         |                                                         |
| `Options`             | [object](#options)             | **Yes**  |         |                                                         |
| `ScatterSeriesConfig` | [object](#scatterseriesconfig) | **Yes**  |         |                                                         |
| `ScatterShow`         | string                         | **Yes**  |         | Possible values are: `points`, `lines`, `points+lines`. |
| `SeriesMapping`       | string                         | **Yes**  |         | Possible values are: `auto`, `manual`.                  |
| `XYDimensionConfig`   | [object](#xydimensionconfig)   | **Yes**  |         |                                                         |

### FieldConfig

It extends [HideableFieldConfig](#hideablefieldconfig) and [AxisConfig](#axisconfig).

| Property            | Type                                                | Required | Default | Description                                                                                                                             |
| ------------------- | --------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `axisCenteredZero`  | boolean                                             | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                            |
| `axisColorMode`     | string                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_<br/>TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                            |
| `axisLabel`         | string                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                            |
| `axisPlacement`     | string                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                            |
| `axisSoftMin`       | number                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                            |
| `axisWidth`         | number                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                            |
| `fillOpacity`       | number                                              | No       | `0.5`   | Constraint: `>=0 & <=1`.                                                                                                                |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       |         | _(Inherited from [HideableFieldConfig](#hideablefieldconfig))_<br/>TODO docs                                                            |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       |         |                                                                                                                                         |
| `label`             | string                                              | No       |         | TODO docs<br/>Possible values are: `auto`, `never`, `always`.                                                                           |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       |         |                                                                                                                                         |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       |         | TODO docs                                                                                                                               |
| `lineWidth`         | integer                                             | No       |         | Constraint: `>=0 & <=2147483647`.                                                                                                       |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       |         |                                                                                                                                         |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       |         |                                                                                                                                         |
| `pointSymbol`       | [ResourceDimensionConfig](#resourcedimensionconfig) | No       |         | Links to a resource (image/svg path)                                                                                                    |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       |         | _(Inherited from [AxisConfig](#axisconfig))_<br/>TODO docs                                                                              |
| `show`              | string                                              | No       |         | Possible values are: `points`, `lines`, `points+lines`.                                                                                 |

### AxisConfig

TODO docs

| Property            | Type                                                | Required | Default | Description                                                                            |
| ------------------- | --------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------- |
| `axisCenteredZero`  | boolean                                             | No       |         |                                                                                        |
| `axisColorMode`     | string                                              | No       |         | TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |         |                                                                                        |
| `axisLabel`         | string                                              | No       |         |                                                                                        |
| `axisPlacement`     | string                                              | No       |         | TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       |         |                                                                                        |
| `axisSoftMin`       | number                                              | No       |         |                                                                                        |
| `axisWidth`         | number                                              | No       |         |                                                                                        |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       |         | TODO docs                                                                              |

### ScaleDistributionConfig

TODO docs

| Property          | Type   | Required | Default | Description                                                              |
| ----------------- | ------ | -------- | ------- | ------------------------------------------------------------------------ |
| `type`            | string | **Yes**  |         | TODO docs<br/>Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |         |                                                                          |
| `log`             | number | No       |         |                                                                          |

### ColorDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
| -------- | ------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `field`  | string | No       |         | _(Inherited from [BaseDimensionConfig](#basedimensionconfig))_<br/>fixed: T -- will be added by each element |
| `fixed`  | string | No       |         |                                                                                                              |

### BaseDimensionConfig

| Property | Type   | Required | Default | Description                               |
| -------- | ------ | -------- | ------- | ----------------------------------------- |
| `field`  | string | No       |         | fixed: T -- will be added by each element |

### HideSeriesConfig

TODO docs

| Property  | Type    | Required | Default | Description |
| --------- | ------- | -------- | ------- | ----------- |
| `legend`  | boolean | **Yes**  |         |             |
| `tooltip` | boolean | **Yes**  |         |             |
| `viz`     | boolean | **Yes**  |         |             |

### HideableFieldConfig

TODO docs

| Property   | Type                                  | Required | Default | Description |
| ---------- | ------------------------------------- | -------- | ------- | ----------- |
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       |         | TODO docs   |

### LineStyle

TODO docs

| Property | Type     | Required | Default | Description                                            |
| -------- | -------- | -------- | ------- | ------------------------------------------------------ |
| `dash`   | number[] | No       |         |                                                        |
| `fill`   | string   | No       |         | Possible values are: `solid`, `dash`, `dot`, `square`. |

### ResourceDimensionConfig

Links to a resource (image/svg path)

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
| -------- | ------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `mode`   | string | **Yes**  |         | Possible values are: `fixed`, `field`, `mapping`.                                                            |
| `field`  | string | No       |         | _(Inherited from [BaseDimensionConfig](#basedimensionconfig))_<br/>fixed: T -- will be added by each element |
| `fixed`  | string | No       |         |                                                                                                              |

### ScaleDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
| -------- | ------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `max`    | number | **Yes**  |         |                                                                                                              |
| `min`    | number | **Yes**  |         |                                                                                                              |
| `field`  | string | No       |         | _(Inherited from [BaseDimensionConfig](#basedimensionconfig))_<br/>fixed: T -- will be added by each element |
| `fixed`  | number | No       |         |                                                                                                              |
| `mode`   | string | No       |         | Possible values are: `linear`, `quad`.                                                                       |

### TextDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
| -------- | ------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `mode`   | string | **Yes**  |         | Possible values are: `fixed`, `field`, `template`.                                                           |
| `field`  | string | No       |         | _(Inherited from [BaseDimensionConfig](#basedimensionconfig))_<br/>fixed: T -- will be added by each element |
| `fixed`  | string | No       |         |                                                                                                              |

### Options

It extends [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip).

| Property        | Type                                          | Required | Default | Description                                                                |
| --------------- | --------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------- |
| `dims`          | [XYDimensionConfig](#xydimensionconfig)       | **Yes**  |         |                                                                            |
| `legend`        | [VizLegendOptions](#vizlegendoptions)         | **Yes**  |         | _(Inherited from [OptionsWithLegend](#optionswithlegend))_<br/>TODO docs   |
| `series`        | [ScatterSeriesConfig](#scatterseriesconfig)[] | **Yes**  |         |                                                                            |
| `tooltip`       | [VizTooltipOptions](#viztooltipoptions)       | **Yes**  |         | _(Inherited from [OptionsWithTooltip](#optionswithtooltip))_<br/>TODO docs |
| `seriesMapping` | string                                        | No       |         | Possible values are: `auto`, `manual`.                                     |

### OptionsWithLegend

TODO docs

| Property | Type                                  | Required | Default | Description |
| -------- | ------------------------------------- | -------- | ------- | ----------- |
| `legend` | [VizLegendOptions](#vizlegendoptions) | **Yes**  |         | TODO docs   |

### VizLegendOptions

TODO docs

| Property      | Type     | Required | Default | Description                                                                                                                             |
| ------------- | -------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
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
| --------- | --------------------------------------- | -------- | ------- | ----------- |
| `tooltip` | [VizTooltipOptions](#viztooltipoptions) | **Yes**  |         | TODO docs   |

### VizTooltipOptions

TODO docs

| Property | Type   | Required | Default | Description                                                   |
| -------- | ------ | -------- | ------- | ------------------------------------------------------------- |
| `mode`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `asc`, `desc`, `none`.     |

### ScatterSeriesConfig

It extends [FieldConfig](#fieldconfig).

| Property            | Type                                                | Required | Default | Description                                                                                                                               |
| ------------------- | --------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `axisCenteredZero`  | boolean                                             | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `axisColorMode`     | string                                              | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_<br/>TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `axisLabel`         | string                                              | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `axisPlacement`     | string                                              | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `axisSoftMin`       | number                                              | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `axisWidth`         | number                                              | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `fillOpacity`       | number                                              | No       | `0.5`   | _(Inherited from [FieldConfig](#fieldconfig))_<br/>Constraint: `>=0 & <=1`.                                                               |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_<br/>TODO docs                                                                              |
| `labelValue`        | [TextDimensionConfig](#textdimensionconfig)         | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `label`             | string                                              | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_<br/>TODO docs<br/>Possible values are: `auto`, `never`, `always`.                          |
| `lineColor`         | [ColorDimensionConfig](#colordimensionconfig)       | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `lineStyle`         | [LineStyle](#linestyle)                             | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_<br/>TODO docs                                                                              |
| `lineWidth`         | integer                                             | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_<br/>Constraint: `>=0 & <=2147483647`.                                                      |
| `name`              | string                                              | No       |         |                                                                                                                                           |
| `pointColor`        | [ColorDimensionConfig](#colordimensionconfig)       | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `pointSize`         | [ScaleDimensionConfig](#scaledimensionconfig)       | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_                                                                                            |
| `pointSymbol`       | [ResourceDimensionConfig](#resourcedimensionconfig) | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_<br/>Links to a resource (image/svg path)                                                   |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_<br/>TODO docs                                                                              |
| `show`              | string                                              | No       |         | _(Inherited from [FieldConfig](#fieldconfig))_<br/>Possible values are: `points`, `lines`, `points+lines`.                                |
| `x`                 | string                                              | No       |         |                                                                                                                                           |
| `y`                 | string                                              | No       |         |                                                                                                                                           |

### XYDimensionConfig

| Property  | Type     | Required | Default | Description                       |
| --------- | -------- | -------- | ------- | --------------------------------- |
| `frame`   | integer  | **Yes**  |         | Constraint: `>=0 & <=2147483647`. |
| `exclude` | string[] | No       |         |                                   |
| `x`       | string   | No       |         |                                   |
