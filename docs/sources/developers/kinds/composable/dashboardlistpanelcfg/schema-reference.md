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



| Property       | Type                    | Required | Default | Description                              |
|----------------|-------------------------|----------|---------|------------------------------------------|
| `PanelLayout`  | string                  | **Yes**  |         | Possible values are: `list`, `previews`. |
| `PanelOptions` | [object](#paneloptions) | **Yes**  |         |                                          |

### PanelOptions

| Property             | Type     | Required | Default | Description                              |
|----------------------|----------|----------|---------|------------------------------------------|
| `maxItems`           | integer  | **Yes**  | `10`    |                                          |
| `query`              | string   | **Yes**  | ``      |                                          |
| `showHeadings`       | boolean  | **Yes**  | `true`  |                                          |
| `showRecentlyViewed` | boolean  | **Yes**  | `false` |                                          |
| `showSearch`         | boolean  | **Yes**  | `false` |                                          |
| `showStarred`        | boolean  | **Yes**  | `true`  |                                          |
| `tags`               | string[] | **Yes**  |         |                                          |
| `folderId`           | integer  | No       |         |                                          |
| `layout`             | string   | No       |         | Possible values are: `list`, `previews`. |


