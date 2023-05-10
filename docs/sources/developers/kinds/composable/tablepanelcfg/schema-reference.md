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



| Property  | Type               | Required | Default | Description |
|-----------|--------------------|----------|---------|-------------|
| `Options` | [object](#options) | **Yes**  |         |             |

### Options

| Property        | Type                                              | Required | Default                                      | Description                                                        |
|-----------------|---------------------------------------------------|----------|----------------------------------------------|--------------------------------------------------------------------|
| `frameIndex`    | number                                            | **Yes**  | `0`                                          | Represents the index of the selected frame                         |
| `showHeader`    | boolean                                           | **Yes**  | `true`                                       | Controls whether the panel should show the header                  |
| `cellHeight`    | string                                            | No       |                                              | Controls the height of the rows                                    |
| `footer`        | [object](#footer)                                 | No       | `map[countRows:false reducer:[] show:false]` | Controls footer options                                            |
| `showTypeIcons` | boolean                                           | No       | `false`                                      | Controls whether the header should show icons for the column types |
| `sortBy`        | [TableSortByFieldState](#tablesortbyfieldstate)[] | No       |                                              | Used to control row sorting                                        |

### TableSortByFieldState

Sort by field state

| Property      | Type    | Required | Default | Description                                   |
|---------------|---------|----------|---------|-----------------------------------------------|
| `displayName` | string  | **Yes**  |         | Sets the display name of the field to sort by |
| `desc`        | boolean | No       |         | Flag used to indicate descending sort order   |

### Footer

Controls footer options

| Property | Type                              | Required | Default | Description |
|----------|-----------------------------------|----------|---------|-------------|
| `object` | Possible types are: [](#), [](#). |          |         |


