---
keywords:
  - grafana
  - schema
title: AnnotationsListPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## AnnotationsListPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

### PanelOptions

| Property                | Type     | Required | Description       |
|-------------------------|----------|----------|-------------------|
| `limit`                 | uint32   | **Yes**  | Default: `10`.    |
| `navigateAfter`         | string   | **Yes**  | Default: `10m`.   |
| `navigateBefore`        | string   | **Yes**  | Default: `10m`.   |
| `navigateToPanel`       | boolean  | **Yes**  | Default: `true`.  |
| `onlyFromThisDashboard` | boolean  | **Yes**  | Default: `false`. |
| `onlyInTimeRange`       | boolean  | **Yes**  | Default: `false`. |
| `showTags`              | boolean  | **Yes**  | Default: `true`.  |
| `showTime`              | boolean  | **Yes**  | Default: `true`.  |
| `showUser`              | boolean  | **Yes**  | Default: `true`.  |
| `tags`                  | string[] | **Yes**  |                   |


