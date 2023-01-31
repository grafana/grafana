---
keywords:
  - grafana
  - schema
title: HistogramPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# HistogramPanelCfg kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property           | Type                        | Required | Description                                                                                               |
|--------------------|-----------------------------|----------|-----------------------------------------------------------------------------------------------------------|
| `PanelFieldConfig` | [object](#panelfieldconfig) | **Yes**  | This kind extends: [AxisConfig](#axisconfig) and [HideableFieldConfig](#hideablefieldconfig).             |
| `PanelOptions`     | [object](#paneloptions)     | **Yes**  | This kind extends: [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip). |

## PanelFieldConfig


This kind extends: [AxisConfig](#axisconfig) and [HideableFieldConfig](#hideablefieldconfig).

### Properties

| Property            | Type                                                | Required | Description                                                                                                           |
|---------------------|-----------------------------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                          |
| `axisColorMode`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))* Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                          |
| `axisLabel`         | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                          |
| `axisPlacement`     | string                                              | No       | *(Inherited from [AxisConfig](#axisconfig))* Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                          |
| `axisSoftMin`       | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                          |
| `axisWidth`         | number                                              | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                          |
| `fillOpacity`       | integer                                             | No       | Controls the fill opacity of the bars. Default: `80`.                                                                 |
| `gradientMode`      | string                                              | No       | TODO docs Possible values are: `none`, `opacity`, `hue`, `scheme`.                                                    |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*                                                        |
| `lineWidth`         | integer                                             | No       | Controls line width of the bars. Default: `1`.                                                                        |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       | *(Inherited from [AxisConfig](#axisconfig))*                                                                          |

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

### ScaleDistributionConfig

*(Inherited from [AxisConfig](#axisconfig))*

#### Properties

| Property          | Type   | Required | Description                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `type`            | string | **Yes**  | TODO docs Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |                                                                      |
| `log`             | number | No       |                                                                      |

## PanelOptions


This kind extends: [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip).

### Properties

| Property       | Type                                    | Required | Description                                                  |
|----------------|-----------------------------------------|----------|--------------------------------------------------------------|
| `legend`       | [VizLegendOptions](#vizlegendoptions)   | **Yes**  | *(Inherited from [OptionsWithLegend](#optionswithlegend))*   |
| `tooltip`      | [VizTooltipOptions](#viztooltipoptions) | **Yes**  | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))* |
| `bucketOffset` | integer                                 | No       | Offset buckets by this amount Default: `0`.                  |
| `bucketSize`   | integer                                 | No       | Size of each bucket                                          |
| `combine`      | boolean                                 | No       | Combines multiple series into a single histogram             |

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


