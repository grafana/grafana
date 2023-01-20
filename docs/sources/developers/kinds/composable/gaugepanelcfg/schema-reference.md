---
keywords:
  - grafana
  - schema
title: GaugePanelCfg kind
---
> Documentation generation is still in active development and is subject to further improvements.

> Kinds **schema** is also subject to active development, and could change without prior notice.

# GaugePanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

## PanelOptions

### Properties

| Property               | Type    | Required | Description       |
|------------------------|---------|----------|-------------------|
| `showThresholdLabels`  | boolean | No       | Default: `false`. |
| `showThresholdMarkers` | boolean | No       | Default: `true`.  |


