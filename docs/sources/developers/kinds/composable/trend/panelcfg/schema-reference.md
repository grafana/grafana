---
keywords:
  - grafana
  - schema
title: TrendPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## TrendPanelCfg

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0



| Property      | Type                                  | Required | Default | Description                                                          |
|---------------|---------------------------------------|----------|---------|----------------------------------------------------------------------|
| `FieldConfig` | [GraphFieldConfig](#graphfieldconfig) | **Yes**  |         | TODO docs                                                            |
| `Options`     | [object](#options)                    | **Yes**  |         | Identical to timeseries... except it does not have timezone settings |

### GraphFieldConfig

TODO docs

It extends [LineConfig](#lineconfig) and [FillConfig](#fillconfig) and [PointsConfig](#pointsconfig) and [AxisConfig](#axisconfig) and [BarConfig](#barconfig) and [StackableFieldConfig](#stackablefieldconfig) and [HideableFieldConfig](#hideablefieldconfig).

| Property            | Type                                                      | Required | Default | Description                                                                                                                                                                                                                                                                   |
|---------------------|-----------------------------------------------------------|----------|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                                   | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                                                                                                                                                                  |
| `axisColorMode`     | string                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `text`, `series`.                                                                                                                                                                         |
| `axisGridShow`      | boolean                                                   | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                                                                                                                                                                  |
| `axisLabel`         | string                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                                                                                                                                                                  |
| `axisPlacement`     | string                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`.                                                                                                                                       |
| `axisSoftMax`       | number                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                                                                                                                                                                  |
| `axisSoftMin`       | number                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                                                                                                                                                                  |
| `axisWidth`         | number                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                                                                                                                                                                  |
| `barAlignment`      | integer                                                   | No       |         | *(Inherited from [BarConfig](#barconfig))*<br/>TODO docs<br/>Possible values are: `-1`, `0`, `1`.                                                                                                                                                                             |
| `barMaxWidth`       | number                                                    | No       |         | *(Inherited from [BarConfig](#barconfig))*                                                                                                                                                                                                                                    |
| `barWidthFactor`    | number                                                    | No       |         | *(Inherited from [BarConfig](#barconfig))*                                                                                                                                                                                                                                    |
| `drawStyle`         | string                                                    | No       |         | TODO docs<br/>Possible values are: `line`, `bars`, `points`.                                                                                                                                                                                                                  |
| `fillBelowTo`       | string                                                    | No       |         | *(Inherited from [FillConfig](#fillconfig))*                                                                                                                                                                                                                                  |
| `fillColor`         | string                                                    | No       |         | *(Inherited from [FillConfig](#fillconfig))*                                                                                                                                                                                                                                  |
| `fillOpacity`       | number                                                    | No       |         | *(Inherited from [FillConfig](#fillconfig))*                                                                                                                                                                                                                                  |
| `gradientMode`      | string                                                    | No       |         | TODO docs<br/>Possible values are: `none`, `opacity`, `hue`, `scheme`.                                                                                                                                                                                                        |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)                     | No       |         | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*<br/>TODO docs                                                                                                                                                                                                  |
| `lineColor`         | string                                                    | No       |         | *(Inherited from [LineConfig](#lineconfig))*                                                                                                                                                                                                                                  |
| `lineInterpolation` | string                                                    | No       |         | *(Inherited from [LineConfig](#lineconfig))*<br/>TODO docs<br/>Possible values are: `linear`, `smooth`, `stepBefore`, `stepAfter`.                                                                                                                                            |
| `lineStyle`         | [LineStyle](#linestyle)                                   | No       |         | *(Inherited from [LineConfig](#lineconfig))*<br/>TODO docs                                                                                                                                                                                                                    |
| `lineWidth`         | number                                                    | No       |         | *(Inherited from [LineConfig](#lineconfig))*                                                                                                                                                                                                                                  |
| `pointColor`        | string                                                    | No       |         | *(Inherited from [PointsConfig](#pointsconfig))*                                                                                                                                                                                                                              |
| `pointSize`         | number                                                    | No       |         | *(Inherited from [PointsConfig](#pointsconfig))*                                                                                                                                                                                                                              |
| `pointSymbol`       | string                                                    | No       |         | *(Inherited from [PointsConfig](#pointsconfig))*                                                                                                                                                                                                                              |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig)       | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs                                                                                                                                                                                                                    |
| `showPoints`        | string                                                    | No       |         | *(Inherited from [PointsConfig](#pointsconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `never`, `always`.                                                                                                                                                            |
| `spanNulls`         |                                                           | No       |         | *(Inherited from [LineConfig](#lineconfig))*<br/>Indicate if null values should be treated as gaps or connected.<br/>When the value is a number, it represents the maximum delta in the<br/>X axis that should be considered connected.  For timeseries, this is milliseconds |
| `stacking`          | [StackingConfig](#stackingconfig)                         | No       |         | *(Inherited from [StackableFieldConfig](#stackablefieldconfig))*<br/>TODO docs                                                                                                                                                                                                |
| `thresholdsStyle`   | [GraphThresholdsStyleConfig](#graphthresholdsstyleconfig) | No       |         | TODO docs                                                                                                                                                                                                                                                                     |
| `transform`         | string                                                    | No       |         | TODO docs<br/>Possible values are: `constant`, `negative-Y`.                                                                                                                                                                                                                  |

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

### BarConfig

TODO docs

| Property         | Type    | Required | Default | Description                                        |
|------------------|---------|----------|---------|----------------------------------------------------|
| `barAlignment`   | integer | No       |         | TODO docs<br/>Possible values are: `-1`, `0`, `1`. |
| `barMaxWidth`    | number  | No       |         |                                                    |
| `barWidthFactor` | number  | No       |         |                                                    |

### FillConfig

TODO docs

| Property      | Type   | Required | Default | Description |
|---------------|--------|----------|---------|-------------|
| `fillBelowTo` | string | No       |         |             |
| `fillColor`   | string | No       |         |             |
| `fillOpacity` | number | No       |         |             |

### GraphThresholdsStyleConfig

TODO docs

| Property | Type   | Required | Default | Description                                                                                               |
|----------|--------|----------|---------|-----------------------------------------------------------------------------------------------------------|
| `mode`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `off`, `line`, `dashed`, `area`, `line+area`, `dashed+area`, `series`. |

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

### LineConfig

TODO docs

| Property            | Type                    | Required | Default | Description                                                                                                                                                                                                                  |
|---------------------|-------------------------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lineColor`         | string                  | No       |         |                                                                                                                                                                                                                              |
| `lineInterpolation` | string                  | No       |         | TODO docs<br/>Possible values are: `linear`, `smooth`, `stepBefore`, `stepAfter`.                                                                                                                                            |
| `lineStyle`         | [LineStyle](#linestyle) | No       |         | TODO docs                                                                                                                                                                                                                    |
| `lineWidth`         | number                  | No       |         |                                                                                                                                                                                                                              |
| `spanNulls`         |                         | No       |         | Indicate if null values should be treated as gaps or connected.<br/>When the value is a number, it represents the maximum delta in the<br/>X axis that should be considered connected.  For timeseries, this is milliseconds |

### LineStyle

TODO docs

| Property | Type     | Required | Default | Description                                            |
|----------|----------|----------|---------|--------------------------------------------------------|
| `dash`   | number[] | No       |         |                                                        |
| `fill`   | string   | No       |         | Possible values are: `solid`, `dash`, `dot`, `square`. |

### PointsConfig

TODO docs

| Property      | Type   | Required | Default | Description                                                   |
|---------------|--------|----------|---------|---------------------------------------------------------------|
| `pointColor`  | string | No       |         |                                                               |
| `pointSize`   | number | No       |         |                                                               |
| `pointSymbol` | string | No       |         |                                                               |
| `showPoints`  | string | No       |         | TODO docs<br/>Possible values are: `auto`, `never`, `always`. |

### StackableFieldConfig

TODO docs

| Property   | Type                              | Required | Default | Description |
|------------|-----------------------------------|----------|---------|-------------|
| `stacking` | [StackingConfig](#stackingconfig) | No       |         | TODO docs   |

### StackingConfig

TODO docs

| Property | Type   | Required | Default | Description                                                     |
|----------|--------|----------|---------|-----------------------------------------------------------------|
| `group`  | string | No       |         |                                                                 |
| `mode`   | string | No       |         | TODO docs<br/>Possible values are: `none`, `normal`, `percent`. |

### Options

Identical to timeseries... except it does not have timezone settings

| Property  | Type                                    | Required | Default | Description                                           |
|-----------|-----------------------------------------|----------|---------|-------------------------------------------------------|
| `legend`  | [VizLegendOptions](#vizlegendoptions)   | **Yes**  |         | TODO docs                                             |
| `tooltip` | [VizTooltipOptions](#viztooltipoptions) | **Yes**  |         | TODO docs                                             |
| `xField`  | string                                  | No       |         | Name of the x field to use (defaults to first number) |

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

### VizTooltipOptions

TODO docs

| Property | Type   | Required | Default | Description                                                   |
|----------|--------|----------|---------|---------------------------------------------------------------|
| `mode`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `asc`, `desc`, `none`.     |


