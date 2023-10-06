---
keywords:
  - grafana
  - schema
labels:
  products:
    - cloud
    - enterprise
    - oss
title: TablePanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## TablePanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property      | Type                   | Required | Default | Description |
|---------------|------------------------|----------|---------|-------------|
| `FieldConfig` | [object](#fieldconfig) | **Yes**  |         |             |
| `Options`     | [object](#options)     | **Yes**  |         |             |

### FieldConfig

| Property      | Type                                  | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                              |
|---------------|---------------------------------------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `align`       | string                                | **Yes**  |         | TODO -- should not be table specific!<br/>TODO docs<br/>Possible values are: `auto`, `left`, `right`, `center`.                                                                                                                                                                                                                                                                                                                          |
| `cellOptions` | [TableCellOptions](#tablecelloptions) | **Yes**  |         | Table cell options. Each cell has a display mode<br/>and other potential options for that display.                                                                                                                                                                                                                                                                                                                                       |
| `inspect`     | boolean                               | **Yes**  | `false` |                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `displayMode` | string                                | No       |         | Internally, this is the "type" of cell that's being displayed<br/>in the table such as colored text, JSON, gauge, etc.<br/>The color-background-solid, gradient-gauge, and lcd-gauge<br/>modes are deprecated in favor of new cell subOptions<br/>Possible values are: `auto`, `color-text`, `color-background`, `color-background-solid`, `gradient-gauge`, `lcd-gauge`, `json-view`, `basic`, `image`, `gauge`, `sparkline`, `custom`. |
| `filterable`  | boolean                               | No       |         |                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `hidden`      | boolean                               | No       |         |                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `hideHeader`  | boolean                               | No       |         | Hides any header for a column, useful for columns that show some static content or buttons.                                                                                                                                                                                                                                                                                                                                              |
| `minWidth`    | number                                | No       |         |                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `width`       | number                                | No       |         |                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### TableCellOptions

Table cell options. Each cell has a display mode
and other potential options for that display.

| Property | Type                                                                                                                                                                                                                                                                                                                                                                                                                         | Required | Default | Description |
|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|---------|-------------|
| `object` | Possible types are: [TableAutoCellOptions](#tableautocelloptions), [TableSparklineCellOptions](#tablesparklinecelloptions), [TableBarGaugeCellOptions](#tablebargaugecelloptions), [TableColoredBackgroundCellOptions](#tablecoloredbackgroundcelloptions), [TableColorTextCellOptions](#tablecolortextcelloptions), [TableImageCellOptions](#tableimagecelloptions), [TableJsonViewCellOptions](#tablejsonviewcelloptions). |          |         |

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

### LineStyle

TODO docs

| Property | Type     | Required | Default | Description                                            |
|----------|----------|----------|---------|--------------------------------------------------------|
| `dash`   | number[] | No       |         |                                                        |
| `fill`   | string   | No       |         | Possible values are: `solid`, `dash`, `dot`, `square`. |

### ScaleDistributionConfig

TODO docs

| Property          | Type   | Required | Default | Description                                                              |
|-------------------|--------|----------|---------|--------------------------------------------------------------------------|
| `type`            | string | **Yes**  |         | TODO docs<br/>Possible values are: `linear`, `log`, `ordinal`, `symlog`. |
| `linearThreshold` | number | No       |         |                                                                          |
| `log`             | number | No       |         |                                                                          |

### StackingConfig

TODO docs

| Property | Type   | Required | Default | Description                                                     |
|----------|--------|----------|---------|-----------------------------------------------------------------|
| `group`  | string | No       |         |                                                                 |
| `mode`   | string | No       |         | TODO docs<br/>Possible values are: `none`, `normal`, `percent`. |

### TableAutoCellOptions

Auto mode table cell options

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `type`   | string | **Yes**  |         |             |

### TableBarGaugeCellOptions

Gauge cell options

| Property           | Type   | Required | Default | Description                                                                                                                                   |
|--------------------|--------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| `type`             | string | **Yes**  |         |                                                                                                                                               |
| `mode`             | string | No       |         | Enum expressing the possible display modes<br/>for the bar gauge component of Grafana UI<br/>Possible values are: `basic`, `lcd`, `gradient`. |
| `valueDisplayMode` | string | No       |         | Allows for the table cell gauge display type to set the gauge mode.<br/>Possible values are: `color`, `text`, `hidden`.                       |

### TableColorTextCellOptions

Colored text cell options

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `type`   | string | **Yes**  |         |             |

### TableColoredBackgroundCellOptions

Colored background cell options

| Property | Type   | Required | Default | Description                                                                                                                                                                            |
|----------|--------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`   | string | **Yes**  |         |                                                                                                                                                                                        |
| `mode`   | string | No       |         | Display mode to the "Colored Background" display<br/>mode for table cells. Either displays a solid color (basic mode)<br/>or a gradient.<br/>Possible values are: `basic`, `gradient`. |

### TableImageCellOptions

Json view cell options

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `type`   | string | **Yes**  |         |             |

### TableJsonViewCellOptions

Json view cell options

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `type`   | string | **Yes**  |         |             |

### TableSparklineCellOptions

Sparkline cell options

It extends [GraphFieldConfig](#graphfieldconfig).

| Property            | Type                                                      | Required | Default | Description                                                                                                                                                                                                                                                                               |
|---------------------|-----------------------------------------------------------|----------|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`              | string                                                    | **Yes**  |         |                                                                                                                                                                                                                                                                                           |
| `axisBorderShow`    | boolean                                                   | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `axisCenteredZero`  | boolean                                                   | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `axisColorMode`     | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs<br/>Possible values are: `text`, `series`.                                                                                                                                                                         |
| `axisGridShow`      | boolean                                                   | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `axisLabel`         | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `axisPlacement`     | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`.                                                                                                                                       |
| `axisSoftMax`       | number                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `axisSoftMin`       | number                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `axisWidth`         | number                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `barAlignment`      | integer                                                   | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs<br/>Possible values are: `-1`, `0`, `1`.                                                                                                                                                                           |
| `barMaxWidth`       | number                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `barWidthFactor`    | number                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `drawStyle`         | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs<br/>Possible values are: `line`, `bars`, `points`.                                                                                                                                                                 |
| `fillBelowTo`       | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `fillColor`         | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `fillOpacity`       | number                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `gradientMode`      | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs<br/>Possible values are: `none`, `opacity`, `hue`, `scheme`.                                                                                                                                                       |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)                     | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs                                                                                                                                                                                                                    |
| `lineColor`         | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `lineInterpolation` | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs<br/>Possible values are: `linear`, `smooth`, `stepBefore`, `stepAfter`.                                                                                                                                            |
| `lineStyle`         | [LineStyle](#linestyle)                                   | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs                                                                                                                                                                                                                    |
| `lineWidth`         | number                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `pointColor`        | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `pointSize`         | number                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `pointSymbol`       | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*                                                                                                                                                                                                                                  |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig)       | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs                                                                                                                                                                                                                    |
| `showPoints`        | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `never`, `always`.                                                                                                                                                                |
| `spanNulls`         |                                                           | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>Indicate if null values should be treated as gaps or connected.<br/>When the value is a number, it represents the maximum delta in the<br/>X axis that should be considered connected.  For timeseries, this is milliseconds |
| `stacking`          | [StackingConfig](#stackingconfig)                         | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs                                                                                                                                                                                                                    |
| `thresholdsStyle`   | [GraphThresholdsStyleConfig](#graphthresholdsstyleconfig) | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs                                                                                                                                                                                                                    |
| `transform`         | string                                                    | No       |         | *(Inherited from [GraphFieldConfig](#graphfieldconfig))*<br/>TODO docs<br/>Possible values are: `constant`, `negative-Y`.                                                                                                                                                                 |

### GraphFieldConfig

TODO docs

It extends [LineConfig](#lineconfig) and [FillConfig](#fillconfig) and [PointsConfig](#pointsconfig) and [AxisConfig](#axisconfig) and [BarConfig](#barconfig) and [StackableFieldConfig](#stackablefieldconfig) and [HideableFieldConfig](#hideablefieldconfig).

| Property            | Type                                                      | Required | Default | Description                                                                                                                                                                                                                                                                   |
|---------------------|-----------------------------------------------------------|----------|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `axisBorderShow`    | boolean                                                   | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                                                                                                                                                                  |
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
| `axisBorderShow`    | boolean                                             | No       |         |                                                                                        |
| `axisCenteredZero`  | boolean                                             | No       |         |                                                                                        |
| `axisColorMode`     | string                                              | No       |         | TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                             | No       |         |                                                                                        |
| `axisLabel`         | string                                              | No       |         |                                                                                        |
| `axisPlacement`     | string                                              | No       |         | TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                              | No       |         |                                                                                        |
| `axisSoftMin`       | number                                              | No       |         |                                                                                        |
| `axisWidth`         | number                                              | No       |         |                                                                                        |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig) | No       |         | TODO docs                                                                              |

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

### Options

| Property        | Type                                              | Required | Default                                      | Description                                                        |
|-----------------|---------------------------------------------------|----------|----------------------------------------------|--------------------------------------------------------------------|
| `frameIndex`    | number                                            | **Yes**  | `0`                                          | Represents the index of the selected frame                         |
| `showHeader`    | boolean                                           | **Yes**  | `true`                                       | Controls whether the panel should show the header                  |
| `cellHeight`    | string                                            | No       |                                              | Controls the height of the rows                                    |
| `footer`        | [object](#footer)                                 | No       | `map[countRows:false reducer:[] show:false]` | Controls footer options                                            |
| `showTypeIcons` | boolean                                           | No       | `false`                                      | Controls whether the header should show icons for the column types |
| `sortBy`        | [TableSortByFieldState](#tablesortbyfieldstate)[] | No       |                                              | Used to control row sorting                                        |

### TableSortByFieldState

Sort by field state

| Property      | Type    | Required | Default | Description                                   |
|---------------|---------|----------|---------|-----------------------------------------------|
| `displayName` | string  | **Yes**  |         | Sets the display name of the field to sort by |
| `desc`        | boolean | No       |         | Flag used to indicate descending sort order   |

### Footer

Controls footer options

| Property | Type                              | Required | Default | Description |
|----------|-----------------------------------|----------|---------|-------------|
| `object` | Possible types are: [](#), [](#). |          |         |


