---
keywords:
  - grafana
  - schema
title: TablePanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# TablePanelCfg kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

## PanelOptions

### Properties

| Property        | Type                                              | Required | Description                                                                                               |
|-----------------|---------------------------------------------------|----------|-----------------------------------------------------------------------------------------------------------|
| `frameIndex`    | number                                            | **Yes**  | Default: `0`.                                                                                             |
| `showHeader`    | boolean                                           | **Yes**  | Default: `true`.                                                                                          |
| `footer`        | [object](#footer)                                 | No       | TODO: should be array (options builder is limited) Default: `map[countRows:false reducer:[] show:false]`. |
| `showTypeIcons` | boolean                                           | No       | Default: `false`.                                                                                         |
| `sortBy`        | [TableSortByFieldState](#tablesortbyfieldstate)[] | No       |                                                                                                           |

### TableSortByFieldState

Sort by field state

#### Properties

| Property      | Type    | Required | Description |
|---------------|---------|----------|-------------|
| `displayName` | string  | **Yes**  |             |
| `desc`        | boolean | No       |             |

### footer

TODO: should be array (options builder is limited)
The default value is: `map[countRows:false reducer:[] show:false]`.
| Property | Type | Required | Description |
|----------|------|----------|-------------|


