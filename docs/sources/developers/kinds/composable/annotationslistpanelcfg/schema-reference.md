---
keywords:
  - grafana
  - schema
title: AnnotationsListPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# AnnotationsListPanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

## PanelOptions

### Properties

| Property                | Type     | Required | Description       |
|-------------------------|----------|----------|-------------------|
| `limit`                 | integer  | **Yes**  | Default: `10`.    |
| `navigateAfter`         | string   | **Yes**  | Default: `10m`.   |
| `navigateBefore`        | string   | **Yes**  | Default: `10m`.   |
| `navigateToPanel`       | boolean  | **Yes**  | Default: `true`.  |
| `onlyFromThisDashboard` | boolean  | **Yes**  | Default: `false`. |
| `onlyInTimeRange`       | boolean  | **Yes**  | Default: `false`. |
| `showTags`              | boolean  | **Yes**  | Default: `true`.  |
| `showTime`              | boolean  | **Yes**  | Default: `true`.  |
| `showUser`              | boolean  | **Yes**  | Default: `true`.  |
| `tags`                  | string[] | **Yes**  |                   |


