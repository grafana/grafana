---
keywords:
  - grafana
  - schema
title: StatusHistoryPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# StatusHistoryPanelCfg kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property           | Type                        | Required | Description                                                                                                                                                 |
|--------------------|-----------------------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `PanelFieldConfig` | [object](#panelfieldconfig) | **Yes**  | This kind extends: [HideableFieldConfig](#hideablefieldconfig).                                                                                             |
| `PanelOptions`     | [object](#paneloptions)     | **Yes**  | This kind extends: [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip) and [OptionsWithTimezones](#optionswithtimezones). |

## PanelFieldConfig


This kind extends: [HideableFieldConfig](#hideablefieldconfig).

### Properties

| Property      | Type                                  | Required | Description                                                    |
|---------------|---------------------------------------|----------|----------------------------------------------------------------|
| `fillOpacity` | integer                               | No       | Default: `70`.                                                 |
| `hideFrom`    | [HideSeriesConfig](#hideseriesconfig) | No       | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))* |
| `lineWidth`   | integer                               | No       | Default: `1`.                                                  |

### HideSeriesConfig

*(Inherited from [HideableFieldConfig](#hideablefieldconfig))*

#### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

### HideableFieldConfig

TODO docs

#### Properties

| Property   | Type                                  | Required | Description |
|------------|---------------------------------------|----------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       | TODO docs   |

#### HideSeriesConfig

TODO docs

##### Properties

| Property  | Type    | Required | Description |
|-----------|---------|----------|-------------|
| `legend`  | boolean | **Yes**  |             |
| `tooltip` | boolean | **Yes**  |             |
| `viz`     | boolean | **Yes**  |             |

## PanelOptions


This kind extends: [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip) and [OptionsWithTimezones](#optionswithtimezones).

### Properties

| Property    | Type                                    | Required | Description                                                      |
|-------------|-----------------------------------------|----------|------------------------------------------------------------------|
| `legend`    | [VizLegendOptions](#vizlegendoptions)   | **Yes**  | *(Inherited from [OptionsWithLegend](#optionswithlegend))*       |
| `rowHeight` | number                                  | **Yes**  | Set the height of the rows Default: `0.9`.                       |
| `showValue` | string                                  | **Yes**  | TODO docs Possible values are: `auto`, `never`, `always`.        |
| `tooltip`   | [VizTooltipOptions](#viztooltipoptions) | **Yes**  | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))*     |
| `colWidth`  | number                                  | No       | Controls the column width Default: `0.9`.                        |
| `timezone`  | string[]                                | No       | *(Inherited from [OptionsWithTimezones](#optionswithtimezones))* |

### OptionsWithLegend

TODO docs

#### Properties

| Property | Type                                  | Required | Description |
|----------|---------------------------------------|----------|-------------|
| `legend` | [VizLegendOptions](#vizlegendoptions) | **Yes**  | TODO docs   |

#### VizLegendOptions

TODO docs

##### Properties

| Property      | Type     | Required | Description                                                                                                                         |
|---------------|----------|----------|-------------------------------------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  |                                                                                                                                     |
| `displayMode` | string   | **Yes**  | TODO docs<br/>Note: "hidden" needs to remain as an option for plugins compatibility Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  | TODO docs Possible values are: `bottom`, `right`.                                                                                   |
| `showLegend`  | boolean  | **Yes**  |                                                                                                                                     |
| `asTable`     | boolean  | No       |                                                                                                                                     |
| `isVisible`   | boolean  | No       |                                                                                                                                     |
| `sortBy`      | string   | No       |                                                                                                                                     |
| `sortDesc`    | boolean  | No       |                                                                                                                                     |
| `width`       | number   | No       |                                                                                                                                     |

### OptionsWithTimezones

TODO docs

#### Properties

| Property   | Type     | Required | Description |
|------------|----------|----------|-------------|
| `timezone` | string[] | No       |             |

### OptionsWithTooltip

TODO docs

#### Properties

| Property  | Type                                    | Required | Description |
|-----------|-----------------------------------------|----------|-------------|
| `tooltip` | [VizTooltipOptions](#viztooltipoptions) | **Yes**  | TODO docs   |

#### VizTooltipOptions

TODO docs

##### Properties

| Property | Type   | Required | Description                                               |
|----------|--------|----------|-----------------------------------------------------------|
| `mode`   | string | **Yes**  | TODO docs Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  | TODO docs Possible values are: `asc`, `desc`, `none`.     |

### VizLegendOptions

*(Inherited from [OptionsWithLegend](#optionswithlegend))*

#### Properties

| Property      | Type     | Required | Description                                                                                                                         |
|---------------|----------|----------|-------------------------------------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  |                                                                                                                                     |
| `displayMode` | string   | **Yes**  | TODO docs<br/>Note: "hidden" needs to remain as an option for plugins compatibility Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  | TODO docs Possible values are: `bottom`, `right`.                                                                                   |
| `showLegend`  | boolean  | **Yes**  |                                                                                                                                     |
| `asTable`     | boolean  | No       |                                                                                                                                     |
| `isVisible`   | boolean  | No       |                                                                                                                                     |
| `sortBy`      | string   | No       |                                                                                                                                     |
| `sortDesc`    | boolean  | No       |                                                                                                                                     |
| `width`       | number   | No       |                                                                                                                                     |

### VizTooltipOptions

*(Inherited from [OptionsWithTooltip](#optionswithtooltip))*

#### Properties

| Property | Type   | Required | Description                                               |
|----------|--------|----------|-----------------------------------------------------------|
| `mode`   | string | **Yes**  | TODO docs Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  | TODO docs Possible values are: `asc`, `desc`, `none`.     |


