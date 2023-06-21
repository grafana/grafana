---
keywords:
  - grafana
  - schema
title: DashboardListPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## DashboardListPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property  | Type               | Required | Default | Description |
|-----------|--------------------|----------|---------|-------------|
| `Options` | [object](#options) | **Yes**  |         |             |

### Options

| Property             | Type     | Required | Default | Description |
|----------------------|----------|----------|---------|-------------|
| `includeVars`        | boolean  | **Yes**  | `false` |             |
| `keepTime`           | boolean  | **Yes**  | `false` |             |
| `maxItems`           | integer  | **Yes**  | `10`    |             |
| `query`              | string   | **Yes**  | ``      |             |
| `showHeadings`       | boolean  | **Yes**  | `true`  |             |
| `showRecentlyViewed` | boolean  | **Yes**  | `false` |             |
| `showSearch`         | boolean  | **Yes**  | `false` |             |
| `showStarred`        | boolean  | **Yes**  | `true`  |             |
| `tags`               | string[] | **Yes**  |         |             |
| `folderId`           | integer  | No       |         |             |


