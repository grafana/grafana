---
keywords:
  - grafana
  - schema
title: NewsPanelCfg kind
---

# NewsPanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

## PanelOptions

### Properties

| Property    | Type    | Required | Description                                |
|-------------|---------|----------|--------------------------------------------|
| `feedUrl`   | string  | No       | empty/missing will default to grafana blog |
| `showImage` | boolean | No       | Default: `true`.                           |


