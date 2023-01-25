---
keywords:
  - grafana
  - schema
title: StateTimelinePanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# StateTimelinePanelCfg kind

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
| `lineWidth`   | integer | No       | Default: `0`.  |

## PanelOptions

### Properties

| Property      | Type    | Required | Description                                                                                                 |
|---------------|---------|----------|-------------------------------------------------------------------------------------------------------------|
| `alignValue`  | string  | No       | Controls the value alignment in the TimelineChart component Possible values are: `center`, `left`, `right`. |
| `mergeValues` | boolean | No       | Merge equal consecutive values Default: `true`.                                                             |
| `rowHeight`   | number  | No       | Controls the row height Default: `0.9`.                                                                     |
| `showValue`   | string  | No       | TODO docs Possible values are: `auto`, `never`, `always`.                                                   |


