---
keywords:
  - grafana
  - schema
title: StatPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# StatPanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property       | Type                    | Required | Description |
|----------------|-------------------------|----------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |             |

## PanelOptions

### Properties

| Property      | Type   | Required | Description                                                                       |
|---------------|--------|----------|-----------------------------------------------------------------------------------|
| `colorMode`   | string | No       | TODO docs Possible values are: `value`, `background`, `none`.                     |
| `graphMode`   | string | No       | TODO docs Possible values are: `none`, `line`, `area`.                            |
| `justifyMode` | string | No       | TODO docs Possible values are: `auto`, `center`.                                  |
| `textMode`    | string | No       | TODO docs Possible values are: `auto`, `value`, `value_and_name`, `name`, `none`. |


