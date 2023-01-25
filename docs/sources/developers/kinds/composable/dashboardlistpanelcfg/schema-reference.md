---
keywords:
  - grafana
  - schema
title: DashboardListPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# DashboardListPanelCfg kind

## Maturity: experimental
## Version: 0.0

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


