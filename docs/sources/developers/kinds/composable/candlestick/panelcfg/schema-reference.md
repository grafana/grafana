---
keywords:
  - grafana
  - schema
title: CandlestickPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## CandlestickPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property              | Type                                  | Required | Default | Description                                                 |
|-----------------------|---------------------------------------|----------|---------|-------------------------------------------------------------|
| `CandleStyle`         | string                                | **Yes**  |         | Possible values are: `candles`, `ohlcbars`.                 |
| `CandlestickColors`   | [object](#candlestickcolors)          | **Yes**  |         |                                                             |
| `CandlestickFieldMap` | [object](#candlestickfieldmap)        | **Yes**  |         |                                                             |
| `ColorStrategy`       | string                                | **Yes**  |         | Possible values are: `open-close`, `close-close`.           |
| `FieldConfig`         | [GraphFieldConfig](#graphfieldconfig) | **Yes**  |         | TODO docs                                                   |
| `Options`             | [object](#options)                    | **Yes**  |         |                                                             |
| `VizDisplayMode`      | string                                | **Yes**  |         | Possible values are: `candles+volume`, `candles`, `volume`. |

### CandlestickColors

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `down`   | string | **Yes**  | `red`   |             |
| `flat`   | string | **Yes**  | `gray`  |             |
| `up`     | string | **Yes**  | `green` |             |

### CandlestickFieldMap

| Property | Type   | Required | Default | Description                                                                  |
|----------|--------|----------|---------|------------------------------------------------------------------------------|
| `close`  | string | No       |         | Corresponds to the final (end) value of the given period                     |
| `high`   | string | No       |         | Corresponds to the highest value of the given period                         |
| `low`    | string | No       |         | Corresponds to the lowest value of the given period                          |
| `open`   | string | No       |         | Corresponds to the starting value of the given period                        |
| `volume` | string | No       |         | Corresponds to the sample count in the given period. (e.g. number of trades) |

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

It extends [OptionsWithLegend](#optionswithlegend).

| Property           | Type                                    | Required | Default | Description                                                              |
|--------------------|-----------------------------------------|----------|---------|--------------------------------------------------------------------------|
| `candleStyle`      | string                                  | **Yes**  |         | Sets the style of the candlesticks                                       |
| `colorStrategy`    | string                                  | **Yes**  |         | Sets the color strategy for the candlesticks                             |
| `colors`           | [CandlestickColors](#candlestickcolors) | **Yes**  |         |                                                                          |
| `fields`           | [object](#fields)                       | **Yes**  | `map[]` | Map fields to appropriate dimension                                      |
| `legend`           | [VizLegendOptions](#vizlegendoptions)   | **Yes**  |         | *(Inherited from [OptionsWithLegend](#optionswithlegend))*<br/>TODO docs |
| `mode`             | string                                  | **Yes**  |         | Sets which dimensions are used for the visualization                     |
| `includeAllFields` | boolean                                 | No       | `false` | When enabled, all fields will be sent to the graph                       |

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

### Fields

Map fields to appropriate dimension

| Property | Type                              | Required | Default | Description |
|----------|-----------------------------------|----------|---------|-------------|
| `object` | Possible types are: [](#), [](#). |          |         |


