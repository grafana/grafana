---
aliases:
  - ../../../variables/global-variables/ # /docs/grafana/next/variables/global-variables/
  - ../../../variables/variable-types/global-variables/ # /docs/grafana/next/variables/variable-types/global-variables/
keywords:
  - variables
  - global
  - standard
  - built-in
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Global variables
description: Use Grafana built-in global variables to reference dashboard metadata, time ranges, intervals, and user context in queries, links, and panel titles.
weight: 200
---

# Global variables

Grafana has global built-in variables that can be used in expressions in the query editor.
This page lists them in alphabetical order and defines them.
Most variables are useful in queries, dashboard links, panel links, and data links — but some, like `$__url_time_range`, are intended only for use in links, not query editors.

## `$__dashboard`

This variable is the name of the current dashboard.

## `$__from` and `$__to`

Grafana has built-in time range variables: `$__from` and `$__to`.
They're always interpolated as epoch milliseconds by default, but you can control date formatting.

<!-- prettier-ignore-start -->

| Syntax                   | Example result           | Description                                 |
| ------------------------ | ------------------------ | ------------------------------------------- |
| `${__from}`              | 1594671549254            | Unix millisecond epoch                      |
| `${__from:date}`         | 2020-07-13T20:19:09.254Z | No arguments, defaults to ISO 8601/RFC 3339 |
| `${__from:date:iso}`     | 2020-07-13T20:19:09.254Z | ISO 8601/RFC 3339                           |
| `${__from:date:seconds}` | 1594671549               | Unix seconds epoch                          |
| `${__from:date:YYYY-MM}` | 2020-07                  | Any custom [date format](https://momentjs.com/docs/#/displaying/) that doesn't include the `:` character. Uses browser time. Use `:date` or `:date:iso` for UTC                                                                                 |

<!-- prettier-ignore-end -->

The syntax above also works with `${__to}`.

You can use this variable in URLs, as well. For example, you can send a user to a dashboard that shows a time range from six hours ago until now: `https://play.grafana.org/d/000000012/grafana-play-home?viewPanel=2&orgId=1?from=now-6h&to=now`

## `$__interval`

You can use the `$__interval` variable as a parameter to group by time (for InfluxDB, MySQL, Postgres, MSSQL), Date histogram interval (for Elasticsearch), or as a _summarize_ function parameter (for Graphite).

Grafana automatically calculates an interval that can be used to group by time in queries. When there are more data points than can be shown on a graph, then queries can be made more efficient by grouping by a larger interval. It's more efficient to group by 1 day than by 10s when looking at 3 months of data. The graph looks the same and the query is faster. The `$__interval` is calculated using the time range and the width of the graph (the number of pixels).

Approximate Calculation: `(to - from) / resolution`

For example, when the time range is 1 hour and the graph is full screen, then the interval might be calculated to `2m` - points are grouped in 2 minute intervals. If the time range is 6 months and the graph is full screen, then the interval might be `1d` (1 day) - points are grouped by day.

In the InfluxDB data source, the legacy variable `$interval` is the same variable. `$__interval` should be used instead.

The InfluxDB and Elasticsearch data sources have `Group by time interval` fields that are used to hard code the interval or to set the minimum limit for the `$__interval` variable (by using the `>` syntax -> `>10m`).

## `$__interval_ms`

This variable is the `$__interval` variable in milliseconds, not a time interval formatted string. For example, if the `$__interval` is `20m` then the `$__interval_ms` is `1200000`.

## `$__name`

This variable is only available in the **Singlestat** panel and can be used in the prefix or suffix fields on the Options tab. The variable is replaced with the series name or alias.

{{< admonition type="note" >}}
The **Singlestat** panel is no longer available from Grafana 8.0.
{{< /admonition >}}

## `$__org`

This variable is the ID of the current organization.
`${__org.name}` is the name of the current organization.

## `$__user`

`${__user.id}` is the ID of the current user.
`${__user.login}` is the login handle of the current user.
`${__user.email}` is the email for the current user.

## `$__range`

Currently only supported for Prometheus and Loki data sources. This variable represents the range for the current dashboard. It's calculated by `to - from`. It has a millisecond and a second representation called `$__range_ms` and `$__range_s`.

## `$__rate_interval`

Currently only supported for Prometheus data sources. The `$__rate_interval` variable is meant to be used in the rate function. Refer to [Prometheus query variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/template-variables/#use-__rate_interval) for details.

## `$__rate_interval_ms`

This variable is the `$__rate_interval` variable in milliseconds, not a time-interval-formatted string. For example, if the `$__rate_interval` is `20m` then the `$__rate_interval_ms` is `1200000`.

## `$timeFilter` or `$__timeFilter`

The `$timeFilter` variable returns the currently selected time range as an expression. For example, the time range interval `Last 7 days` expression is `time > now() - 7d`.

This is used in several places, including:

- The WHERE clause for the InfluxDB data source. Grafana adds it automatically to InfluxDB queries when in Query Editor mode. You can add it manually in Text Editor mode: `WHERE $timeFilter`.
- Log Analytics queries in the Azure Monitor data source.
- SQL queries in MySQL, Postgres, and MSSQL.
- The `$__timeFilter` variable is used in the MySQL data source.

## `$__timezone`

The `$__timezone` variable returns the currently selected time zone, either `utc` or an entry of the IANA time zone database (for example, `America/New_York`).

If the currently selected time zone is _Browser Time_, Grafana tries to determine your browser time zone.

## `$__url_time_range`

The `$__url_time_range` variable returns the current dashboard time range as URL query parameters.
It's intended for use in data links and panel links, not in query editors.

The variable expands to a string like `from=1607687293000&to=1607687293100`, where the values are Unix millisecond timestamps matching the current time range selection.

You must include the `?` or `&` separator yourself when constructing URLs:

<!-- prettier-ignore-start -->

| Usage | Example result |
| ----- | -------------- |
| `https://example.com/d/abc?${__url_time_range}`         | `https://example.com/d/abc?from=1594671549254&to=1594672349254`         |
| `https://example.com/d/abc?orgId=1&${__url_time_range}` | `https://example.com/d/abc?orgId=1&from=1594671549254&to=1594672349254` |

<!-- prettier-ignore-end -->

To link to another dashboard while preserving the current time range, follow this pattern:

```text
https://your-grafana/d/other-dashboard?${__url_time_range}
```

To also pass a variable value from the current dashboard, follow this pattern:

```text
https://your-grafana/d/other-dashboard?{__url_time_range}&var-host= {host}
```

{{< admonition type="note" >}}
`$__url_time_range` always uses Unix millisecond epoch timestamps.
To include only the start or end of the time range with specific formatting, use [`$__from` and `$__to` variables](#__from-and-__to) instead.
{{< /admonition >}}
