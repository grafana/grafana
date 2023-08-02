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



| Property  | Type               | Required | Default | Description |
|-----------|--------------------|----------|---------|-------------|
| `Options` | [object](#options) | **Yes**  |         |             |

### Options

| Property                | Type     | Required | Default | Description |
|-------------------------|----------|----------|---------|-------------|
| `limit`                 | uint32   | **Yes**  | `10`    |             |
| `navigateAfter`         | string   | **Yes**  | `10m`   |             |
| `navigateBefore`        | string   | **Yes**  | `10m`   |             |
| `navigateToPanel`       | boolean  | **Yes**  | `true`  |             |
| `onlyFromThisDashboard` | boolean  | **Yes**  | `false` |             |
| `onlyInTimeRange`       | boolean  | **Yes**  | `false` |             |
| `showTags`              | boolean  | **Yes**  | `true`  |             |
| `showTime`              | boolean  | **Yes**  | `true`  |             |
| `showUser`              | boolean  | **Yes**  | `true`  |             |
| `tags`                  | string[] | **Yes**  |         |             |


