---
keywords:
  - grafana
  - schema
title: HistogramPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## HistogramPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property           | Type                        | Required | Default | Description |
|--------------------|-----------------------------|----------|---------|-------------|
| `PanelFieldConfig` | [object](#panelfieldconfig) | **Yes**  |         |             |
| `PanelOptions`     | [object](#paneloptions)     | **Yes**  |         |             |

### PanelFieldConfig

It extends [AxisConfig](#axisconfig) and [HideableFieldConfig](#hideablefieldconfig).

| Property            | Type                                                | Required | Default | Description                                                                                                                             |
|---------------------|-----------------------------------------------------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                             | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisColorMode`     | string                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisLabel`         | string                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisPlacement`     | string                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisSoftMin`       | number                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisWidth`         | number                                              | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `fillOpacity`       | integer                                             | No       | `80`    | Controls the fill opacity of the bars.<br/>Constraint: `>=0 & <=100`.                                                                   |
| `gradientMode`      | string                                              | No       |         | TODO docs<br/>Possible values are: `none`, `opacity`, `hue`, `scheme`.                                                                  |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)               | No       |         | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*<br/>TODO docs                                                            |
| `lineWidth`         | integer                                             | No       | `1`     | Controls line width of the bars.<br/>Constraint: `>=0 & <=10`.                                                                          |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs                                                                              |

### AxisConfig

TODO docs

| Property            | Type                                                | Required | Default | Description                                                                            |
|---------------------|-----------------------------------------------------|----------|---------|----------------------------------------------------------------------------------------|
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
|-------------------|--------|----------|---------|--------------------------------------------------------------------------|
| `type`            | string | **Yes**  |         | TODO docs<br/>Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |         |                                                                          |
| `log`             | number | No       |         |                                                                          |

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

### PanelOptions

It extends [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip).

| Property       | Type                                    | Required | Default | Description                                                                |
|----------------|-----------------------------------------|----------|---------|----------------------------------------------------------------------------|
| `legend`       | [VizLegendOptions](#vizlegendoptions)   | **Yes**  |         | *(Inherited from [OptionsWithLegend](#optionswithlegend))*<br/>TODO docs   |
| `tooltip`      | [VizTooltipOptions](#viztooltipoptions) | **Yes**  |         | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))*<br/>TODO docs |
| `bucketOffset` | int32                                   | No       | `0`     | Offset buckets by this amount                                              |
| `bucketSize`   | integer                                 | No       |         | Size of each bucket                                                        |
| `combine`      | boolean                                 | No       |         | Combines multiple series into a single histogram                           |

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


