---
keywords:
  - grafana
  - schema
title: BarChartPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# BarChartPanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property           | Type                        | Required | Description |
|--------------------|-----------------------------|----------|-------------|
| `PanelFieldConfig` | [object](#panelfieldconfig) | **Yes**  |             |
| `PanelOptions`     | [object](#paneloptions)     | **Yes**  |             |

## PanelFieldConfig

### Properties

| Property          | Type                                                      | Required | Description                                                        |
|-------------------|-----------------------------------------------------------|----------|--------------------------------------------------------------------|
| `fillOpacity`     | integer                                                   | No       | Controls the fill opacity of the bars. Default: `80`.              |
| `gradientMode`    | string                                                    | No       | TODO docs Possible values are: `none`, `opacity`, `hue`, `scheme`. |
| `lineWidth`       | integer                                                   | No       | Controls line width of the bars. Default: `1`.                     |
| `thresholdsStyle` | [GraphThresholdsStyleConfig](#graphthresholdsstyleconfig) | No       | TODO docs                                                          |

### GraphThresholdsStyleConfig

TODO docs

#### Properties

| Property | Type   | Required | Description                                                                                           |
|----------|--------|----------|-------------------------------------------------------------------------------------------------------|
| `mode`   | string | **Yes**  | TODO docs Possible values are: `off`, `line`, `dashed`, `area`, `line+area`, `dashed+area`, `series`. |

## PanelOptions

### Properties

| Property              | Type    | Required | Description                                                                                                                        |
|-----------------------|---------|----------|------------------------------------------------------------------------------------------------------------------------------------|
| `barRadius`           | number  | No       | Controls the radius of each bar. Default: `0`.                                                                                     |
| `barWidth`            | number  | No       | Controls the width of bars. 1 = Max width, 0 = Min width. Default: `0.97`.                                                         |
| `colorByField`        | string  | No       | Use the color value for a sibling field to color each bar value.                                                                   |
| `fullHighlight`       | boolean | No       | Enables mode which highlights the entire bar area and shows tooltip when cursor<br/>hovers over highlighted area Default: `false`. |
| `groupWidth`          | number  | No       | Controls the width of groups. 1 = max with, 0 = min width. Default: `0.7`.                                                         |
| `orientation`         | string  | No       | TODO docs Possible values are: `auto`, `vertical`, `horizontal`.                                                                   |
| `showValue`           | string  | No       | TODO docs Possible values are: `auto`, `never`, `always`.                                                                          |
| `stacking`            | string  | No       | TODO docs Possible values are: `none`, `normal`, `percent`.                                                                        |
| `xField`              | string  | No       | Manually select which field from the dataset to represent the x field.                                                             |
| `xTickLabelMaxLength` | integer | No       | Sets the max length that a label can have before it is truncated.                                                                  |
| `xTickLabelRotation`  | integer | No       | Controls the rotation of the x axis labels. Default: `0`.                                                                          |
| `xTickLabelSpacing`   | integer | No       | Controls the spacing between x axis labels.<br/>negative values indicate backwards skipping behavior Default: `0`.                 |


