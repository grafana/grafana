---
keywords:
  - grafana
  - schema
title: NewsPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## NewsPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

### PanelOptions

| Property    | Type    | Required | Description                                |
|-------------|---------|----------|--------------------------------------------|
| `feedUrl`   | string  | No       | empty/missing will default to grafana blog |
| `showImage` | boolean | No       | Default: `true`.                           |


