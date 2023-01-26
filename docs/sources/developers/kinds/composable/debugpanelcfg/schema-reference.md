---
keywords:
  - grafana
  - schema
title: DebugPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# DebugPanelCfg kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property         | Type                      | Required | Description                                                               |
|------------------|---------------------------|----------|---------------------------------------------------------------------------|
| `DebugMode`      | string                    | **Yes**  | Possible values are: `render`, `events`, `cursor`, `State`, `ThrowError`. |
| `PanelOptions`   | [object](#paneloptions)   | **Yes**  |                                                                           |
| `UpdateConfig`   | [object](#updateconfig)   | **Yes**  |                                                                           |
| `UpdateCounters` | [object](#updatecounters) | **Yes**  |                                                                           |

## PanelOptions

### Properties

| Property   | Type                          | Required | Description                                                               |
|------------|-------------------------------|----------|---------------------------------------------------------------------------|
| `mode`     | string                        | **Yes**  | Possible values are: `render`, `events`, `cursor`, `State`, `ThrowError`. |
| `counters` | [UpdateConfig](#updateconfig) | No       |                                                                           |

### UpdateConfig

#### Properties

| Property        | Type    | Required | Description |
|-----------------|---------|----------|-------------|
| `dataChanged`   | boolean | **Yes**  |             |
| `render`        | boolean | **Yes**  |             |
| `schemaChanged` | boolean | **Yes**  |             |

## UpdateConfig

### Properties

| Property        | Type    | Required | Description |
|-----------------|---------|----------|-------------|
| `dataChanged`   | boolean | **Yes**  |             |
| `render`        | boolean | **Yes**  |             |
| `schemaChanged` | boolean | **Yes**  |             |

## UpdateCounters

### Properties

| Property        | Type    | Required | Description |
|-----------------|---------|----------|-------------|
| `dataChanged`   | integer | **Yes**  |             |
| `render`        | integer | **Yes**  |             |
| `schemaChanged` | integer | **Yes**  |             |


