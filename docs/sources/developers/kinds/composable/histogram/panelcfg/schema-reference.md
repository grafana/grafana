---
keywords:
- grafana
- schema
labels:
  products:
  - enterprise
  - oss
title: HistogramPanelCfg kind
---

> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## HistogramPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)

#### Version: 0.0

| Property      | Type                   | Required | Default | Description |
| ------------- | ---------------------- | -------- | ------- | ----------- |
| `FieldConfig` | [object](#fieldconfig) | **Yes**  |         |             |
| `Options`     | [object](#options)     | **Yes**  |         |             |

### FieldConfig

It extends [AxisConfig](#axisconfig) and [HideableFieldConfig](#hideablefieldconfig).

| Property            | Type                                                | Required | Default | Description                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axisCenteredZero`  | boolean                                             | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                     |
| `axisColorMode`     | string                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_<br/>TODO docs<br/>Possible values are: `text`, `series`.                                                                                                            |
| `axisGridShow`      | boolean                                             | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                     |
| `axisLabel`         | string                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                     |
| `axisPlacement`     | string                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`.                                                                          |
| `axisSoftMax`       | number                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                     |
| `axisSoftMin`       | number                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                     |
| `axisWidth`         | number                                              | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                     |
| `fillOpacity`       | integer                                             | No       | `80`    | Controls the fill opacity of the bars.<br/>Constraint: `>=0 & <=100`.                                                                                                                                            |
| `gradientMode`      | string                                              | No       |         | Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard color scheme field option.<br/>Gradient appearance is influenced by the Fill opacity setting. |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       |         | _(Inherited from [HideableFieldConfig](#hideablefieldconfig))_<br/>TODO docs                                                                                                                                     |
| `lineWidth`         | integer                                             | No       | `1`     | Controls line width of the bars.<br/>Constraint: `>=0 & <=10`.                                                                                                                                                   |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       |         | _(Inherited from [AxisConfig](#axisconfig))_<br/>TODO docs                                                                                                                                                       |

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

### Options

It extends [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip).

| Property       | Type                                    | Required | Default | Description                                                                |
| -------------- | --------------------------------------- | -------- | ------- | -------------------------------------------------------------------------- |
| `legend`       | [VizLegendOptions](#vizlegendoptions)   | **Yes**  |         | _(Inherited from [OptionsWithLegend](#optionswithlegend))_<br/>TODO docs   |
| `tooltip`      | [VizTooltipOptions](#viztooltipoptions) | **Yes**  |         | _(Inherited from [OptionsWithTooltip](#optionswithtooltip))_<br/>TODO docs |
| `bucketOffset` | int32                                   | No       | `0`     | Offset buckets by this amount                                              |
| `bucketSize`   | integer                                 | No       |         | Size of each bucket                                                        |
| `combine`      | boolean                                 | No       |         | Combines multiple series into a single histogram                           |

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
