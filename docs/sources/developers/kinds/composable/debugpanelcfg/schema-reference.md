---
keywords:
  - grafana
  - schema
title: DebugPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## DebugPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property       | Type                    | Required | Description                                                               |
|----------------|-------------------------|----------|---------------------------------------------------------------------------|
| `DebugMode`    | string                  | **Yes**  | Possible values are: `render`, `events`, `cursor`, `State`, `ThrowError`. |
| `PanelOptions` | [object](#paneloptions) | **Yes**  |                                                                           |
| `UpdateConfig` | [object](#updateconfig) | **Yes**  |                                                                           |

### PanelOptions

| Property   | Type                          | Required | Description                                                               |
|------------|-------------------------------|----------|---------------------------------------------------------------------------|
| `mode`     | string                        | **Yes**  | Possible values are: `render`, `events`, `cursor`, `State`, `ThrowError`. |
| `counters` | [UpdateConfig](#updateconfig) | No       |                                                                           |

### UpdateConfig

| Property        | Type    | Required | Description |
|-----------------|---------|----------|-------------|
| `dataChanged`   | boolean | **Yes**  |             |
| `render`        | boolean | **Yes**  |             |
| `schemaChanged` | boolean | **Yes**  |             |


