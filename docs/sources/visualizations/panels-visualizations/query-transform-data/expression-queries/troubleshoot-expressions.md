---
aliases:
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshoot expressions
title: Troubleshoot Grafana expressions
description: Debug and resolve common issues when working with Grafana Expressions
weight: 50
refs:
  grafana-expressions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/expression-queries/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/expression-queries/
  transformations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
---

# Troubleshoot Grafana expressions

This guide helps you diagnose and resolve common issues when working with expressions.

## Debug expressions

When an expression doesn't produce the expected results, use these strategies to identify the problem.

### Test expressions step by step

Break complex expressions into smaller pieces and verify each step:

1. **Test individual queries first:** Ensure each data source query returns the expected data before adding expressions.
1. **Add expressions incrementally:** Start with a simple expression and gradually add complexity.
1. **Use separate panels for testing:** Create a temporary panel to test expressions in isolation.
1. **Check intermediate results:** Add expressions at each step of your calculation to see intermediate values.

**Example:**

Instead of creating `($A - $B) / $C * 100` immediately, build it incrementally:

- Expression D: `$A - $B` (verify the subtraction works)
- Expression E: `$D / $C` (verify the division works)
- Expression F: `$E * 100` (final percentage)

Once working, you can collapse them into a single expression if desired.

### Verify RefID references

Ensure you're referencing the correct queries and expressions:

- RefIDs are case-sensitive: `$A` is different from `$a`
- Check that RefIDs haven't changed after reordering queries
- Use `${RefID}` syntax for RefIDs with spaces or special characters

### Check data types

Expressions expect specific data types. Verify your queries return time series or numbers, not tables or other formats.

**Common issues:**

- SQL queries returning multiple columns (expressions need one value column)
- Queries returning string data instead of numbers
- Empty result sets that appear as NoData

### Inspect labels

Use the Table view in panels to see the labels on your series and verify they match as expected.

**What to check:**

- Do series from different queries have compatible labels for joining?
- Are label names spelled consistently across queries?
- Are there unexpected extra labels preventing matches?

## Common errors and solutions

Following are common errors and how to troubleshoot them.

### "NoData" result

**Problem:** Your expression returns NoData even though some queries have data.

**Causes and solutions:**

- **One query returns no data:** If any query in an expression returns NoData, the entire expression returns NoData. Check that all queries have data for the selected time range.
- **Mismatched time ranges:** Ensure all queries use compatible time ranges. A query with "Last 5 minutes" can't combine with a query using "Last 24 hours" without adjustments.
- **Backend data source required:** Expressions only work with backend data sources. Check that you're not using browser-based data sources.

**Solution:**

Test each query independently to identify which one returns NoData, then investigate why that query has no data.

### No series match in math operations

**Problem:** Math expression like `$A + $B` returns no data, but both queries return data.

**Causes and solutions:**

- **Label mismatch:** Series from `$A` and `$B` have different labels that prevent automatic matching.

  **Example:** `$A` has `{host="web01", region="us-east"}` but `$B` has `{server="web01", region="us-east"}`. The different label names (`host` vs `server`) prevent matching.

  **Solution:** Modify your queries to use consistent label names, or ensure one set of series has no labels (which matches anything).

- **No overlapping timestamps:** Time series need matching timestamps for math operations.

  **Solution:** Use the Resample operation to align timestamps to a common interval.

### Timestamp mismatch errors

**Problem:** Combining results from multiple SQL queries fails because timestamps don't align.

**Example:**

```sql
-- Query A
SELECT NOW() AS "time", COUNT(*) as "errors" FROM error_log;

-- Query B
SELECT NOW() AS "time", COUNT(*) as "requests" FROM request_log;
```

These queries may execute at slightly different times, producing different timestamps.

**Solution 1 - Use fixed timestamps:**

```sql
-- Query A
SELECT 1 AS "time", COUNT(*) as "errors" FROM error_log;

-- Query B
SELECT 1 AS "time", COUNT(*) as "requests" FROM request_log;
```

**Solution 2 - Use consistent time references:**

Ensure all queries evaluate time identically by using the same timestamp variable or function.

**Solution 3 - Use Resample:**

Add Resample operations to align both series to a common interval before performing math.

### Math operations produce unexpected nulls or NaN

**Problem:** Expression results contain null or NaN values unexpectedly.

**Causes and solutions:**

- **Division by zero:** Dividing by zero produces infinity. Use conditional logic: `$A > 0 ? $B / $A : 0`
- **Logarithm of negative numbers:** `log()` of negative values returns NaN.
- **Operations on null values:** Math operations involving null typically produce null.

**Solution:**

Use data quality functions to filter or handle problematic values:

```
is_number($A) ? $A : 0
```

Or use Reduce with "Drop non-numeric" mode to clean data before calculations.

### Reduce returns NaN in strict mode

**Problem:** Reduce operation returns NaN even though most data points are valid.

**Cause:** Strict mode returns NaN if _any_ value in the series is null, NaN, or infinity.

**Solution:**

Change the reduction mode:

- **Drop non-numeric:** Ignores invalid values and calculates from valid ones
- **Replace non-numeric:** Substitutes a specific value for invalid data points

Use Strict mode only when data quality is critical and you want to know if any values are invalid.

### Expression works in panel but fails in alerting

**Problem:** Expression displays correctly in a panel but produces errors or unexpected results in alert rules.

**Causes and solutions:**

- **Time range differences:** Alerts use specific time ranges that may differ from your panel's time range. Verify the alert's time range settings.
- **Data availability:** Data may be available when viewing the panel but missing when the alert evaluates.
- **Reduce required for alerting:** Most alert conditions need single values. Ensure you're using Reduce to convert time series to numbers for threshold comparisons.

**Solution:**

Test your expression in a panel using the same time range as your alert rule.

## Work with timestamps

Timestamps can be a common source of issues when working with expressions. Here's how to handle them effectively.

### Understand timestamp alignment

Math operations between time series require matching timestamps. If series `$A` has points at `10:00:00`, `10:00:30`, `10:01:00` and series `$B` has points at `10:00:15`, `10:00:45`, `10:01:15`, the operation `$A + $B` produces no results because no timestamps match exactly.

### When to resample

Use Resample when:

- Combining data from sources with different collection intervals
- One data source reports irregularly while another reports at fixed intervals
- You need to ensure timestamps align for math operations
- You want to normalize data to a consistent interval for visualization

### Resample strategies

**Downsample (reducing frequency):**

When going from higher to lower frequency (for example, 10s intervals to 1m intervals), choose an appropriate reduction function:

- **Mean:** For averaging values (CPU percentage, temperature)
- **Max:** For peak values (maximum memory usage)
- **Min:** For minimum values (lowest throughput)
- **Sum:** For accumulating values (request counts, error totals)

**Upsample (increasing frequency):**

When going from lower to higher frequency (for example, 1m intervals to 10s intervals), choose a fill strategy:

- **Pad (forward fill):** Assumes value stays constant until next measurement (good for state data)
- **Backfill:** Uses next known value (less common, use when future values inform past state)
- **fillna:** Inserts NaN for unknown intervals (explicit about missing data)

### SQL timestamp best practices

When writing SQL queries for use with expressions:

**Do:**

- Use consistent timestamp columns across queries
- Round or truncate timestamps to a common interval if needed
- Use fixed timestamps for non-time-based aggregations

```sql
-- Good: Consistent time bucket
SELECT
  DATE_TRUNC('minute', timestamp) AS "time",
  COUNT(*) as "value"
FROM events
GROUP BY 1
ORDER BY 1;
```

**Don't:**

- Use `NOW()` or `CURRENT_TIMESTAMP` which vary between query executions
- Mix different timestamp columns in related queries
- Return data without a time column for time series expressions

## Handle missing data

Understanding how expressions handle missing data helps you build robust dashboards and alerts.

### NoData propagation

When any query in an expression returns NoData, the entire expression result is NoData. This is by design to prevent calculations on incomplete data.

**Example:**

```
Expression: $A / $B
- Query A returns: 100
- Query B returns: NoData
- Expression result: NoData (not 100, not error)
```

### Strategies for missing data

**1. Use default values:**

Modify your data source queries to return zero or a default value instead of no data.

**2. Build conditional logic:**

Use multiple expressions to check for data availability before performing calculations.

**3. Adjust time ranges:**

Ensure queries use time ranges likely to have data. If a service only reports every 5 minutes, don't query the last 1 minute.

**4. Configure alert NoData handling:**

In alerting, you can configure how NoData is treated (for example, trigger alert, don't trigger, or mark as special state).

### Missing data points vs NoData

**Missing data points:** Some points in a time series are null or absent, but the series exists.

- Handle with Reduce modes (Drop non-numeric, Replace non-numeric)
- Use data quality functions: `is_null($A)`, `is_number($A)`

**NoData:** No series returned at all from a query.

- Check query syntax and time range
- Verify data exists in the data source
- Ensure data source is reachable

## Performance considerations

Expressions run on the Grafana server, so understanding performance implications helps you build efficient dashboards and alerts.

### When expressions are inefficient

**Large data volumes:**

- Pulling millions of data points to Grafana for simple aggregations
- Better: Perform aggregation in the data source query

**Repeated operations:**

- Running the same calculation across many panels
- Better: Consider recording rules (Prometheus) or continuous queries (InfluxDB)

**Complex nested expressions:**

- Long chains of expressions that could be simplified
- Better: Simplify the expression or move logic to data source

### Optimization strategies

**1. Push processing to data sources:**

Instead of:

```
Query A: SELECT value FROM metrics
Expression B: Reduce(Mean, $A)
Expression C: $B > 100
```

Do in data source:

```
Query A: SELECT AVG(value) FROM metrics
Expression B: $A > 100
```

**2. Use appropriate time ranges:**

- Don't query years of data when hours suffice
- Match time ranges to your actual analysis needs
- Use relative time ranges for consistent performance

**3. Reduce data points before math:**

If you only need a single value for alerting, reduce first then perform math rather than calculating across every point:

**Less efficient:**

```
Expression A: $QueryA * 100 (multiplies every point)
Expression B: Reduce(Mean, $A)
```

**More efficient:**

```
Expression A: Reduce(Mean, $QueryA)
Expression B: $A * 100 (multiplies one value)
```

**4. Limit label cardinality:**

High-cardinality labels (many unique values) multiply the number of series. If querying metrics with thousands of unique host labels, consider aggregating in the data source.

### Monitor expression performance

Watch for these warning signs:

- Panels take more than 2-3 seconds to load
- Query inspector shows expressions processing thousands of series
- Grafana server CPU spikes when loading dashboards
- Alert evaluation takes significant time

If you see these issues, review your expressions for optimization opportunities.

## Expressions vs transformations

Both expressions and transformations manipulate query data, but they serve different purposes and have different capabilities.

### When to use expressions

Use expressions when:

- **Server-side processing required:** Alerting requires server-side evaluation
- **Cross-data-source operations:** Combining data from different data sources
- **Label-based matching:** Automatic series matching based on labels
- **Simple math and aggregations:** Basic calculations and reductions
- **Backend data sources:** Working with backend/server-side data sources

**Advantages:**

- Work in alerting rules
- Operate on data before visualization
- Support cross-data-source calculations
- Preserve label-based series relationships

**Limitations:**

- Only work with backend data sources
- Limited operation types (Math, Reduce, Resample)
- Less flexible than transformations for complex data reshaping
- Can't modify table structures significantly

### When to use transformations

Use transformations when:

- **Complex data reshaping:** Pivoting, merging, or restructuring data
- **Table operations:** Working with tabular data formats
- **Field manipulation:** Renaming, organizing, or filtering fields
- **Client-side only needed:** Visualization changes that don't affect alerting
- **Advanced processing:** Operations not available in expressions

**Advantages:**

- More operation types available
- Better for complex table manipulations
- Work with any data source (including browser-based)
- More flexible field and column operations
- Can dramatically reshape data structures

**Limitations:**

- Don't work in alerting (client-side only)
- Can't combine different data sources
- Process data after query execution
- Don't preserve complex label relationships

### Comparison table

| Feature               | Expressions                      | Transformations        |
| --------------------- | -------------------------------- | ---------------------- |
| Works in alerts       | Yes                              | No                     |
| Combines data sources | Yes                              | No                     |
| Available operations  | 3 types (Math, Reduce, Resample) | 20+ types              |
| Execution             | Server-side                      | Client-side (browser)  |
| Data source support   | Backend only                     | All data sources       |
| Label matching        | Automatic                        | Manual                 |
| Table operations      | Limited                          | Extensive              |
| Performance           | Uses server resources            | Uses browser resources |

### Use both together

You can use expressions and transformations in the same panel:

1. Expressions run first (server-side)
1. Transformations run after (client-side)

**Example workflow:**

- Query A: Prometheus metric
- Query B: SQL query
- Expression C: Combine `$A` and `$B` (server-side)
- Transformation: Rename fields, organize columns (client-side)

This approach lets you leverage the strengths of both systems.

### Migration considerations

**From transformations to expressions:**

Consider this when:

- You need the same logic in alerting
- You're combining data sources
- Server-side processing would improve performance

**Limitations:**

- May need to redesign complex transformations
- Some transformation operations have no expression equivalent
- Need backend data sources

**From expressions to transformations:**

Consider this when:

- You need more complex data manipulation
- You're working with browser-based data sources
- You need advanced table operations

**Limitations:**

- Can't use in alerting
- Can't combine different data sources
- May need to change query structure

## Get help

If you're still experiencing issues after trying these troubleshooting steps:

1. **Check the Query Inspector:** Click the Query Inspector button to see raw query results and expression outputs
1. **Review Grafana logs:** Server-side expression errors appear in Grafana server logs
1. **Simplify and isolate:** Create a minimal example that reproduces the issue
1. **Community resources:** Search or post in the Grafana community forums
1. **Documentation:** Refer to [Grafana Expressions](ref:grafana-expressions) for detailed operation documentation

When asking for help, include:

- Grafana version
- Data source type and version
- Simplified example of your queries and expressions
- Expected vs actual results
- Any error messages from Query Inspector or logs
