---
keywords:
  - grafana
  - schema
title: PieChartPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# PieChartPanelCfg kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property                | Type                                        | Required | Description                                                                                                                                                                                                               |
|-------------------------|---------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `PanelFieldConfig`      | [HideableFieldConfig](#hideablefieldconfig) | **Yes**  | TODO docs                                                                                                                                                                                                                 |
| `PanelOptions`          | [object](#paneloptions)                     | **Yes**  |                                                                                                                                                                                                                           |
| `PieChartLabels`        | string                                      | **Yes**  | Select labels to display on the pie chart.<br/> - Name - The series or field name.<br/> - Percent - The percentage of the whole.<br/> - Value - The raw numerical value. Possible values are: `name`, `value`, `percent`. |
| `PieChartLegendOptions` | [object](#piechartlegendoptions)            | **Yes**  |                                                                                                                                                                                                                           |
| `PieChartLegendValues`  | string                                      | **Yes**  | Select values to display in the legend.<br/> - Percent: The percentage of the whole.<br/> - Value: The raw numerical value. Possible values are: `value`, `percent`.                                                      |
| `PieChartType`          | string                                      | **Yes**  | Select the pie chart display style. Possible values are: `pie`, `donut`.                                                                                                                                                  |

## HideableFieldConfig

TODO docs

### Properties

| Property   | Type                                  | Required | Description |
|------------|---------------------------------------|----------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       | TODO docs   |

### HideSeriesConfig

TODO docs

#### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

## PanelOptions

### Properties

| Property        | Type                                            | Required | Description                                                              |
|-----------------|-------------------------------------------------|----------|--------------------------------------------------------------------------|
| `displayLabels` | string[]                                        | No       |                                                                          |
| `legend`        | [PieChartLegendOptions](#piechartlegendoptions) | No       |                                                                          |
| `pieType`       | string                                          | No       | Select the pie chart display style. Possible values are: `pie`, `donut`. |

### PieChartLegendOptions

#### Properties

| Property | Type     | Required | Description |
|----------|----------|----------|-------------|
| `values` | string[] | No       |             |

## PieChartLegendOptions

### Properties

| Property | Type     | Required | Description |
|----------|----------|----------|-------------|
| `values` | string[] | No       |             |


