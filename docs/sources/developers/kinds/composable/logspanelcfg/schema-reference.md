---
keywords:
  - grafana
  - schema
title: LogsPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## LogsPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

### PanelOptions

| Property             | Type    | Required | Description                                                   |
|----------------------|---------|----------|---------------------------------------------------------------|
| `dedupStrategy`      | string  | **Yes**  | Possible values are: `none`, `exact`, `numbers`, `signature`. |
| `enableLogDetails`   | boolean | **Yes**  |                                                               |
| `prettifyLogMessage` | boolean | **Yes**  |                                                               |
| `showCommonLabels`   | boolean | **Yes**  |                                                               |
| `showLabels`         | boolean | **Yes**  |                                                               |
| `showTime`           | boolean | **Yes**  |                                                               |
| `sortOrder`          | string  | **Yes**  | Possible values are: `Descending`, `Ascending`.               |
| `wrapLogMessage`     | boolean | **Yes**  |                                                               |


