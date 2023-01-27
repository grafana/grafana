---
keywords:
  - grafana
  - schema
title: GaugePanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# GaugePanelCfg kind

## Maturity: experimental
## Version: 0.0

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


