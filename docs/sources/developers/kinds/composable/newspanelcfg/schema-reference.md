---
keywords:
  - grafana
  - schema
title: NewsPanelCfg kind
---
> Documentation generation is still in active development and is subject to further improvements.

> Kinds **schema** is also subject to active development, and could change without prior notice.

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


