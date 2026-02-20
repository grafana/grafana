---
aliases:
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Create and use expressions
title: Create and use expressions
description: Learn how to create expressions and use Math, Reduce, and Resample operations
weight: 41
refs:
  multiple-dimensional-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries-dimensions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries-dimensions/
  grafana-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
---

# Create and use expressions

Expressions are most commonly used for [Grafana Alerting](ref:grafana-alerting), where server-side processing ensures alerts continue working even when no user is viewing a dashboard.
You can also use expressions with backend data sources in visualizations.

## Understand expression data

Before creating expressions, understand the data types and special values you'll work with.

### Data types

Expressions work with two types of data from backend data sources:

- **Time series:** Collections of timestamped values, typically returned by time series databases like Prometheus or InfluxDB.
- **Numbers:** Individual numeric values, such as aggregated results from SQL queries or reduced time series.

Expressions also operate on [multiple-dimensional data](ref:multiple-dimensional-data), where each series or number is identified by labels or tags.
For example, a single query can return CPU metrics for multiple hosts, with each series labeled by its hostname.

### Special values

When working with expressions, you'll encounter special values that represent problematic or undefined data:

- **null:** Represents missing or absent data. Common when a data point doesn't exist or wasn't recorded.
- **NaN (Not a Number):** Represents an undefined or invalid mathematical result, such as dividing zero by zero or taking the logarithm of a negative number. NaN is unique because it doesn't equal itself, which is why expressions include the `is_nan()` function.
- **Infinity (Inf):** Represents values too large to represent as numbers. Can be positive (`Inf`) or negative (`-Inf`). Often results from dividing by zero.

Expressions provide functions like `is_null()`, `is_nan()`, `is_inf()`, and `is_number()` to detect and handle these special values in your data.

### Reference queries and expressions

Each query or expression in Grafana has a unique identifier called a RefID (Reference ID).
RefIDs appear as letters (`A`, `B`, `C`) or custom names in the query editor, and they let you reference the output of one query in another expression.

To use a query or expression in a math operation, prefix its RefID with a dollar sign: `$A`, `$B`, `$C`.

**Example:**

If query `A` returns CPU usage and query `B` returns CPU capacity, you can create an expression `$A / $B * 100` to calculate CPU percentage.
The expression automatically uses the data from queries A and B based on their RefIDs.

## Create an expression

To add an expression to a panel:

1. Open the panel in edit mode.
1. Below your existing queries, click **Expression**.
1. In the **Operation** field, select **Math**, **Reduce**, or **Resample**.
1. Configure the expression based on the operation type.
1. Click **Apply** to save your changes.

The expression appears in your query list with its own RefID and can be referenced by other expressions.

## Expression operations

Expressions provide three core operations that you can combine to transform your data: Math, Reduce, and Resample.
Each operation solves specific data transformation challenges.

### Math

Math operations let you perform calculations on your query results using standard arithmetic, comparison, and logical operators.
Use math expressions to derive new metrics, calculate percentages, or implement conditional logic.

**Common use cases:**

- Calculate error rates: `$errors / $total_requests * 100`
- Convert units: `$bytes / 1024 / 1024` (bytes to megabytes)
- Implement thresholds: `$cpu_usage > 80` (returns 1 for true, 0 for false)
- Calculate capacity remaining: `$max_capacity - $current_usage`

#### Syntax and operators

Reference queries and expressions using their RefID prefixed with a dollar sign: `$A`, `$B`, `$C`.
If a RefID contains spaces, use brace syntax: `${my query}`.

**Supported operators:**

- **Arithmetic:** `+`, `-`, `*`, `/`, `%` (modulo), `**` (exponent)
- **Comparison:** `<`, `>`, `==`, `!=`, `>=`, `<=` (return 1 for true, 0 for false)
- **Logical:** `&&` (and), `||` (or), `!` (not)

**Numeric constants:**

- Decimal: `2.24`, `-0.8e-2`
- Octal: `072` (leading zero)
- Hexadecimal: `0x2A` (leading 0x)

#### How operations work with different data types

Math operations behave differently depending on whether you're working with numbers or time series:

- **Number + Number:** Performs the operation on the two values. Example: `5 + 3 = 8`
- **Number + Time series:** Applies the operation to every point in the series. Example: `$cpu_series * 100` multiplies each CPU value by 100
- **Time series + Time series:** Performs the operation on matching timestamps. Example: `$series_A + $series_B` adds values at each timestamp that exists in both series

If time series have different timestamps, use the Resample operation to align them first.

#### Label-based series matches

When working with multiple series, expressions automatically match series based on their labels.
If query `$A` returns CPU usage for multiple hosts (each with a `{host=...}` label) and query `$B` returns memory usage for the same hosts, the expression `$A + $B` automatically matches each host's CPU and memory values.

**Matching rules:**

- Series with identical labels match automatically
- A series with no labels matches any other series
- Series with subset labels match (for example, `{host=web01}` matches `{host=web01, region=us-east}`)
- If both variables contain only one series, they always match

#### Available functions

Math expressions include functions for common operations and data quality checks.
All functions work with both individual numbers and time series.

**Mathematical functions:**

- `abs(x)` - Returns absolute value. Example: `abs($temperature_diff)`
- `log(x)` - Returns natural logarithm. Returns NaN for negative values. Example: `log($growth_rate)`
- `round(x)` - Rounds to nearest integer. Example: `round($average)`
- `ceil(x)` - Rounds up to nearest integer. Example: `ceil(3.2)` returns `4`
- `floor(x)` - Rounds down to nearest integer. Example: `floor(3.8)` returns `3`

**Data quality functions:**

These functions help you detect and handle problematic values in your data:

- `is_number(x)` - Returns 1 for valid numbers, 0 for null, NaN, or infinity. Example: `is_number($A)`
- `is_null(x)` - Returns 1 for null values, 0 otherwise. Example: `is_null($A)`
- `is_nan(x)` - Returns 1 for NaN values, 0 otherwise. Useful because NaN doesn't equal itself. Example: `is_nan($A)`
- `is_inf(x)` - Returns 1 for positive or negative infinity, 0 otherwise. Example: `is_inf($A)`

**Test functions:**

- `null()`, `nan()`, `inf()`, `infn()` - Return the named special value. Primarily for testing.

### Reduce

Reduce operations convert time series into single numeric values while preserving their labels.
Use reduce to create summary statistics, single-value panels, or alert conditions based on time series data.

**Common use cases:**

- Create alert thresholds: Reduce CPU time series to average and alert if it exceeds 80%
- Display current values: Show the last recorded temperature from a sensor
- Calculate totals: Sum all errors across a time range
- Find extremes: Identify maximum memory usage in the last hour

**Available reduction functions:**

- **Last:** Returns the most recent value. Useful for "current state" displays.
- **Mean:** Returns the average of all values. Use for typical behavior over time.
- **Min / Max:** Returns the smallest or largest value. Useful for capacity planning or finding anomalies.
- **Sum:** Returns the total of all values. Useful for counting events or totaling metrics.
- **Count:** Returns the number of data points. Useful for checking data completeness.

**Example:**

If query `$A` returns CPU usage time series for three hosts over the last hour, applying `Reduce(Mean)` produces three numbers: the average CPU for each host, each labeled with its hostname.

#### Handle non-numeric values

Reduce operations let you control how null, NaN, and infinity values are handled:

- **Strict:** Returns NaN if any non-numeric values exist. Use when data quality is critical.
- **Drop non-numeric:** Filters out problematic values before calculating. Use when occasional bad data points are acceptable.
- **Replace non-numeric:** Replaces bad values with a specified number. Use when you want to substitute a default value.

### Resample

Resample operations align time series to a consistent time interval, enabling you to perform math operations between series with mismatched timestamps.

**Why resample:**

When combining time series from different data sources, their timestamps rarely align perfectly.
One series might report every 15 seconds while another reports every minute.
Resampling normalizes both series to the same interval so you can add, subtract, or compare them.

**Example use case:**

You want to calculate `$errors / $requests` but your error logs report every 10 seconds while your request metrics report every 30 seconds.
Resample both series to 30-second intervals, then perform the division.

**Configuration:**

- **Resample to:** The target interval. Use `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks), or `y` (years). Example: `10s`, `1m`, `1h`
- **Downsample:** How to handle multiple data points in one interval. Choose a reduction function like Mean, Max, Min, or Sum. Example: If resampling from 10s to 30s intervals and you have 3 values, Mean averages them.
- **Upsample:** How to fill intervals with no data points:
  - **Pad:** Uses the last known value (forward fill)
  - **Backfill:** Uses the next known value (backward fill)
  - **fillna:** Inserts NaN for missing intervals

## Best practices

Follow these guidelines to build efficient and maintainable expressions.

### Process data in the data source when possible

Perform aggregations, filtering, and complex calculations inside your data source rather than in expressions when you can.
Data sources are optimized for processing their own data, and moving large volumes of data to Grafana for simple operations is inefficient.

**Use expressions for:**

- Operations your data source doesn't support
- Cross-data-source calculations
- Lightweight post-processing
- Alerting logic that needs server-side evaluation

**Avoid expressions for:**

- Simple aggregations your data source can perform
- Processing millions of data points
- Operations that could be handled by recording rules or continuous queries

### Understand backend data source requirements

Expressions only work with backend (server-side) data sources. Browser-based data sources can't be used in expressions.

**Supported:** Prometheus, Loki, InfluxDB, MySQL, PostgreSQL, CloudWatch, and other backend data sources.

**Not supported:** TestData, browser-based plugins, or client-side data sources.

### Use alerting-compatible configurations

Expressions work differently in alerting contexts than in panels:

- Alerting requires expressions to evaluate server-side.
- Most alert conditions need single values (use Reduce operations).
- Test your expressions with the same time ranges your alerts will use.
- Legacy dashboard alerts don't support expressions - use [Grafana Alerting](ref:grafana-alerting) instead.
