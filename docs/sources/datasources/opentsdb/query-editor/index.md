---
aliases:
  - ../../data-sources/opentsdb/query-editor/
description: Use the OpenTSDB query editor in Grafana
keywords:
  - grafana
  - opentsdb
  - query
  - editor
  - metrics
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
---

# OpenTSDB query editor

The query editor allows you to build OpenTSDB queries visually. The available options depend on the OpenTSDB version you configured for the data source.

## Create a query

To create a query:

1. Select the **OpenTSDB** data source in a panel.
1. Configure the query using the sections described in the following documentation.

## Metric section

The Metric section contains the core query configuration:

| Field | Description |
| ----- | ----------- |
| **Metric** | The metric name to query. Start typing to see autocomplete suggestions. |
| **Aggregator** | The aggregation function to combine multiple time series. |
| **Alias** | Custom display name for the series. Use `$tag_<tagname>` to include tag values in the alias (for example, `$tag_host` inserts the host tag value). |

## Downsample section

Downsampling reduces the number of data points returned by aggregating values over time intervals:

| Field | Description |
| ----- | ----------- |
| **Interval** | The time interval for downsampling (for example, `1m`, `5m`, `1h`). Leave blank to use the automatic interval based on the panel's time range. |
| **Aggregator** | The aggregation function for downsampling. |
| **Fill** | (Version 2.2+) The fill policy for missing data points. |
| **Disable downsampling** | Toggle to disable downsampling entirely. Use this when you need raw data points. |

## Filters section

Filters (available in OpenTSDB 2.2+) provide advanced filtering capabilities:

| Field | Description |
| ----- | ----------- |
| **Key** | The tag key to filter on. |
| **Type** | The filter type. Options include `literal_or`, `iliteral_or`, `wildcard`, `iwildcard`, `regexp`, `not_literal_or`, `not_iliteral_or`. |
| **Filter** | The filter value or pattern. |
| **Group by** | Toggle to group results by this tag key. |

### Filter types

| Type | Description |
| ---- | ----------- |
| `literal_or` | Matches exact values. Use `\|` to specify multiple values. |
| `iliteral_or` | Case-insensitive literal match. |
| `wildcard` | Matches using `*` as a wildcard character. |
| `iwildcard` | Case-insensitive wildcard match. |
| `regexp` | Matches using regular expressions. |
| `not_literal_or` | Excludes exact values. |
| `not_iliteral_or` | Case-insensitive exclusion. |

## Tags section

Tags filter metrics by key-value pairs. Specify a tag key and value to limit results to time series with matching tags. Use `*` as a wildcard value to match all values for a given key.

{{< admonition type="note" >}}
Tags are deprecated in OpenTSDB 2.2 and later. Use Filters instead for more powerful filtering options.
{{< /admonition >}}

{{< admonition type="note" >}}
When using OpenTSDB 2.2 or later, use either Filters or Tags, not both. They are mutually exclusive, and using both together may produce unexpected results.
{{< /admonition >}}

## Rate section

The Rate section computes the rate of change, which is useful for counter metrics:

| Field | Description |
| ----- | ----------- |
| **Rate** | Toggle to enable rate calculation. Computes the difference between consecutive values divided by the time interval. |
| **Counter** | Toggle to indicate the metric is a monotonically increasing counter that may reset (for example, after a server restart). |
| **Counter max** | (When Counter is enabled) The maximum value the counter can reach before it wraps around. Used to calculate correct rates across counter resets. |
| **Reset value** | (When Counter is enabled) The value the counter resets to after wrapping. Typically `0`. |
| **Explicit tags** | (Version 2.3+) Toggle to require all tags specified in the query to exist on matching time series. Prevents unexpected results from partial tag matches. |

## Aggregators

The aggregator function combines multiple time series into one. Common aggregators include:

| Aggregator | Description |
| ---------- | ----------- |
| `sum` | Sum all values at each timestamp. |
| `avg` | Average all values at each timestamp. |
| `min` | Take the minimum value at each timestamp. |
| `max` | Take the maximum value at each timestamp. |
| `dev` | Calculate the standard deviation. |
| `zimsum` | Sum values, treating missing data as zero. |
| `mimmin` | Minimum value, ignoring missing data. |
| `mimmax` | Maximum value, ignoring missing data. |

## Fill policies

Fill policies (available in OpenTSDB 2.2+) determine how to handle missing data points during downsampling:

| Policy | Description |
| ------ | ----------- |
| `none` | Don't fill missing values. |
| `nan` | Fill missing values with NaN. |
| `null` | Fill missing values with null. |
| `zero` | Fill missing values with zero. |

## Autocomplete suggestions

As you type metric names, tag names, or tag values, autocomplete suggestions appear. This feature requires the OpenTSDB suggest API to be enabled on your server.

If autocomplete isn't working, refer to [Troubleshooting](ref:troubleshooting-opentsdb).

## Query examples

The following examples demonstrate common query patterns.

### Basic metric query with tag filtering

| Field | Value |
| ----- | ----- |
| Metric | `sys.cpu.user` |
| Aggregator | `avg` |
| Tags | `host=webserver01` |

This query returns the average CPU usage for the host `webserver01`.

### Query with wildcard filter (OpenTSDB 2.2+)

| Field | Value |
| ----- | ----- |
| Metric | `http.requests.count` |
| Aggregator | `sum` |
| Filter Key | `host` |
| Filter Type | `wildcard` |
| Filter Value | `web-*` |
| Group by | enabled |

This query sums HTTP request counts across all hosts matching `web-*` and groups results by host.

### Rate calculation for network counters

| Field | Value |
| ----- | ----- |
| Metric | `net.bytes.received` |
| Aggregator | `sum` |
| Rate | enabled |
| Counter | enabled |
| Counter max | `18446744073709551615` |

This query calculates the rate of bytes received per second. The counter max is set to the 64-bit unsigned integer maximum to handle counter wraps correctly.

### Using alias patterns

| Field | Value |
| ----- | ----- |
| Metric | `app.response.time` |
| Aggregator | `avg` |
| Tags | `host=*`, `env=production` |
| Alias | `$tag_host - Response Time` |

This query uses the alias pattern to create readable legend labels like `webserver01 - Response Time`.
