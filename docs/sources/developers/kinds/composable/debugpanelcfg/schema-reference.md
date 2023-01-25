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

| Property            | Type                         | Required | Description                                                               |
|---------------------|------------------------------|----------|---------------------------------------------------------------------------|
| `DebugMode`         | string                       | **Yes**  | Possible values are: `render`, `events`, `cursor`, `State`, `ThrowError`. |
| `DebugPanelOptions` | [object](#debugpaneloptions) | **Yes**  |                                                                           |
| `UpdateConfig`      | [object](#updateconfig)      | **Yes**  |                                                                           |
| `UpdateCounters`    | [object](#updatecounters)    | **Yes**  |                                                                           |

## DebugPanelOptions

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

| Property        | Type   | Required | Description |
|-----------------|--------|----------|-------------|
| `dataChanged`   | number | **Yes**  |             |
| `render`        | number | **Yes**  |             |
| `schemaChanged` | number | **Yes**  |             |


