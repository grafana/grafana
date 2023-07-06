---
keywords:
  - grafana
  - schema
title: StateTimelinePanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## StateTimelinePanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property      | Type                   | Required | Default | Description |
|---------------|------------------------|----------|---------|-------------|
| `FieldConfig` | [object](#fieldconfig) | **Yes**  |         |             |
| `Options`     | [object](#options)     | **Yes**  |         |             |

### FieldConfig

It extends [HideableFieldConfig](#hideablefieldconfig).

| Property      | Type                                  | Required | Default | Description                                                                  |
|---------------|---------------------------------------|----------|---------|------------------------------------------------------------------------------|
| `fillOpacity` | integer                               | No       | `70`    | Constraint: `>=0 & <=100`.                                                   |
| `hideFrom`    | [HideSeriesConfig](#hideseriesconfig) | No       |         | *(Inherited from [HideableFieldConfig](#hideablefieldconfig))*<br/>TODO docs |
| `lineWidth`   | integer                               | No       | `0`     | Constraint: `>=0 & <=10`.                                                    |

### HideSeriesConfig

TODO docs

| Property  | Type    | Required | Default | Description |
|-----------|---------|----------|---------|-------------|
| `legend`  | boolean | **Yes**  |         |             |
| `tooltip` | boolean | **Yes**  |         |             |
| `viz`     | boolean | **Yes**  |         |             |

### HideableFieldConfig

TODO docs

| Property   | Type                                  | Required | Default | Description |
|------------|---------------------------------------|----------|---------|-------------|
| `hideFrom` | [HideSeriesConfig](#hideseriesconfig) | No       |         | TODO docs   |

### Options

It extends [OptionsWithLegend](#optionswithlegend) and [OptionsWithTooltip](#optionswithtooltip) and [OptionsWithTimezones](#optionswithtimezones).

| Property      | Type                                    | Required | Default | Description                                                                |
|---------------|-----------------------------------------|----------|---------|----------------------------------------------------------------------------|
| `legend`      | [VizLegendOptions](#vizlegendoptions)   | **Yes**  |         | *(Inherited from [OptionsWithLegend](#optionswithlegend))*<br/>TODO docs   |
| `rowHeight`   | number                                  | **Yes**  | `0.9`   | Controls the row height                                                    |
| `showValue`   | string                                  | **Yes**  |         | Show timeline values on chart                                              |
| `tooltip`     | [VizTooltipOptions](#viztooltipoptions) | **Yes**  |         | *(Inherited from [OptionsWithTooltip](#optionswithtooltip))*<br/>TODO docs |
| `alignValue`  | string                                  | No       |         | Controls value alignment on the timelines                                  |
| `mergeValues` | boolean                                 | No       | `true`  | Merge equal consecutive values                                             |
| `timezone`    | string[]                                | No       |         | *(Inherited from [OptionsWithTimezones](#optionswithtimezones))*           |

### OptionsWithLegend

TODO docs

| Property | Type                                  | Required | Default | Description |
|----------|---------------------------------------|----------|---------|-------------|
| `legend` | [VizLegendOptions](#vizlegendoptions) | **Yes**  |         | TODO docs   |

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

### OptionsWithTimezones

TODO docs

| Property   | Type     | Required | Default | Description |
|------------|----------|----------|---------|-------------|
| `timezone` | string[] | No       |         |             |

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


