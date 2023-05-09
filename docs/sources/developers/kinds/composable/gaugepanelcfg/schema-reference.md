---
keywords:
  - grafana
  - schema
title: GaugePanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## GaugePanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property       | Type                    | Required | Default | Description |
|----------------|-------------------------|----------|---------|-------------|
| `PanelOptions` | [object](#paneloptions) | **Yes**  |         |             |

### PanelOptions

It extends [SingleStatBaseOptions](#singlestatbaseoptions).

| Property               | Type                                            | Required | Default | Description                                                                                                                                 |
|------------------------|-------------------------------------------------|----------|---------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `showThresholdLabels`  | boolean                                         | **Yes**  | `false` |                                                                                                                                             |
| `showThresholdMarkers` | boolean                                         | **Yes**  | `true`  |                                                                                                                                             |
| `orientation`          | string                                          | No       |         | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*<br/>TODO docs<br/>Possible values are: `auto`, `vertical`, `horizontal`. |
| `reduceOptions`        | [ReduceDataOptions](#reducedataoptions)         | No       |         | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*<br/>TODO docs                                                            |
| `text`                 | [VizTextDisplayOptions](#viztextdisplayoptions) | No       |         | *(Inherited from [SingleStatBaseOptions](#singlestatbaseoptions))*<br/>TODO docs                                                            |

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


