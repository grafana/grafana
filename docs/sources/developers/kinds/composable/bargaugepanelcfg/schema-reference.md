---
keywords:
  - grafana
  - schema
title: BarGaugePanelCfg kind
---
> Documentation generation is still in active development and is subject to further improvements.

> Kinds **schema** is also subject to active development, and could change without prior notice.

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


