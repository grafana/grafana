---
keywords:
  - grafana
  - schema
title: BarChartPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## BarChartPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property           | Type                        | Required | Default | Description |
|--------------------|-----------------------------|----------|---------|-------------|
| `PanelFieldConfig` | [object](#panelfieldconfig) | **Yes**  |         |             |
| `PanelOptions`     | [object](#paneloptions)     | **Yes**  |         |             |

### PanelFieldConfig

It extends [AxisConfig](#axisconfig) and [HideableFieldConfig](#hideablefieldconfig).

| Property            | Type                                                      | Required | Default | Description                                                                                                                             |
|---------------------|-----------------------------------------------------------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `axisCenteredZero`  | boolean                                                   | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisColorMode`     | string                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `text`, `series`.                                   |
| `axisGridShow`      | boolean                                                   | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisLabel`         | string                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisPlacement`     | string                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs<br/>Possible values are: `auto`, `top`, `right`, `bottom`, `left`, `hidden`. |
| `axisSoftMax`       | number                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisSoftMin`       | number                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `axisWidth`         | number                                                    | No       |         | *(Inherited from [AxisConfig](#axisconfig))*                                                                                            |
| `fillOpacity`       | integer                                                   | No       | `80`    | Controls the fill opacity of the bars.<br/>Constraint: `>=0 & <=100`.                                                                   |
| `gradientMode`      | string                                                    | No       |         | TODO docs<br/>Possible values are: `none`, `opacity`, `hue`, `scheme`.                                                                  |
| `hideFrom`          | [HideSeriesConfig](#hideseriesconfig)                     | No       |         | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*<br/>TODO docs                                                            |
| `lineWidth`         | integer                                                   | No       | `1`     | Controls line width of the bars.<br/>Constraint: `>=0 & <=10`.                                                                          |
| `scaleDistribution` | [ScaleDistributionConfig](#scaledistributionconfig)       | No       |         | *(Inherited from [AxisConfig](#axisconfig))*<br/>TODO docs                                                                              |
| `thresholdsStyle`   | [GraphThresholdsStyleConfig](#graphthresholdsstyleconfig) | No       |         | TODO docs                                                                                                                               |

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

### PanelOptions

It extends [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip) and [OptionsWithTextFormatting](#optionswithtextformatting).

| Property              | Type                                            | Required | Default | Description                                                                                                      |
|-----------------------|-------------------------------------------------|----------|---------|------------------------------------------------------------------------------------------------------------------|
| `barWidth`            | number                                          | **Yes**  | `0.97`  | Controls the width of bars. 1 = Max width, 0 = Min width.<br/>Constraint: `>=0 & <=1`.                           |
| `fullHighlight`       | boolean                                         | **Yes**  | `false` | Enables mode which highlights the entire bar area and shows tooltip when cursor<br/>hovers over highlighted area |
| `groupWidth`          | number                                          | **Yes**  | `0.7`   | Controls the width of groups. 1 = max with, 0 = min width.<br/>Constraint: `>=0 & <=1`.                          |
| `legend`              | [VizLegendOptions](#vizlegendoptions)           | **Yes**  |         | *(Inherited from [OptionsWithLegend](#optionswithlegend))*<br/>TODO docs                                         |
| `orientation`         | string                                          | **Yes**  |         | TODO docs<br/>Possible values are: `auto`, `vertical`, `horizontal`.                                             |
| `showValue`           | string                                          | **Yes**  |         | TODO docs<br/>Possible values are: `auto`, `never`, `always`.                                                    |
| `stacking`            | string                                          | **Yes**  |         | TODO docs<br/>Possible values are: `none`, `normal`, `percent`.                                                  |
| `tooltip`             | [VizTooltipOptions](#viztooltipoptions)         | **Yes**  |         | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))*<br/>TODO docs                                       |
| `xTickLabelMaxLength` | integer                                         | **Yes**  |         | Sets the max length that a label can have before it is truncated.<br/>Constraint: `>=0 & <=2147483647`.          |
| `xTickLabelRotation`  | integer                                         | **Yes**  | `0`     | Controls the rotation of the x axis labels.<br/>Constraint: `>=-90 & <=90`.                                      |
| `barRadius`           | number                                          | No       | `0`     | Controls the radius of each bar.<br/>Constraint: `>=0 & <=0.5`.                                                  |
| `colorByField`        | string                                          | No       |         | Use the color value for a sibling field to color each bar value.                                                 |
| `text`                | [VizTextDisplayOptions](#viztextdisplayoptions) | No       |         | *(Inherited from [OptionsWithTextFormatting](#optionswithtextformatting))*<br/>TODO docs                         |
| `xField`              | string                                          | No       |         | Manually select which field from the dataset to represent the x field.                                           |
| `xTickLabelSpacing`   | int32                                           | No       | `0`     | Controls the spacing between x axis labels.<br/>negative values indicate backwards skipping behavior             |

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

### OptionsWithTextFormatting

TODO docs

| Property | Type                                            | Required | Default | Description |
|----------|-------------------------------------------------|----------|---------|-------------|
| `text`   | [VizTextDisplayOptions](#viztextdisplayoptions) | No       |         | TODO docs   |

### VizTextDisplayOptions

TODO docs

| Property    | Type   | Required | Default | Description              |
|-------------|--------|----------|---------|--------------------------|
| `titleSize` | number | No       |         | Explicit title text size |
| `valueSize` | number | No       |         | Explicit value text size |

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


