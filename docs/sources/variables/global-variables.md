+++
title = "Global variables"
keywords = ["grafana", "templating", "documentation", "guide", "template", "variable", "global", "standard"]
type = "docs"
[menu.docs]
name = "global-variables"
parent = "variables"
weight = 200
+++

# Global variables

Grafana has global built-in variables that can be used in expressions in the query editor. This topic lists them in alphabetical order and defines them.

## $__dashboard
> Only available in Grafana v6.7+

This variable is the UID of the current dashboard.
`${__dashboard.name}` is the name of the current dashboard.

## $__from and $__to

> Only available in Grafana v6.0+

Grafana has two built in time range variables: `$__from` and `$__to`. They are currently always interpolated as epoch milliseconds. 

## $__interval

The `$__interval` variable can be used as a parameter to group by time (for InfluxDB, MySQL, Postgres, MSSQL), Date histogram interval (for Elasticsearch) or as a *summarize* function parameter (for Graphite).

Grafana automatically calculates an interval that can be used to group by time in queries. When there are more data points than can be shown on a graph then queries can be made more efficient by grouping by a larger interval. It is more efficient to group by 1 day than by 10s when looking at 3 months of data and the graph will look the same and the query will be faster. The `$__interval` is calculated using the time range and the width of the graph (the number of pixels).

Approximate Calculation: `(from - to) / resolution`

For example, when the time range is 1 hour and the graph is full screen, then the interval might be calculated to `2m` - points are grouped in 2 minute intervals. If the time range is 6 months and the graph is full screen, then the interval might be `1d` (1 day) - points are grouped by day.

In the InfluxDB data source, the legacy variable `$interval` is the same variable. `$__interval` should be used instead.

The InfluxDB and Elasticsearch data sources have `Group by time interval` fields that are used to hard code the interval or to set the minimum limit for the `$__interval` variable (by using the `>` syntax -> `>10m`).

## $__interval_ms

This variable is the `$__interval` variable in milliseconds, not a time interval formatted string. For example, if the `$__interval` is `20m` then the `$__interval_ms` is `1200000`.

## $__name

This variable is only available in the Singlestat panel and can be used in the prefix or suffix fields on the Options tab. The variable will be replaced with the series name or alias.

## $__org
> Only available in Grafana v6.7+

This variable is the ID of the current organization.
`${__org.name}` is the name of the current organization.

## $__range

> Only available in Grafana v5.3+

Currently only supported for Prometheus data sources. This variable represents the range for the current dashboard. It is calculated by `to - from`. It has a millisecond and a second representation called `$__range_ms` and `$__range_s`.

## $timeFilter or $__timeFilter

The `$timeFilter` variable returns the currently selected time range as an expression. For example, the time range interval `Last 7 days` expression is `time > now() - 7d`.

This is used in several places, including:
* The WHERE clause for the InfluxDB data source. Grafana adds it automatically to InfluxDB queries when in Query Editor Mode. It has to be added manually in Text Editor Mode: `WHERE $timeFilter`.
* Log Analytics queries in the Azure Monitor data source.
* SQL queries in MySQL, Postgres, and MSSQL
* The `$__timeFilter` variable is used in the MySQL data source.