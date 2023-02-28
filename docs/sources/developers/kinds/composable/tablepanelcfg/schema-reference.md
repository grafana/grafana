---
keywords:
  - grafana
  - schema
title: TablePanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## TablePanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

### PanelOptions

| Property        | Type                                              | Required | Description                                                                    |
|-----------------|---------------------------------------------------|----------|--------------------------------------------------------------------------------|
| `frameIndex`    | number                                            | **Yes**  | Default: `0`.                                                                  |
| `showHeader`    | boolean                                           | **Yes**  | Controls whether the panel should show the header Default: `true`.             |
| `footer`        | [object](#footer)                                 | No       | Controls footer options Default: `map[countRows:false reducer:[] show:false]`. |
| `showRowNums`   | boolean                                           | No       | Controls whether the columns should be numbered Default: `false`.              |
| `showTypeIcons` | boolean                                           | No       | Default: `false`.                                                              |
| `sortBy`        | [TableSortByFieldState](#tablesortbyfieldstate)[] | No       |                                                                                |

### TableSortByFieldState

Sort by field state

| Property      | Type    | Required | Description |
|---------------|---------|----------|-------------|
| `displayName` | string  | **Yes**  |             |
| `desc`        | boolean | No       |             |

### Footer

Controls footer options

| Property | Type | Required | Description |
|----------|------|----------|-------------|


