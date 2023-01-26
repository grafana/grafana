---
keywords:
  - grafana
  - schema
title: StatusHistoryPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# StatusHistoryPanelCfg kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property           | Type                        | Required | Description |
|--------------------|-----------------------------|----------|-------------|
| `PanelFieldConfig` | [object](#panelfieldconfig) | **Yes**  |             |
| `PanelOptions`     | [object](#paneloptions)     | **Yes**  |             |

## PanelFieldConfig

### Properties

| Property      | Type    | Required | Description    |
|---------------|---------|----------|----------------|
| `fillOpacity` | integer | No       | Default: `70`. |
| `lineWidth`   | integer | No       | Default: `1`.  |

## PanelOptions

### Properties

| Property    | Type   | Required | Description                                               |
|-------------|--------|----------|-----------------------------------------------------------|
| `colWidth`  | number | No       | Controls the column width Default: `0.9`.                 |
| `showValue` | string | No       | TODO docs Possible values are: `auto`, `never`, `always`. |


