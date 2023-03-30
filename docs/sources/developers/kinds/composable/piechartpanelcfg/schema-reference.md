---
keywords:
  - grafana
  - schema
title: PieChartPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## PieChartPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property                | Type                                        | Required | Default | Description                                                                                                                                                                                                                   |
|-------------------------|---------------------------------------------|----------|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `PanelFieldConfig`      | [HideableFieldConfig](#hideablefieldconfig) | **Yes**  |         | TODO docs                                                                                                                                                                                                                     |
| `PanelOptions`          | [object](#paneloptions)                     | **Yes**  |         |                                                                                                                                                                                                                               |
| `PieChartLabels`        | string                                      | **Yes**  |         | Select labels to display on the pie chart.<br/> - Name - The series or field name.<br/> - Percent - The percentage of the whole.<br/> - Value - The raw numerical value.<br/>Possible values are: `name`, `value`, `percent`. |
| `PieChartLegendOptions` | [object](#piechartlegendoptions)            | **Yes**  |         |                                                                                                                                                                                                                               |
| `PieChartLegendValues`  | string                                      | **Yes**  |         | Select values to display in the legend.<br/> - Percent: The percentage of the whole.<br/> - Value: The raw numerical value.<br/>Possible values are: `value`, `percent`.                                                      |
| `PieChartType`          | string                                      | **Yes**  |         | Select the pie chart display style.<br/>Possible values are: `pie`, `donut`.                                                                                                                                                  |

### HideableFieldConfig

TODO docs

| Property   | Type                                  | Required | Default | Description |
|------------|---------------------------------------|----------|---------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       |         | TODO docs   |

### HideSeriesConfig

TODO docs

| Property  | Type    | Required | Default | Description |
|-----------|---------|----------|---------|-------------|
| `legend`  | boolean | **Yes**  |         |             |
| `tooltip` | boolean | **Yes**  |         |             |
| `viz`     | boolean | **Yes**  |         |             |

### PanelOptions

It extends [OptionsWithTooltip](#optionswithtooltip) and [SingleStatBaseOptions](#singlestatbaseoptions).

| Property        | Type                                            | Required | Default | Description                                                                                                                                 |
|-----------------|-------------------------------------------------|----------|---------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `displayLabels` | string[]                                        | **Yes**  |         |                                                                                                                                             |
| `legend`        | [PieChartLegendOptions](#piechartlegendoptions) | **Yes**  |         |                                                                                                                                             |
| `pieType`       | string                                          | **Yes**  |         | Select the pie chart display style.<br/>Possible values are: `pie`, `donut`.                                                                |
| `tooltip`       | [VizTooltipOptions](#viztooltipoptions)         | **Yes**  |         | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))*<br/>TODO docs                                                                  |
| `orientation`   | string                                          | No       |         | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*<br/>TODO docs<br/>Possible values are: `auto`, `vertical`, `horizontal`. |
| `reduceOptions` | [ReduceDataOptions](#reducedataoptions)         | No       |         | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*<br/>TODO docs                                                            |
| `text`          | [VizTextDisplayOptions](#viztextdisplayoptions) | No       |         | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*<br/>TODO docs                                                            |

### OptionsWithTooltip

TODO docs

| Property  | Type                                    | Required | Default | Description |
|-----------|-----------------------------------------|----------|---------|-------------|
| `tooltip` | [VizTooltipOptions](#viztooltipoptions) | **Yes**  |         | TODO docs   |

### VizTooltipOptions

TODO docs

| Property | Type   | Required | Default | Description                                                   |
|----------|--------|----------|---------|---------------------------------------------------------------|
| `mode`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `single`, `multi`, `none`. |
| `sort`   | string | **Yes**  |         | TODO docs<br/>Possible values are: `asc`, `desc`, `none`.     |

### PieChartLegendOptions

It extends [VizLegendOptions](#vizlegendoptions).

| Property      | Type     | Required | Default | Description                                                                                                                                                                                          |
|---------------|----------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  |         | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                                                                                                             |
| `displayMode` | string   | **Yes**  |         | *(Inherited from [VizLegendOptions](#vizlegendoptions))*<br/>TODO docs<br/>Note: "hidden" needs to remain as an option for plugins compatibility<br/>Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  |         | *(Inherited from [VizLegendOptions](#vizlegendoptions))*<br/>TODO docs<br/>Possible values are: `bottom`, `right`.                                                                                   |
| `showLegend`  | boolean  | **Yes**  |         | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                                                                                                             |
| `values`      | string[] | **Yes**  |         |                                                                                                                                                                                                      |
| `asTable`     | boolean  | No       |         | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                                                                                                             |
| `isVisible`   | boolean  | No       |         | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                                                                                                             |
| `sortBy`      | string   | No       |         | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                                                                                                             |
| `sortDesc`    | boolean  | No       |         | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                                                                                                             |
| `width`       | number   | No       |         | *(Inherited from [VizLegendOptions](#vizlegendoptions))*                                                                                                                                             |

### VizLegendOptions

TODO docs

| Property      | Type     | Required | Default | Description                                                                                                                             |
|---------------|----------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `calcs`       | string[] | **Yes**  |         |                                                                                                                                         |
| `displayMode` | string   | **Yes**  |         | TODO docs<br/>Note: "hidden" needs to remain as an option for plugins compatibility<br/>Possible values are: `list`, `table`, `hidden`. |
| `placement`   | string   | **Yes**  |         | TODO docs<br/>Possible values are: `bottom`, `right`.                                                                                   |
| `showLegend`  | boolean  | **Yes**  |         |                                                                                                                                         |
| `asTable`     | boolean  | No       |         |                                                                                                                                         |
| `isVisible`   | boolean  | No       |         |                                                                                                                                         |
| `sortBy`      | string   | No       |         |                                                                                                                                         |
| `sortDesc`    | boolean  | No       |         |                                                                                                                                         |
| `width`       | number   | No       |         |                                                                                                                                         |

### ReduceDataOptions

TODO docs

| Property | Type     | Required | Default | Description                                                   |
|----------|----------|----------|---------|---------------------------------------------------------------|
| `calcs`  | string[] | **Yes**  |         | When !values, pick one value for the whole field              |
| `fields` | string   | No       |         | Which fields to show.  By default this is only numeric fields |
| `limit`  | number   | No       |         | if showing all values limit                                   |
| `values` | boolean  | No       |         | If true show each row value                                   |

### SingleStatBaseOptions

TODO docs

It extends [OptionsWithTextFormatting](#optionswithtextformatting).

| Property        | Type                                            | Required | Default | Description                                                                              |
|-----------------|-------------------------------------------------|----------|---------|------------------------------------------------------------------------------------------|
| `orientation`   | string                                          | **Yes**  |         | TODO docs<br/>Possible values are: `auto`, `vertical`, `horizontal`.                     |
| `reduceOptions` | [ReduceDataOptions](#reducedataoptions)         | **Yes**  |         | TODO docs                                                                                |
| `text`          | [VizTextDisplayOptions](#viztextdisplayoptions) | No       |         | *(Inherited from [OptionsWithTextFormatting](#optionswithtextformatting))*<br/>TODO docs |

### OptionsWithTextFormatting

TODO docs

| Property | Type                                            | Required | Default | Description |
|----------|-------------------------------------------------|----------|---------|-------------|
| `text`   | [VizTextDisplayOptions](#viztextdisplayoptions) | No       |         | TODO docs   |

### VizTextDisplayOptions

TODO docs

| Property    | Type   | Required | Default | Description              |
|-------------|--------|----------|---------|--------------------------|
| `titleSize` | number | No       |         | Explicit title text size |
| `valueSize` | number | No       |         | Explicit value text size |


