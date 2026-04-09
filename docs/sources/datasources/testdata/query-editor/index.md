---
description: Reference for the TestData query editor and all available scenarios.
keywords:
  - grafana
  - testdata
  - query editor
  - scenarios
  - mock data
  - simulated data
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: TestData query editor
weight: 200
review_date: "2026-04-08"
---

# TestData query editor

Instead of a traditional query language, the TestData data source uses **scenarios** to generate simulated data. Each scenario produces a different type of data suited for testing specific visualizations, behaviors, or edge cases.

For general documentation on querying data sources in Grafana, refer to [Query and transform data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/).

## Shared query options

Most scenarios share the following fields in the query editor. Scenario-specific options appear when you select a scenario.

| Field            | Description                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scenario**     | Drop-down to select the data generation type. Scenarios are listed alphabetically.                                                                                                                       |
| **Alias**        | Optional display name for the series. Hidden for the Simulation and Annotations scenarios. Supports the special values `__server_names` and `__house_locations` to use built-in name sets.               |
| **String Input** | Text field shown when the selected scenario provides a default string value. Used differently by each scenario.                                                                                           |
| **Labels**       | Available for Random Walk and Predictable Pulse. Set labels using key=value syntax, for example `key="value", key2="value2"`. Use `$seriesIndex` in a value to insert the series index.                  |
| **Drop percent** | Available for CSV Content and CSV File. Drops a random percentage (0-100) of data points from the result.                                                                                                |

## Data generation scenarios

These scenarios produce time-series data with configurable parameters.

### Random Walk

Generates random walk time-series data. This is the default scenario.

| Field            | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| **Series count** | Number of series to generate. Default: `1`.                    |
| **Start value**  | Initial value for the walk. Default: random.                   |
| **Min**          | Minimum value the walk can reach. Default: none.               |
| **Max**          | Maximum value the walk can reach. Default: none.               |
| **Spread**       | Controls how far each step can deviate. Default: `1`.          |
| **Noise**        | Adds noise to each data point. Default: `0`.                   |
| **Drop (%)**     | Percentage of points to randomly exclude. Default: `0`.        |

### Random Walk Table

Generates random walk data in table format with columns for Time, Value, Min, Max, Info, and State. The State column uses an enum field with values Unknown, Up, and Down. Optionally includes null values when **withNil** is enabled.

### Random Walk (with error)

Generates random walk time-series data and also returns an error in the response. Use this to test how panels handle data responses that contain both data and errors.

### Predictable Pulse

Generates a predictable pulse wave based on absolute time from the epoch, making it reproducible across runs.

| Field         | Description                                                                     |
| ------------- | ------------------------------------------------------------------------------- |
| **Step**      | Seconds between data points. Default: `60`.                                     |
| **On Count**  | Number of data points at the start of each cycle that use the on value.         |
| **Off Count** | Number of data points in each cycle that use the off value.                     |
| **On Value**  | The value for "on" data points. Can be a number, `null`, or `nan`.              |
| **Off Value** | The value for "off" data points. Can be a number, `null`, or `nan`.             |

The wave cycles at `Step * (On Count + Off Count)` seconds. Timestamps align evenly on the step interval.

### Predictable CSV Wave

Generates one or more predictable waves from CSV-defined values. Each wave cycles through its comma-separated values at a fixed time step.

| Field      | Description                                                                          |
| ---------- | ------------------------------------------------------------------------------------ |
| **Values** | Comma-separated numeric values for the wave. Supports `null` and `nan`.              |
| **Step**   | Seconds between data points.                                                         |
| **Name**   | Optional name for the series.                                                        |
| **Labels** | Optional labels in key=value format.                                                 |

Click **Add** to define additional waves. Click the trash icon to remove a wave.

### Steps

Generates step data from CSV content. The query editor provides a CSV text area where you enter the step values.

### Simulation

Runs a simulation engine that generates data continuously. Simulation supports streaming data through Grafana Live.

| Field          | Description                                                                      |
| -------------- | -------------------------------------------------------------------------------- |
| **Type**       | Simulation type: `flight` (flight path), `sine` (sine wave), or `tank` (tank).   |
| **Stream**     | Toggle to stream data through Grafana Live instead of returning a static result.  |
| **Interval**   | Tick frequency in Hz.                                                            |
| **UID**        | Optional unique identifier for the simulation instance.                          |

### USA generated data

Generates data with US state dimensions. Useful for testing geo-map visualizations and multi-dimensional data.

| Field      | Description                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Mode**   | Data format: `values-as-rows`, `values-as-fields`, `values-as-labeled-fields`, `timeseries`, or `timeseries-wide`.      |
| **Period** | Time period for data generation. Default: `30m`.                                                                        |
| **Fields** | Fields to include: `foo`, `bar`, `baz`. Default: all.                                                                   |
| **States** | US state codes to include (for example, `CA`, `NY`, `TX`). Default: all 50 states plus DC.                              |

## Manual input scenarios

These scenarios let you provide your own data directly.

### CSV Content

Provides a text editor where you paste or type CSV data directly. The first row is treated as headers. Use the **Drop percent** field to randomly exclude a percentage of data points.

### CSV File

Selects from a set of built-in CSV data files. Use the **Drop percent** field to randomly exclude a percentage of data points.

Available files:

- `flight_info_by_state.csv`
- `population_by_state.csv`
- `gdp_per_capita.csv`
- `js_libraries.csv`
- `ohlc_dogecoin.csv`
- `weight_height.csv`
- `browser_marketshare.csv`
- `automobiles.csv`

### CSV Metric Values

Generates time-series data from comma-separated values entered in the **String Input** field. Values are evenly distributed across the dashboard time range. Default: `1,20,90,30,5,0`.

### Raw Frames

Provides a JSON editor for defining data frames directly. The editor accepts the Grafana data frame JSON format and includes paste helpers for panel JSON and raw query results.

### Load Apache Arrow Data

Loads data from a base64-encoded Apache Arrow payload entered in the **String Input** text area. Use this to test Arrow format rendering.

### Table Static

Generates a static table with predefined columns: Time, Message, Description, and Value.

## Visualization test scenarios

These scenarios generate data for testing specific visualization types.

### Logs

Generates simulated log data with random log levels, container IDs, and hostnames.

| Field     | Description                                                                               |
| --------- | ----------------------------------------------------------------------------------------- |
| **Lines** | Number of log lines to generate. Default: `10`. Maximum: `10000`.                         |
| **Level** | Toggle to include a separate level column in the data instead of embedding it in messages. |

### Node Graph

Generates data for the [Node Graph visualization](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/).

| Field         | Description                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| **Data type** | Type of graph data: `random`, `response_small`, `response_medium`, `random edges`, or `feature_showcase`.|
| **Count**     | Number of nodes to generate. Available for `random` and `random edges` types.                            |
| **Seed**      | Seed value for reproducible random generation. Available for `random` and `random edges` types.          |

### Flame Graph

Generates data for the [Flame Graph visualization](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/).

| Field            | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| **Diff profile** | Toggle to generate a differential flame graph comparing two profiles.|

### Trace

Generates simulated distributed trace data.

| Field          | Description                                     |
| -------------- | ----------------------------------------------- |
| **Span count** | Number of spans in the generated trace.         |

### Annotations

Generates annotation data points.

| Field     | Description                                              |
| --------- | -------------------------------------------------------- |
| **Count** | Number of annotations to generate. Default: `10`.        |

### Exponential heatmap bucket data

Generates heatmap data with exponentially distributed bucket boundaries (1, 2, 4, 8, 16, ...). Use this to test heatmap panels with exponential distributions.

### Linear heatmap bucket data

Generates heatmap data with linearly distributed bucket boundaries (0, 10, 20, 30, ...). Use this to test heatmap panels with linear distributions.

## Streaming scenarios

These scenarios produce real-time streaming data.

### Streaming Client

Generates streaming data directly from the browser client.

| Field     | Description                                                                          |
| --------- | ------------------------------------------------------------------------------------ |
| **Type**  | Stream type: `Signal`, `Logs`, `Fetch`, `Traces`, or `Watch`.                       |

Additional fields depend on the selected type:

- **Signal:** Speed (ms), Spread, Noise, Bands.
- **Logs, Traces, Watch:** Speed (ms) only.
- **Fetch:** URL of a remote CSV endpoint to stream incrementally.

### Grafana Live

Connects to a Grafana Live channel that streams random data from the server.

| Channel                   | Description                              |
| ------------------------- | ---------------------------------------- |
| `random-2s-stream`        | Random stream with points every 2s.      |
| `random-flakey-stream`    | Stream that returns data at random intervals. |
| `random-labeled-stream`   | Value with moving labels.                |
| `random-20Hz-stream`      | Random stream with points at 20 Hz.      |

### Grafana API

Fetches data from internal Grafana API endpoints and returns the result as a data frame.

| Endpoint         | Description                             |
| ---------------- | --------------------------------------- |
| **Data Sources** | Lists configured data sources.          |
| **Search**       | Returns dashboard search results.       |
| **Annotations**  | Returns annotations.                    |

## Error and edge-case testing scenarios

These scenarios help test how Grafana handles errors, empty data, and slow responses.

### Conditional Error

Produces an error or data depending on the **String Input** field. When the field is empty, the scenario triggers a server panic. When the field contains CSV values (default: `1,20,90,30,5,0`), it behaves like the CSV Metric Values scenario.

| Field          | Description                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Error type** | Type of error to simulate: `Server panic`, `Frontend exception`, or `Frontend observable`.             |

### Error with source

Returns an error with a configurable source classification.

| Field            | Description                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **Error source** | Source of the error: `Plugin` (plugin error) or `Downstream` (downstream service error). |

Use this to test how Grafana differentiates between plugin errors and downstream errors in alerting and error handling.

### No Data Points

Returns an empty result with no data points. Use this to test how panels display when there's no data.

### Datapoints Outside Range

Returns a single data point with a timestamp one hour before the query time range. Use this to test how panels handle data outside the visible range.

### Slow Query

Introduces a configurable delay before returning random walk data. Set the delay duration in the **String Input** field using Go duration syntax (for example, `5s`, `1m`, `500ms`). Default: `5s`.

## Metadata scenarios

These scenarios return metadata rather than time-series data.

### Query Metadata

Returns a table with query metadata including the current user's username. Use this to verify that query context information is available.
