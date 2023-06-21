---
keywords:
  - grafana
  - schema
title: CandlestickPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# CandlestickPanelCfg kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property              | Type                           | Required | Description                                                                                                                                                                                                                                                                                 |
|-----------------------|--------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `CandleStyle`         | string                         | **Yes**  | TODO docs Possible values are: `candles`, `ohlcbars`.                                                                                                                                                                                                                                       |
| `CandlestickColors`   | [object](#candlestickcolors)   | **Yes**  | TODO docs                                                                                                                                                                                                                                                                                   |
| `CandlestickFieldMap` | [object](#candlestickfieldmap) | **Yes**  | TODO docs                                                                                                                                                                                                                                                                                   |
| `ColorStrategy`       | string                         | **Yes**  | TODO docs<br/>"open-close":  up/down color depends on current close vs current open<br/>filled always<br/>"close-close": up/down color depends on current close vs prior close<br/>filled/hollow depends on current close vs current open Possible values are: `open-close`, `close-close`. |
| `PanelFieldConfig`    | [object](#panelfieldconfig)    | **Yes**  |                                                                                                                                                                                                                                                                                             |
| `PanelOptions`        | [object](#paneloptions)        | **Yes**  |                                                                                                                                                                                                                                                                                             |
| `VizDisplayMode`      | string                         | **Yes**  | TODO docs Possible values are: `candles+volume`, `candles`, `volume`.                                                                                                                                                                                                                       |

## CandlestickColors

TODO docs

### Properties

| Property | Type   | Required | Description       |
|----------|--------|----------|-------------------|
| `down`   | string | **Yes**  | Default: `red`.   |
| `flat`   | string | **Yes**  | Default: `gray`.  |
| `up`     | string | **Yes**  | Default: `green`. |

## CandlestickFieldMap

TODO docs

### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `close`  | string | No       |             |
| `high`   | string | No       |             |
| `low`    | string | No       |             |
| `open`   | string | No       |             |
| `volume` | string | No       |             |

## PanelFieldConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|

## PanelOptions

### Properties

| Property           | Type                                    | Required | Description                                                                                                                                                                                                                                                                                 |
|--------------------|-----------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `candleStyle`      | string                                  | No       | TODO docs Possible values are: `candles`, `ohlcbars`.                                                                                                                                                                                                                                       |
| `colorStrategy`    | string                                  | No       | TODO docs<br/>"open-close":  up/down color depends on current close vs current open<br/>filled always<br/>"close-close": up/down color depends on current close vs prior close<br/>filled/hollow depends on current close vs current open Possible values are: `open-close`, `close-close`. |
| `colors`           | [CandlestickColors](#candlestickcolors) | No       | TODO docs                                                                                                                                                                                                                                                                                   |
| `fields`           | [object](#fields)                       | No       | TODO docs Default: `map[]`.                                                                                                                                                                                                                                                                 |
| `includeAllFields` | boolean                                 | No       | When enabled, all fields will be sent to the graph Default: `false`.                                                                                                                                                                                                                        |
| `mode`             | string                                  | No       | TODO docs Possible values are: `candles+volume`, `candles`, `volume`.                                                                                                                                                                                                                       |

### CandlestickColors

TODO docs

#### Properties

| Property | Type   | Required | Description       |
|----------|--------|----------|-------------------|
| `down`   | string | **Yes**  | Default: `red`.   |
| `flat`   | string | **Yes**  | Default: `gray`.  |
| `up`     | string | **Yes**  | Default: `green`. |

### fields

TODO docs
The default value is: `map[]`.
| Property | Type | Required | Description |
|----------|------|----------|-------------|


