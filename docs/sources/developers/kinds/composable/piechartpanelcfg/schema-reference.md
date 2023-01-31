---
keywords:
  - grafana
  - schema
title: PieChartPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# PieChartPanelCfg kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property                | Type                                        | Required | Description                                                                                                                                                                                                               |
|-------------------------|---------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `PanelFieldConfig`      | [HideableFieldConfig](#hideablefieldconfig) | **Yes**  | TODO docs                                                                                                                                                                                                                 |
| `PanelOptions`          | [object](#paneloptions)                     | **Yes**  | This kind extends: [OptionsWithTooltip](#optionswithtooltip) and [SingleStatBaseOptions](#singlestatbaseoptions).                                                                                                         |
| `PieChartLabels`        | string                                      | **Yes**  | Select labels to display on the pie chart.<br/> - Name - The series or field name.<br/> - Percent - The percentage of the whole.<br/> - Value - The raw numerical value. Possible values are: `name`, `value`, `percent`. |
| `PieChartLegendOptions` | [object](#piechartlegendoptions)            | **Yes**  | This kind extends: [VizLegendOptions](#vizlegendoptions).                                                                                                                                                                 |
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


This kind extends: [OptionsWithTooltip](#optionswithtooltip) and [SingleStatBaseOptions](#singlestatbaseoptions).

### Properties

| Property        | Type                                            | Required | Description                                                                                                               |
|-----------------|-------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------|
| `displayLabels` | string[]                                        | **Yes**  |                                                                                                                           |
| `legend`        | [PieChartLegendOptions](#piechartlegendoptions) | **Yes**  | This kind extends: [VizLegendOptions](#vizlegendoptions).                                                                 |
| `pieType`       | string                                          | **Yes**  | Select the pie chart display style. Possible values are: `pie`, `donut`.                                                  |
| `tooltip`       | [VizTooltipOptions](#viztooltipoptions)         | **Yes**  | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))*                                                              |
| `orientation`   | string                                          | No       | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))* Possible values are: `auto`, `vertical`, `horizontal`. |
| `reduceOptions` | [ReduceDataOptions](#reducedataoptions)         | No       | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*                                                        |
| `text`          | [VizTextDisplayOptions](#viztextdisplayoptions) | No       | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*                                                        |

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

### PieChartLegendOptions


This kind extends: [VizLegendOptions](#vizlegendoptions).

#### Properties

| Property      | Type     | Required | Description                                                                                              |
|---------------|----------|----------|----------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `displayMode` | string   | **Yes**  | *(Inherited from [VizLegendOptions](#vizlegendoptions))* Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  | *(Inherited from [VizLegendOptions](#vizlegendoptions))* Possible values are: `bottom`, `right`.         |
| `showLegend`  | boolean  | **Yes**  | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `values`      | string[] | **Yes**  |                                                                                                          |
| `asTable`     | boolean  | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `isVisible`   | boolean  | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `sortBy`      | string   | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `sortDesc`    | boolean  | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `width`       | number   | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |

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

### ReduceDataOptions

*(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*

#### Properties

| Property | Type     | Required | Description                                                   |
|----------|----------|----------|---------------------------------------------------------------|
| `calcs`  | string[] | **Yes**  | When !values, pick one value for the whole field              |
| `fields` | string   | No       | Which fields to show.  By default this is only numeric fields |
| `limit`  | number   | No       | if showing all values limit                                   |
| `values` | boolean  | No       | If true show each row value                                   |

### SingleStatBaseOptions

TODO docs
This kind extends: [OptionsWithTextFormatting](#optionswithtextformatting).

#### Properties

| Property        | Type                                            | Required | Description                                                                |
|-----------------|-------------------------------------------------|----------|----------------------------------------------------------------------------|
| `orientation`   | string                                          | **Yes**  | TODO docs Possible values are: `auto`, `vertical`, `horizontal`.           |
| `reduceOptions` | [ReduceDataOptions](#reducedataoptions)         | **Yes**  | TODO docs                                                                  |
| `text`          | [VizTextDisplayOptions](#viztextdisplayoptions) | No       | *(Inherited from [OptionsWithTextFormatting](#optionswithtextformatting))* |

#### OptionsWithTextFormatting

TODO docs

##### Properties

| Property | Type                                            | Required | Description |
|----------|-------------------------------------------------|----------|-------------|
| `text`   | [VizTextDisplayOptions](#viztextdisplayoptions) | No       | TODO docs   |

##### VizTextDisplayOptions

TODO docs

###### Properties

| Property    | Type   | Required | Description              |
|-------------|--------|----------|--------------------------|
| `titleSize` | number | No       | Explicit title text size |
| `valueSize` | number | No       | Explicit value text size |

#### ReduceDataOptions

TODO docs

##### Properties

| Property | Type     | Required | Description                                                   |
|----------|----------|----------|---------------------------------------------------------------|
| `calcs`  | string[] | **Yes**  | When !values, pick one value for the whole field              |
| `fields` | string   | No       | Which fields to show.  By default this is only numeric fields |
| `limit`  | number   | No       | if showing all values limit                                   |
| `values` | boolean  | No       | If true show each row value                                   |

#### VizTextDisplayOptions

*(Inherited from [OptionsWithTextFormatting](#optionswithtextformatting))*

##### Properties

| Property    | Type   | Required | Description              |
|-------------|--------|----------|--------------------------|
| `titleSize` | number | No       | Explicit title text size |
| `valueSize` | number | No       | Explicit value text size |

### VizTextDisplayOptions

*(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*

#### Properties

| Property    | Type   | Required | Description              |
|-------------|--------|----------|--------------------------|
| `titleSize` | number | No       | Explicit title text size |
| `valueSize` | number | No       | Explicit value text size |

### VizTooltipOptions

*(Inherited from [OptionsWithTooltip](#optionswithtooltip))*

#### Properties

| Property | Type   | Required | Description                                               |
|----------|--------|----------|-----------------------------------------------------------|
| `mode`   | string | **Yes**  | TODO docs Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  | TODO docs Possible values are: `asc`, `desc`, `none`.     |

## PieChartLegendOptions


This kind extends: [VizLegendOptions](#vizlegendoptions).

### Properties

| Property      | Type     | Required | Description                                                                                              |
|---------------|----------|----------|----------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `displayMode` | string   | **Yes**  | *(Inherited from [VizLegendOptions](#vizlegendoptions))* Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  | *(Inherited from [VizLegendOptions](#vizlegendoptions))* Possible values are: `bottom`, `right`.         |
| `showLegend`  | boolean  | **Yes**  | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `values`      | string[] | **Yes**  |                                                                                                          |
| `asTable`     | boolean  | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `isVisible`   | boolean  | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `sortBy`      | string   | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `sortDesc`    | boolean  | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |
| `width`       | number   | No       | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                 |

### VizLegendOptions

TODO docs

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


