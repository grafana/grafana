---
keywords:
- grafana
- schema
labels:
  products:
  - enterprise
  - oss
title: TimeSeriesPanelCfg kind
---

> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## TimeSeriesPanelCfg

#### Maturity: [merged](../../../maturity/#merged)

#### Version: 0.0

| Property      | Type                                  | Required | Default | Description |
| ------------- | ------------------------------------- | -------- | ------- | ----------- |
| `FieldConfig` | [GraphFieldConfig](#graphfieldconfig) | **Yes**  |         | TODO docs   |
| `Options`     | [object](#options)                    | **Yes**  |         |             |

### GraphFieldConfig

TODO docs

It extends [LineConfig](#lineconfig) and [FillConfig](#fillconfig) and [PointsConfig](#pointsconfig) and [AxisConfig](#axisconfig) and [BarConfig](#barconfig) and [StackableFieldConfig](#stackablefieldconfig) and [HideableFieldConfig](#hideablefieldconfig).

| Property            | Type                                                      | Required | Default | Description                                                                                                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axisCenteredZero`  | boolean                                                   | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                                                                                 |
| `axisColorMode`     | string                                                    | No       |         | _(Inherited from [AxisConfig](#axisconfig))_<br/>TODO docs<br/>Possible values are: `text`, `series`.                                                                                                                                                                        |
| `axisGridShow`      | boolean                                                   | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                                                                                 |
| `axisLabel`         | string                                                    | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                                                                                 |
| `axisPlacement`     | string                                                    | No       |         | _(Inherited from [AxisConfig](#axisconfig))_<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`.                                                                                                                                      |
| `axisSoftMax`       | number                                                    | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                                                                                 |
| `axisSoftMin`       | number                                                    | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                                                                                 |
| `axisWidth`         | number                                                    | No       |         | _(Inherited from [AxisConfig](#axisconfig))_                                                                                                                                                                                                                                 |
| `barAlignment`      | integer                                                   | No       |         | _(Inherited from [BarConfig](#barconfig))_<br/>TODO docs<br/>Possible values are: `-1`, `0`, `1`.                                                                                                                                                                            |
| `barMaxWidth`       | number                                                    | No       |         | _(Inherited from [BarConfig](#barconfig))_                                                                                                                                                                                                                                   |
| `barWidthFactor`    | number                                                    | No       |         | _(Inherited from [BarConfig](#barconfig))_                                                                                                                                                                                                                                   |
| `drawStyle`         | string                                                    | No       |         | TODO docs<br/>Possible values are: `line`, `bars`, `points`.                                                                                                                                                                                                                 |
| `fillBelowTo`       | string                                                    | No       |         | _(Inherited from [FillConfig](#fillconfig))_                                                                                                                                                                                                                                 |
| `fillColor`         | string                                                    | No       |         | _(Inherited from [FillConfig](#fillconfig))_                                                                                                                                                                                                                                 |
| `fillOpacity`       | number                                                    | No       |         | _(Inherited from [FillConfig](#fillconfig))_                                                                                                                                                                                                                                 |
| `gradientMode`      | string                                                    | No       |         | TODO docs<br/>Possible values are: `none`, `opacity`, `hue`, `scheme`.                                                                                                                                                                                                       |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)                     | No       |         | _(Inherited from [HideableFieldConfig](#hideablefieldconfig))_<br/>TODO docs                                                                                                                                                                                                 |
| `lineColor`         | string                                                    | No       |         | _(Inherited from [LineConfig](#lineconfig))_                                                                                                                                                                                                                                 |
| `lineInterpolation` | string                                                    | No       |         | _(Inherited from [LineConfig](#lineconfig))_<br/>TODO docs<br/>Possible values are: `linear`, `smooth`, `stepBefore`, `stepAfter`.                                                                                                                                           |
| `lineStyle`         | [LineStyle](#linestyle)                                   | No       |         | _(Inherited from [LineConfig](#lineconfig))_<br/>TODO docs                                                                                                                                                                                                                   |
| `lineWidth`         | number                                                    | No       |         | _(Inherited from [LineConfig](#lineconfig))_                                                                                                                                                                                                                                 |
| `pointColor`        | string                                                    | No       |         | _(Inherited from [PointsConfig](#pointsconfig))_                                                                                                                                                                                                                             |
| `pointSize`         | number                                                    | No       |         | _(Inherited from [PointsConfig](#pointsconfig))_                                                                                                                                                                                                                             |
| `pointSymbol`       | string                                                    | No       |         | _(Inherited from [PointsConfig](#pointsconfig))_                                                                                                                                                                                                                             |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig)       | No       |         | _(Inherited from [AxisConfig](#axisconfig))_<br/>TODO docs                                                                                                                                                                                                                   |
| `showPoints`        | string                                                    | No       |         | _(Inherited from [PointsConfig](#pointsconfig))_<br/>TODO docs<br/>Possible values are: `auto`, `never`, `always`.                                                                                                                                                           |
| `spanNulls`         |                                                           | No       |         | _(Inherited from [LineConfig](#lineconfig))_<br/>Indicate if null values should be treated as gaps or connected.<br/>When the value is a number, it represents the maximum delta in the<br/>X axis that should be considered connected. For timeseries, this is milliseconds |
| `stacking`          | [StackingConfig](#stackingconfig)                         | No       |         | _(Inherited from [StackableFieldConfig](#stackablefieldconfig))_<br/>TODO docs                                                                                                                                                                                               |
| `thresholdsStyle`   | [GraphThresholdsStyleConfig](#graphthresholdsstyleconfig) | No       |         | TODO docs                                                                                                                                                                                                                                                                    |
| `transform`         | string                                                    | No       |         | TODO docs<br/>Possible values are: `constant`, `negative-Y`.                                                                                                                                                                                                                 |

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

### BarConfig

TODO docs

| Property         | Type    | Required | Default | Description                                        |
| ---------------- | ------- | -------- | ------- | -------------------------------------------------- |
| `barAlignment`   | integer | No       |         | TODO docs<br/>Possible values are: `-1`, `0`, `1`. |
| `barMaxWidth`    | number  | No       |         |                                                    |
| `barWidthFactor` | number  | No       |         |                                                    |

### FillConfig

TODO docs

| Property      | Type   | Required | Default | Description |
| ------------- | ------ | -------- | ------- | ----------- |
| `fillBelowTo` | string | No       |         |             |
| `fillColor`   | string | No       |         |             |
| `fillOpacity` | number | No       |         |             |

### GraphThresholdsStyleConfig

TODO docs

| Property | Type   | Required | Default | Description                                                                                               |
| -------- | ------ | -------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `mode`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `off`, `line`, `dashed`, `area`, `line+area`, `dashed+area`, `series`. |

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

### LineConfig

TODO docs

| Property            | Type                    | Required | Default | Description                                                                                                                                                                                                                 |
| ------------------- | ----------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lineColor`         | string                  | No       |         |                                                                                                                                                                                                                             |
| `lineInterpolation` | string                  | No       |         | TODO docs<br/>Possible values are: `linear`, `smooth`, `stepBefore`, `stepAfter`.                                                                                                                                           |
| `lineStyle`         | [LineStyle](#linestyle) | No       |         | TODO docs                                                                                                                                                                                                                   |
| `lineWidth`         | number                  | No       |         |                                                                                                                                                                                                                             |
| `spanNulls`         |                         | No       |         | Indicate if null values should be treated as gaps or connected.<br/>When the value is a number, it represents the maximum delta in the<br/>X axis that should be considered connected. For timeseries, this is milliseconds |

### LineStyle

TODO docs

| Property | Type     | Required | Default | Description                                            |
| -------- | -------- | -------- | ------- | ------------------------------------------------------ |
| `dash`   | number[] | No       |         |                                                        |
| `fill`   | string   | No       |         | Possible values are: `solid`, `dash`, `dot`, `square`. |

### PointsConfig

TODO docs

| Property      | Type   | Required | Default | Description                                                   |
| ------------- | ------ | -------- | ------- | ------------------------------------------------------------- |
| `pointColor`  | string | No       |         |                                                               |
| `pointSize`   | number | No       |         |                                                               |
| `pointSymbol` | string | No       |         |                                                               |
| `showPoints`  | string | No       |         | TODO docs<br/>Possible values are: `auto`, `never`, `always`. |

### StackableFieldConfig

TODO docs

| Property   | Type                              | Required | Default | Description |
| ---------- | --------------------------------- | -------- | ------- | ----------- |
| `stacking` | [StackingConfig](#stackingconfig) | No       |         | TODO docs   |

### StackingConfig

TODO docs

| Property | Type   | Required | Default | Description                                                     |
| -------- | ------ | -------- | ------- | --------------------------------------------------------------- |
| `group`  | string | No       |         |                                                                 |
| `mode`   | string | No       |         | TODO docs<br/>Possible values are: `none`, `normal`, `percent`. |

### Options

It extends [OptionsWithTimezones](#optionswithtimezones).

| Property   | Type                                    | Required | Default | Description                                                      |
| ---------- | --------------------------------------- | -------- | ------- | ---------------------------------------------------------------- |
| `legend`   | [VizLegendOptions](#vizlegendoptions)   | **Yes**  |         | TODO docs                                                        |
| `tooltip`  | [VizTooltipOptions](#viztooltipoptions) | **Yes**  |         | TODO docs                                                        |
| `timezone` | string[]                                | No       |         | _(Inherited from [OptionsWithTimezones](#optionswithtimezones))_ |

### OptionsWithTimezones

TODO docs

| Property   | Type     | Required | Default | Description |
| ---------- | -------- | -------- | ------- | ----------- |
| `timezone` | string[] | No       |         |             |

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

### VizTooltipOptions

TODO docs

| Property | Type   | Required | Default | Description                                                   |
| -------- | ------ | -------- | ------- | ------------------------------------------------------------- |
| `mode`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `asc`, `desc`, `none`.     |
