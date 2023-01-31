---
keywords:
  - grafana
  - schema
title: TestDataDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# TestDataDataQuery kind

## Maturity: experimental
## Version: 0.0


This kind extends: [DataQuery](#dataquery).

## Properties

| Property          | Type                                | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|-------------------|-------------------------------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `refId`           | string                              | **Yes**  | *(Inherited from [DataQuery](#dataquery))*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `alias`           | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `channel`         | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `csvContent`      | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `csvFileName`     | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `csvWave`         | [CSVWave](#csvwave)[]               | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `datasource`      |                                     | No       | *(Inherited from [DataQuery](#dataquery))*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `errorType`       | string                              | No       | Possible values are: `server_panic`, `frontend_exception`, `frontend_observable`.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `hide`            | boolean                             | No       | *(Inherited from [DataQuery](#dataquery))*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `key`             | string                              | No       | *(Inherited from [DataQuery](#dataquery))*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `labels`          | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `levelColumn`     | boolean                             | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `lines`           | integer                             | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `nodes`           | [NodesQuery](#nodesquery)           | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `points`          | array[]                             | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pulseWave`       | [PulseWaveQuery](#pulsewavequery)   | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `queryType`       | string                              | No       | *(Inherited from [DataQuery](#dataquery))*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `rawFrameContent` | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `scenarioId`      | string                              | No       | Possible values are: `random_walk`, `slow_query`, `random_walk_with_error`, `random_walk_table`, `exponential_heatmap_bucket_data`, `linear_heatmap_bucket_data`, `no_data_points`, `datapoints_outside_range`, `csv_metric_values`, `predictable_pulse`, `predictable_csv_wave`, `streaming_client`, `simulation`, `usa`, `live`, `grafana_api`, `arrow`, `annotations`, `table_static`, `server_error_500`, `logs`, `node_graph`, `flame_graph`, `raw_frame`, `csv_file`, `csv_content`, `trace`, `manual_entry`, `variables-query`. |
| `seriesCount`     | integer                             | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `sim`             | [SimulationQuery](#simulationquery) | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `spanCount`       | integer                             | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `stream`          | [StreamingQuery](#streamingquery)   | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `stringInput`     | string                              | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `usa`             | [USAQuery](#usaquery)               | No       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## CSVWave

### Properties

| Property    | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `labels`    | string  | No       |             |
| `name`      | string  | No       |             |
| `timeStep`  | integer | No       |             |
| `valuesCSV` | string  | No       |             |

## DataQuery

These are the common properties available to all queries in all datasources.
Specific implementations will *extend* this interface, adding the required
properties for the given context.

### Properties

| Property     | Type    | Required | Description                                                                                                                                                                                                                                             |
|--------------|---------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `refId`      | string  | **Yes**  | A - Z                                                                                                                                                                                                                                                   |
| `datasource` |         | No       | For mixed data sources the selected datasource is on the query level.<br/>For non mixed scenarios this is undefined.<br/>TODO find a better way to do this ^ that's friendly to schema<br/>TODO this shouldn't be unknown but DataSourceRef &#124; null |
| `hide`       | boolean | No       | true if query is disabled (ie should not be returned to the dashboard)                                                                                                                                                                                  |
| `key`        | string  | No       | Unique, guid like, string used in explore mode                                                                                                                                                                                                          |
| `queryType`  | string  | No       | Specify the query flavor<br/>TODO make this required and give it a default                                                                                                                                                                              |

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


