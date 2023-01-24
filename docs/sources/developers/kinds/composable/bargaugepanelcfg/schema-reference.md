---
keywords:
  - grafana
  - schema
title: BarGaugePanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# BarGaugePanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

## PanelOptions

### Properties

| Property       | Type    | Required | Description                                                                                                                               |
|----------------|---------|----------|-------------------------------------------------------------------------------------------------------------------------------------------|
| `displayMode`  | string  | No       | Enum expressing the possible display modes<br/>for the bar gauge component of Grafana UI Possible values are: `basic`, `lcd`, `gradient`. |
| `minVizHeight` | integer | No       | Default: `10`.                                                                                                                            |
| `minVizWidth`  | integer | No       | Default: `0`.                                                                                                                             |
| `showUnfilled` | boolean | No       | Default: `true`.                                                                                                                          |


