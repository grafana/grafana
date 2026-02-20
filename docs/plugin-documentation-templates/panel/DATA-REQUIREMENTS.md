# Data requirements

This guide explains the data requirements for [plugin name].

## Overview

[Plugin name] requires [description of the general data format, e.g., "time-series data with at least one numeric field" or "a dataset with one string field and at least one numeric field"].

## Required data format

To create a [plugin name] visualization, your dataset must contain:

- [Requirement 1, e.g., "At least one time field or string field"]
- [Requirement 2, e.g., "One or more numeric fields"]
- [Optional requirement or constraint]

## Supported data formats

The following sections show examples of supported data formats.

### Example 1: [Brief description]

[Explanation of this data format.]

| [Column 1] | [Column 2] | [Column 3] |
| ---------- | ---------- | ---------- |
| [value]    | [value]    | [value]    |
| [value]    | [value]    | [value]    |
| [value]    | [value]    | [value]    |

[Explain how this data is visualized, with reference to a screenshot if available.]

![Example 1 visualization](/path/to/example1.png)

### Example 2: [Brief description]

[Explanation of this data format.]

| [Column 1] | [Column 2] | [Column 3] | [Column 4] |
| ---------- | ---------- | ---------- | ---------- |
| [value]    | [value]    | [value]    | [value]    |
| [value]    | [value]    | [value]    | [value]    |
| [value]    | [value]    | [value]    | [value]    |

[Explain how this data is visualized.]

![Example 2 visualization](/path/to/example2.png)

### Example 3: [Brief description]

[Explanation of this data format and any special considerations.]

| [Column 1] | [Column 2] | [Column 3] |
| ---------- | ---------- | ---------- |
| [value]    | [value]    | [value]    |
| [value]    | [value]    | [value]    |
| [value]    | [value]    | [value]    |

[Explain how this data is visualized.]

![Example 3 visualization](/path/to/example3.png)

## Data frame structure

[If applicable, explain the data frame structure expected by the panel.]

A data frame resembles a table, where data is stored by columns (fields) instead of rows. Each value in a field shares the same data type, such as string, number, or time.

### Example data frame

| Time                | [Field name] | [Field name] |
| ------------------- | ------------ | ------------ |
| 2024-01-01 10:00:00 | [value]      | [value]      |
| 2024-01-01 11:00:00 | [value]      | [value]      |
| 2024-01-01 12:00:00 | [value]      | [value]      |

[Explain how the panel uses this data.]

## Field types

[Plugin name] supports the following field types:

| Field type | Description | Usage |
| ---------- | ----------- | ----- |
| **Time** | Timestamp field | [How it's used in the visualization] |
| **Number** | Numeric values | [How it's used in the visualization] |
| **String** | Text values | [How it's used in the visualization] |
| **Boolean** | True/false values | [How it's used in the visualization] |

## Multiple series

[Plugin name] [supports/does not support] multiple series in a single panel.

[If supported, explain how multiple series are displayed and any considerations.]

### Example with multiple series

[Show an example with multiple series if applicable.]

#### Query 1

| Time                | value1 | value2 |
| ------------------- | ------ | ------ |
| 2024-01-01 10:00:00 | [val]  | [val]  |
| 2024-01-01 11:00:00 | [val]  | [val]  |

#### Query 2

| Time                | value1 | value2 |
| ------------------- | ------ | ------ |
| 2024-01-01 10:00:00 | [val]  | [val]  |
| 2024-01-01 11:00:00 | [val]  | [val]  |

[Explain how multiple series are visualized.]

## Data transformations

You can use Grafana's data transformations to reshape your data before visualization.

Useful transformations for [plugin name] include:

- **[Transformation name]** - [When to use it]
- **[Transformation name]** - [When to use it]
- **[Transformation name]** - [When to use it]

For more information about data transformations, refer to [Transform data](https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/).

## Data source compatibility

[Plugin name] works with any Grafana data source that returns [description of compatible data format].

### Tested data sources

The plugin has been tested with:

- [Data source 1]
- [Data source 2]
- [Data source 3]
- TestData DB (for development and testing)

## Limitations

[Plugin name] has the following data limitations:

- [Limitation 1]
- [Limitation 2]
- [Limitation 3]

## Testing with sample data

You can test [plugin name] using the TestData DB data source:

1. Add a new panel to your dashboard.
1. Select **TestData DB** as the data source.
1. Choose a scenario that matches your data requirements.
1. Configure the panel using the sample data.

Recommended TestData DB scenarios:

- **[Scenario name]** - [Why it's useful]
- **[Scenario name]** - [Why it's useful]

## Next steps

- [Configure the panel](CONFIGURATION.md)
- [View configuration examples](README.md#quick-start)
- [Troubleshoot data issues](TROUBLESHOOTING.md)
