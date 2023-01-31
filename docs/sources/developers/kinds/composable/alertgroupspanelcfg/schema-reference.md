---
keywords:
  - grafana
  - schema
title: AlertGroupsPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# AlertGroupsPanelCfg kind

## Maturity: merged
## Version: 0.0

## Properties

| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

## PanelOptions

### Properties

| Property       | Type    | Required | Description                                                 |
|----------------|---------|----------|-------------------------------------------------------------|
| `alertmanager` | string  | **Yes**  | Name of the alertmanager used as a source for alerts        |
| `expandAll`    | boolean | **Yes**  | Expand all alert groups by default                          |
| `labels`       | string  | **Yes**  | Comma-separated list of values used to filter alert results |


