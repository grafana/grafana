---
keywords:
  - grafana
  - schema
title: StatusHistoryPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## StatusHistoryPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property           | Type                        | Required | Description |
|--------------------|-----------------------------|----------|-------------|
| `PanelFieldConfig` | [object](#panelfieldconfig) | **Yes**  |             |
| `PanelOptions`     | [object](#paneloptions)     | **Yes**  |             |

### PanelFieldConfig

It extends [HideableFieldConfig](#hideablefieldconfig).

| Property      | Type                                  | Required | Description                                                                  |
|---------------|---------------------------------------|----------|------------------------------------------------------------------------------|
| `fillOpacity` | integer                               | No       | Default: `70`.<br/>Constraint: `>=0 & <=100`.                                |
| `hideFrom`    | [HideSeriesConfig](#hideseriesconfig) | No       | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*<br/>TODO docs |
| `lineWidth`   | integer                               | No       | Default: `1`.<br/>Constraint: `>=0 & <=10`.                                  |

### HideSeriesConfig

TODO docs

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

### HideableFieldConfig

TODO docs

| Property   | Type                                  | Required | Description |
|------------|---------------------------------------|----------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       | TODO docs   |

### PanelOptions

It extends [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip) and [OptionsWithTimezones](#optionswithtimezones).

| Property    | Type                                    | Required | Description                                                                |
|-------------|-----------------------------------------|----------|----------------------------------------------------------------------------|
| `legend`    | [VizLegendOptions](#vizlegendoptions)   | **Yes**  | *(Inherited from [OptionsWithLegend](#optionswithlegend))*<br/>TODO docs   |
| `rowHeight` | number                                  | **Yes**  | Set the height of the rows Default: `0.9`.<br/>Constraint: `>=0 & <=1`.    |
| `showValue` | string                                  | **Yes**  | TODO docs<br/>Possible values are: `auto`, `never`, `always`.              |
| `tooltip`   | [VizTooltipOptions](#viztooltipoptions) | **Yes**  | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))*<br/>TODO docs |
| `colWidth`  | number                                  | No       | Controls the column width Default: `0.9`.                                  |
| `timezone`  | string[]                                | No       | *(Inherited from [OptionsWithTimezones](#optionswithtimezones))*           |

### OptionsWithLegend

TODO docs

| Property | Type                                  | Required | Description |
|----------|---------------------------------------|----------|-------------|
| `legend` | [VizLegendOptions](#vizlegendoptions) | **Yes**  | TODO docs   |

### VizLegendOptions

TODO docs

| Property      | Type     | Required | Description                                                                                                                             |
|---------------|----------|----------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  |                                                                                                                                         |
| `displayMode` | string   | **Yes**  | TODO docs<br/>Note: "hidden" needs to remain as an option for plugins compatibility<br/>Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  | TODO docs<br/>Possible values are: `bottom`, `right`.                                                                                   |
| `showLegend`  | boolean  | **Yes**  |                                                                                                                                         |
| `asTable`     | boolean  | No       |                                                                                                                                         |
| `isVisible`   | boolean  | No       |                                                                                                                                         |
| `sortBy`      | string   | No       |                                                                                                                                         |
| `sortDesc`    | boolean  | No       |                                                                                                                                         |
| `width`       | number   | No       |                                                                                                                                         |

### OptionsWithTimezones

TODO docs

| Property   | Type     | Required | Description |
|------------|----------|----------|-------------|
| `timezone` | string[] | No       |             |

### OptionsWithTooltip

TODO docs

| Property  | Type                                    | Required | Description |
|-----------|-----------------------------------------|----------|-------------|
| `tooltip` | [VizTooltipOptions](#viztooltipoptions) | **Yes**  | TODO docs   |

### VizTooltipOptions

TODO docs

| Property | Type   | Required | Description                                                   |
|----------|--------|----------|---------------------------------------------------------------|
| `mode`   | string | **Yes**  | TODO docs<br/>Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  | TODO docs<br/>Possible values are: `asc`, `desc`, `none`.     |


