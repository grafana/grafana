---
description: Use the OpenTSDB query editor in Grafana
keywords:
  - grafana
  - opentsdb
  - query
  - editor
  - metrics
  - filters
  - tags
  - downsampling
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: OpenTSDB query editor
weight: 200
last_reviewed: 2026-01-28
refs:
  troubleshooting-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/troubleshooting/
  template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# OpenTSDB query editor

The query editor allows you to build OpenTSDB queries visually. The available options depend on the OpenTSDB version you configured for the data source.

## Access the query editor

The OpenTSDB query editor is located on the [Explore](ref:explore) page. You can also access the OpenTSDB query editor from a dashboard panel. Click the ellipsis in the upper right of the panel and select **Edit**.

## Create a query

To create a query:

1. Select the **OpenTSDB** data source in a panel.
1. Configure the query using the sections described in the following documentation.

## Metric section

The Metric section contains the core query configuration:

| Field          | Description                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------- |
| **Metric**     | The metric name to query. Start typing to see autocomplete suggestions from your OpenTSDB server. |
| **Aggregator** | The aggregation function to combine multiple time series. Default: `sum`.                         |
| **Alias**      | Custom display name for the series. Use `$tag_<tagname>` to include tag values in the alias.      |

### Alias patterns

The alias field supports dynamic substitution using tag values. Use the pattern `$tag_<tagname>` where `<tagname>` is the name of a tag on your metric.

| Pattern                | Description                         | Example output             |
| ---------------------- | ----------------------------------- | -------------------------- |
| `$tag_host`            | Inserts the value of the `host` tag | `webserver01`              |
| `$tag_env`             | Inserts the value of the `env` tag  | `production`               |
| `$tag_host - CPU`      | Combines tag value with static text | `webserver01 - CPU`        |
| `$tag_host ($tag_env)` | Multiple tag substitutions          | `webserver01 (production)` |

## Downsample section

Downsampling reduces the number of data points returned by aggregating values over time intervals. This improves query performance and reduces the amount of data transferred.

| Field                    | Description                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Interval**             | The time interval for downsampling. Leave blank to use the automatic interval based on the panel's time range and width. |
| **Aggregator**           | The aggregation function for downsampling. Default: `avg`.                                                               |
| **Fill**                 | (Version 2.2+) The fill policy for missing data points. Default: `none`.                                                 |
| **Disable downsampling** | Toggle to disable downsampling entirely. Use this when you need raw data points.                                         |

### Interval format

The interval field accepts time duration strings:

| Format | Description | Example |
| ------ | ----------- | ------- |
| `s`    | Seconds     | `30s`   |
| `m`    | Minutes     | `5m`    |
| `h`    | Hours       | `1h`    |
| `d`    | Days        | `1d`    |
| `w`    | Weeks       | `1w`    |

When the interval is left blank, Grafana automatically calculates an appropriate interval based on the panel's time range and pixel width. This ensures optimal data density for visualization.

## Filters section

Filters (available in OpenTSDB 2.2+) provide advanced filtering capabilities that replace the legacy tag-based filtering.

| Field        | Description                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| **Key**      | The tag key to filter on. Select from autocomplete suggestions or type a custom value.                          |
| **Type**     | The filter type. Determines how the filter value is matched. Default: `iliteral_or`.                            |
| **Filter**   | The filter value or pattern. Supports autocomplete for tag values.                                              |
| **Group by** | Toggle to group results by this tag key. When enabled, separate time series are returned for each unique value. |

### Add, edit, and remove filters

To manage filters:

1. Click the **+** button next to "Filters" to add a new filter.
1. Configure the filter fields (Key, Type, Filter, Group by).
1. Click **add filter** to apply the filter.
1. To edit an existing filter, click the **pencil** icon next to it.
1. To remove a filter, click the **x** icon next to it.

You can add multiple filters to a single query. All filters are combined with AND logic.

### Filter types

| Type              | Description                                                | Example               |
| ----------------- | ---------------------------------------------------------- | --------------------- |
| `literal_or`      | Matches exact values. Use `\|` to specify multiple values. | `web01\|web02\|web03` |
| `iliteral_or`     | Case-insensitive literal match.                            | `WEB01\|web02`        |
| `wildcard`        | Matches using `*` as a wildcard character.                 | `web-*-prod`          |
| `iwildcard`       | Case-insensitive wildcard match.                           | `WEB-*`               |
| `regexp`          | Matches using regular expressions.                         | `web-[0-9]+`          |
| `not_literal_or`  | Excludes exact values.                                     | `web01\|web02`        |
| `not_iliteral_or` | Case-insensitive exclusion.                                | `TEST\|DEV`           |

### Group by behavior

When **Group by** is enabled for a filter:

- Results are split into separate time series for each unique value of the filtered tag.
- Each time series is labeled with its tag value.
- This is useful for comparing values across hosts, environments, or other dimensions.

When **Group by** is disabled:

- All matching time series are combined using the selected aggregator.
- A single aggregated time series is returned.

## Tags section

Tags filter metrics by key-value pairs. This is the legacy filtering method for OpenTSDB versions prior to 2.2.

| Field     | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| **Key**   | The tag key to filter on. Select from autocomplete suggestions.   |
| **Value** | The tag value to match. Use `*` to match all values for this key. |

### Add, edit, and remove tags

To manage tags:

1. Click the **+** button next to "Tags" to add a new tag.
1. Select or type a tag key.
1. Select or type a tag value (use `*` for wildcard).
1. Click **add tag** to apply the tag filter.
1. To edit an existing tag, click the **pencil** icon next to it.
1. To remove a tag, click the **x** icon next to it.

{{< admonition type="note" >}}
Tags are deprecated in OpenTSDB 2.2 and later. Use Filters instead for more powerful filtering options including wildcards, regular expressions, and exclusion patterns.
{{< /admonition >}}

{{< admonition type="caution" >}}
Tags and Filters are mutually exclusive. If you have filters defined, you cannot add tags, and vice versa. The query editor displays a warning if you attempt to use both.
{{< /admonition >}}

## Rate section

The Rate section computes the rate of change, which is essential for counter metrics that continuously increment.

| Field             | Description                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **Rate**          | Toggle to enable rate calculation. Computes the per-second rate of change between consecutive values.      |
| **Counter**       | (When Rate is enabled) Toggle to indicate the metric is a monotonically increasing counter that may reset. |
| **Counter max**   | (When Counter is enabled) The maximum value before the counter wraps around.                               |
| **Reset value**   | (When Counter is enabled) The value the counter resets to after wrapping. Default: `0`.                    |
| **Explicit tags** | (Version 2.3+) Toggle to require all specified tags to exist on matching time series.                      |

### When to use rate calculation

Enable **Rate** when your metric is a continuously increasing counter, such as:

- Network bytes sent/received
- Request counts
- Error counts
- Disk I/O operations

The rate calculation converts cumulative values into per-second rates, making the data more meaningful for visualization.

### Counter settings

Enable **Counter** when your metric can reset to zero (for example, after a service restart). The counter settings help OpenTSDB calculate correct rates across resets:

- **Counter max**: Set this to the maximum value your counter can reach before wrapping. For 64-bit counters, use `18446744073709551615`. For 32-bit counters, use `4294967295`.
- **Reset value**: The value the counter resets to, typically `0`.

### Explicit tags

When **Explicit tags** is enabled (version 2.3+), OpenTSDB only returns time series that have all the tags specified in your query. This prevents unexpected results when some time series are missing tags that others have.

## Aggregators

The aggregator function combines multiple time series into one. Grafana fetches the list of available aggregators from your OpenTSDB server, so you may see additional aggregators beyond those listed here.

### Common aggregators

| Aggregator | Description                               | Use case                               |
| ---------- | ----------------------------------------- | -------------------------------------- |
| `sum`      | Sum all values at each timestamp.         | Total requests across all servers.     |
| `avg`      | Average all values at each timestamp.     | Average CPU usage across hosts.        |
| `min`      | Take the minimum value at each timestamp. | Lowest response time.                  |
| `max`      | Take the maximum value at each timestamp. | Peak memory usage.                     |
| `dev`      | Calculate the standard deviation.         | Measure variability in response times. |
| `count`    | Count the number of data points.          | Number of reporting hosts.             |

### Interpolation aggregators

These aggregators handle missing data points differently:

| Aggregator | Description                                          |
| ---------- | ---------------------------------------------------- |
| `zimsum`   | Sum values, treating missing data as zero.           |
| `mimmin`   | Minimum value, ignoring missing (interpolated) data. |
| `mimmax`   | Maximum value, ignoring missing (interpolated) data. |

{{< admonition type="note" >}}
The available aggregators depend on your OpenTSDB server version and configuration. The aggregator dropdown is populated dynamically from the `/api/aggregators` endpoint on your OpenTSDB server.
{{< /admonition >}}

## Fill policies

Fill policies (available in OpenTSDB 2.2+) determine how to handle missing data points during downsampling. This is important when your data has gaps or irregular collection intervals.

| Policy | Description                                         | Use case                                                    |
| ------ | --------------------------------------------------- | ----------------------------------------------------------- |
| `none` | Don't fill missing values. Gaps remain in the data. | Default behavior; preserves data fidelity.                  |
| `nan`  | Fill missing values with NaN (Not a Number).        | Useful for calculations that should propagate missing data. |
| `null` | Fill missing values with null.                      | Visualizations show gaps at null points.                    |
| `zero` | Fill missing values with zero.                      | Treat missing data as zero values; useful for counters.     |

### Choose the right fill policy

- Use `none` (default) when you want to see actual data gaps in your visualizations.
- Use `null` when you want graphs to show breaks at missing data points.
- Use `zero` when missing data should be interpreted as zero (for example, no requests during a period).
- Use `nan` when you need missing values to propagate through calculations.

## Autocomplete suggestions

The query editor provides autocomplete suggestions to help you build queries quickly and accurately.

### What autocomplete provides

| Field           | Source                      | Description                                     |
| --------------- | --------------------------- | ----------------------------------------------- |
| **Metric**      | `/api/suggest?type=metrics` | Suggests metric names as you type.              |
| **Tag keys**    | Previous query results      | Suggests tag keys based on the selected metric. |
| **Tag values**  | `/api/suggest?type=tagv`    | Suggests tag values as you type.                |
| **Filter keys** | Previous query results      | Suggests tag keys for filter configuration.     |

### Autocomplete requirements

For autocomplete to work:

- The OpenTSDB suggest API must be enabled on your server.
- Metrics must exist in your OpenTSDB database.
- The **Lookup limit** setting in your data source configuration controls the maximum number of suggestions returned.

If autocomplete isn't working, refer to [Troubleshooting](ref:troubleshooting-opentsdb).

## Use template variables

You can use template variables in any text field in the query editor. Template variables are replaced with their current values when the query executes.

Common uses include:

- **Metric field**: `$metric` to dynamically select metrics.
- **Filter values**: `$host` to filter by a variable-selected host.
- **Tag values**: `$environment` to filter by environment.

For more information about creating and using template variables, refer to [Template variables](ref:template-variables).

## Query examples

The following examples demonstrate common query patterns.

### Basic metric query with tag filtering

| Field      | Value              |
| ---------- | ------------------ |
| Metric     | `sys.cpu.user`     |
| Aggregator | `avg`              |
| Tags       | `host=webserver01` |

This query returns the average CPU usage for the host `webserver01`.

### Query with wildcard filter (OpenTSDB 2.2+)

| Field        | Value                 |
| ------------ | --------------------- |
| Metric       | `http.requests.count` |
| Aggregator   | `sum`                 |
| Filter Key   | `host`                |
| Filter Type  | `wildcard`            |
| Filter Value | `web-*`               |
| Group by     | enabled               |

This query sums HTTP request counts across all hosts matching `web-*` and groups results by host.

### Rate calculation for network counters

| Field       | Value                  |
| ----------- | ---------------------- |
| Metric      | `net.bytes.received`   |
| Aggregator  | `sum`                  |
| Rate        | enabled                |
| Counter     | enabled                |
| Counter max | `18446744073709551615` |

This query calculates the rate of bytes received per second. The counter max is set to the 64-bit unsigned integer maximum to handle counter wraps correctly.

### Using alias patterns

| Field      | Value                       |
| ---------- | --------------------------- |
| Metric     | `app.response.time`         |
| Aggregator | `avg`                       |
| Tags       | `host=*`, `env=production`  |
| Alias      | `$tag_host - Response Time` |

This query uses the alias pattern to create readable legend labels like `webserver01 - Response Time`.

### Downsampling with custom interval

| Field                 | Value               |
| --------------------- | ------------------- |
| Metric                | `sys.disk.io.bytes` |
| Aggregator            | `sum`               |
| Downsample Interval   | `5m`                |
| Downsample Aggregator | `avg`               |
| Fill                  | `zero`              |

This query downsamples disk I/O data to 5-minute averages, filling gaps with zero values.

### Compare environments with filters

| Field        | Value                 |
| ------------ | --------------------- |
| Metric       | `app.errors.count`    |
| Aggregator   | `sum`                 |
| Filter Key   | `env`                 |
| Filter Type  | `literal_or`          |
| Filter Value | `staging\|production` |
| Group by     | enabled               |

This query shows error counts for both staging and production environments as separate time series for comparison.

### Exclude specific hosts

| Field        | Value                     |
| ------------ | ------------------------- |
| Metric       | `sys.cpu.user`            |
| Aggregator   | `avg`                     |
| Filter Key   | `host`                    |
| Filter Type  | `not_literal_or`          |
| Filter Value | `test-server\|dev-server` |
| Group by     | enabled                   |

This query shows CPU usage for all hosts except test-server and dev-server.

### Query with explicit tags (version 2.3+)

| Field         | Value                 |
| ------------- | --------------------- |
| Metric        | `app.request.latency` |
| Aggregator    | `avg`                 |
| Filter Key    | `host`                |
| Filter Type   | `wildcard`            |
| Filter Value  | `*`                   |
| Group by      | enabled               |
| Explicit tags | enabled               |

This query only returns time series that have the `host` tag defined, excluding any time series that are missing this tag.

## Next steps

- [Use template variables](ref:template-variables) to create dynamic, reusable dashboards.
- [Set up alerting](ref:alerting) to get notified when metrics cross thresholds.
- [Troubleshoot issues](ref:troubleshooting-opentsdb) if you encounter problems with queries.
