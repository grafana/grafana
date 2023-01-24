---
keywords:
  - grafana
  - schema
title: HistogramPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# HistogramPanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property           | Type                        | Required | Description |
|--------------------|-----------------------------|----------|-------------|
| `PanelFieldConfig` | [object](#panelfieldconfig) | **Yes**  |             |
| `PanelOptions`     | [object](#paneloptions)     | **Yes**  |             |

## PanelFieldConfig

### Properties

| Property       | Type    | Required | Description                                                        |
|----------------|---------|----------|--------------------------------------------------------------------|
| `fillOpacity`  | integer | No       | Controls the fill opacity of the bars. Default: `80`.              |
| `gradientMode` | string  | No       | TODO docs Possible values are: `none`, `opacity`, `hue`, `scheme`. |
| `lineWidth`    | integer | No       | Controls line width of the bars. Default: `1`.                     |

## PanelOptions

### Properties

| Property       | Type    | Required | Description                                      |
|----------------|---------|----------|--------------------------------------------------|
| `bucketOffset` | integer | No       | Offset buckets by this amount Default: `0`.      |
| `bucketSize`   | integer | No       | Size of each bucket                              |
| `combine`      | boolean | No       | Combines multiple series into a single histogram |


