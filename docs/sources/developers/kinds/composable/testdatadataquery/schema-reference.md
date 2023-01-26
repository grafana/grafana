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

| Property          | Type                                | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
|-------------------|-------------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `alias`           | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `channel`         | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `csvContent`      | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `csvFileName`     | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `csvWave`         | [CSVWave](#csvwave)[]               | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `errorType`       | string                              | No       | Possible values are: `server_panic`, `frontend_exception`, `frontend_observable`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `labels`          | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `levelColumn`     | boolean                             | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `lines`           | integer                             | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `nodes`           | [NodesQuery](#nodesquery)           | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pulseWave`       | [PulseWaveQuery](#pulsewavequery)   | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `rawFrameContent` | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `scenarioId`      | string                              | No       | Possible values are: `random_walk`, `slow_query`, `random_walk_with_error`, `random_walk_table`, `exponential_heatmap_bucket_data`, `linear_heatmap_bucket_data`, `no_data_points`, `datapoints_outside_range`, `csv_metric_values`, `predictable_pulse`, `predictable_csv_wave`, `streaming_client`, `simulation`, `usa`, `live`, `grafana_api`, `arrow`, `annotations`, `table_static`, `server_error_500`, `logs`, `node_graph`, `flame_graph`, `raw_frame`, `csv_file`, `csv_content`, `trace`. |
| `seriesCount`     | integer                             | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `sim`             | [SimulationQuery](#simulationquery) | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `spanCount`       | integer                             | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `stream`          | [StreamingQuery](#streamingquery)   | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `stringInput`     | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `usa`             | [USAQuery](#usaquery)               | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## CSVWave

### Properties

| Property    | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `labels`    | string  | No       |             |
| `name`      | string  | No       |             |
| `timeStep`  | integer | No       |             |
| `valuesCSV` | string  | No       |             |

## NodesQuery

### Properties

| Property | Type    | Required | Description                                                |
|----------|---------|----------|------------------------------------------------------------|
| `count`  | integer | No       |                                                            |
| `type`   | string  | No       | Possible values are: `random`, `response`, `random edges`. |

## PulseWaveQuery

### Properties

| Property   | Type    | Required | Description |
|------------|---------|----------|-------------|
| `offCount` | integer | No       |             |
| `offValue` | number  | No       |             |
| `onCount`  | integer | No       |             |
| `onValue`  | number  | No       |             |
| `timeStep` | integer | No       |             |

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

| Property | Type    | Required | Description                                     |
|----------|---------|----------|-------------------------------------------------|
| `noise`  | integer | **Yes**  |                                                 |
| `speed`  | integer | **Yes**  |                                                 |
| `spread` | integer | **Yes**  |                                                 |
| `type`   | string  | **Yes**  | Possible values are: `signal`, `logs`, `fetch`. |
| `bands`  | integer | No       |                                                 |
| `url`    | string  | No       |                                                 |

## USAQuery

### Properties

| Property | Type     | Required | Description |
|----------|----------|----------|-------------|
| `fields` | string[] | No       |             |
| `mode`   | string   | No       |             |
| `period` | string   | No       |             |
| `states` | string[] | No       |             |


