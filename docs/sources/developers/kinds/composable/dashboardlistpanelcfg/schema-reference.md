---
keywords:
  - grafana
  - schema
title: DashboardListPanelCfg kind
---
> Documentation generation is still in active development and is subject to further improvements.

> Kinds **schema** is also subject to active development, and could change without prior notice.

# DashboardListPanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property       | Type                    | Required | Description                              |
|----------------|-------------------------|----------|------------------------------------------|
| `PanelLayout`  | string                  | **Yes**  | Possible values are: `list`, `previews`. |
| `PanelOptions` | [object](#paneloptions) | **Yes**  |                                          |

## PanelOptions

### Properties

| Property             | Type     | Required | Description                              |
|----------------------|----------|----------|------------------------------------------|
| `maxItems`           | integer  | **Yes**  | Default: `10`.                           |
| `query`              | string   | **Yes**  | Default: ``.                             |
| `showHeadings`       | boolean  | **Yes**  | Default: `true`.                         |
| `showRecentlyViewed` | boolean  | **Yes**  | Default: `false`.                        |
| `showSearch`         | boolean  | **Yes**  | Default: `false`.                        |
| `showStarred`        | boolean  | **Yes**  | Default: `true`.                         |
| `tags`               | string[] | **Yes**  |                                          |
| `folderId`           | integer  | No       |                                          |
| `layout`             | string   | No       | Possible values are: `list`, `previews`. |


