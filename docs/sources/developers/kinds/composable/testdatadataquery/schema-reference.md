---
keywords:
  - grafana
  - schema
title: TestDataDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# TestDataDataQuery kind

## Maturity: merged
## Version: 0.0

## Properties

| Property          | Type                                | Required | Description                                                                       |
|-------------------|-------------------------------------|----------|-----------------------------------------------------------------------------------|
| `alias`           | string                              | No       |                                                                                   |
| `channel`         | string                              | No       |                                                                                   |
| `csvContent`      | string                              | No       |                                                                                   |
| `csvFileName`     | string                              | No       |                                                                                   |
| `csvWave`         | [CSVWave](#csvwave)[]               | No       |                                                                                   |
| `errorType`       | string                              | No       | Possible values are: `server_panic`, `frontend_exception`, `frontend_observable`. |
| `labels`          | string                              | No       |                                                                                   |
| `levelColumn`     | boolean                             | No       |                                                                                   |
| `lines`           | number                              | No       |                                                                                   |
| `nodes`           | [NodesQuery](#nodesquery)           | No       |                                                                                   |
| `pulseWave`       | [PulseWaveQuery](#pulsewavequery)   | No       |                                                                                   |
| `rawFrameContent` | string                              | No       |                                                                                   |
| `scenarioId`      | string                              | No       |                                                                                   |
| `seriesCount`     | number                              | No       |                                                                                   |
| `sim`             | [SimulationQuery](#simulationquery) | No       |                                                                                   |
| `spanCount`       | number                              | No       |                                                                                   |
| `stream`          | [StreamingQuery](#streamingquery)   | No       |                                                                                   |
| `stringInput`     | string                              | No       |                                                                                   |
| `usa`             | [USAQuery](#usaquery)               | No       |                                                                                   |

## CSVWave

### Properties

| Property    | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `labels`    | string | No       |             |
| `name`      | string | No       |             |
| `timeStep`  | number | No       |             |
| `valuesCSV` | string | No       |             |

## NodesQuery

### Properties

| Property | Type   | Required | Description                                                |
|----------|--------|----------|------------------------------------------------------------|
| `count`  | number | No       |                                                            |
| `type`   | string | No       | Possible values are: `random`, `response`, `random edges`. |

## PulseWaveQuery

### Properties

| Property   | Type   | Required | Description |
|------------|--------|----------|-------------|
| `offCount` | number | No       |             |
| `offValue` | number | No       |             |
| `onCount`  | number | No       |             |
| `onValue`  | number | No       |             |
| `timeStep` | number | No       |             |

## SimulationQuery

### Properties

| Property | Type              | Required | Description |
|----------|-------------------|----------|-------------|
| `key`    | [object](#key)    | **Yes**  |             |
| `config` | [object](#config) | No       |             |
| `last`   | boolean           | No       |             |
| `stream` | boolean           | No       |             |

### config

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### key

#### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `tick`   | number | **Yes**  |             |
| `type`   | string | **Yes**  |             |
| `uid`    | string | No       |             |

## StreamingQuery

### Properties

| Property | Type   | Required | Description                                     |
|----------|--------|----------|-------------------------------------------------|
| `noise`  | number | **Yes**  |                                                 |
| `speed`  | number | **Yes**  |                                                 |
| `spread` | number | **Yes**  |                                                 |
| `type`   | string | **Yes**  | Possible values are: `signal`, `logs`, `fetch`. |
| `bands`  | number | No       |                                                 |
| `url`    | string | No       |                                                 |

## USAQuery

### Properties

| Property | Type     | Required | Description |
|----------|----------|----------|-------------|
| `fields` | string[] | No       |             |
| `mode`   | string   | No       |             |
| `period` | string   | No       |             |
| `states` | string[] | No       |             |


