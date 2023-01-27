---
keywords:
  - grafana
  - schema
title: NewsPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# NewsPanelCfg kind

## Maturity: experimental
## Version: 0.0

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


