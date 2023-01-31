---
keywords:
  - grafana
  - schema
title: GaugePanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# GaugePanelCfg kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property       | Type                    | Required | Description                                                         |
|----------------|-------------------------|----------|---------------------------------------------------------------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  | This kind extends: [SingleStatBaseOptions](#singlestatbaseoptions). |

## PanelOptions


This kind extends: [SingleStatBaseOptions](#singlestatbaseoptions).

### Properties

| Property               | Type                                            | Required | Description                                                                                                               |
|------------------------|-------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------|
| `showThresholdLabels`  | boolean                                         | **Yes**  | Default: `false`.                                                                                                         |
| `showThresholdMarkers` | boolean                                         | **Yes**  | Default: `true`.                                                                                                          |
| `orientation`          | string                                          | No       | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))* Possible values are: `auto`, `vertical`, `horizontal`. |
| `reduceOptions`        | [ReduceDataOptions](#reducedataoptions)         | No       | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*                                                        |
| `text`                 | [VizTextDisplayOptions](#viztextdisplayoptions) | No       | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*                                                        |

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


