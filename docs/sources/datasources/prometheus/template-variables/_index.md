---
aliases:
  - ../../data-sources/prometheus/template-variables/
description: Using template variables with Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - templates
  - variables
  - queries
  - rate_interval
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: Prometheus template variables
weight: 400
review_date: 2026-05-07
---

# Prometheus template variables

Template variables let you create dynamic, reusable dashboards by replacing hard-coded values (such as server names, namespaces, or job labels) with selectable variables. Grafana displays these variables as dropdown menus at the top of the dashboard, letting viewers change the displayed data without editing queries.

For an introduction to templating and template variables, refer to [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/).

## Query variable types

Query variables query Prometheus to populate dropdown values. When creating a query variable, select a Prometheus data source and choose a query type:

| Query Type | Required inputs | Description | Example |
| --- | --- | --- | --- |
| **Label names** | `metric` (optional) | Returns all label names, optionally filtered by metric regular expression. | Metric: `http_requests_total` → returns `job`, `instance`, `method`, `status`, etc. |
| **Label values** | `label` (required), `metric` (optional) | Returns values for a specific label, optionally filtered by metric. | Label: `job`, Metric: `http_requests_total` → returns `api-server`, `web`, `worker` |
| **Metrics** | `metric` (optional) | Returns metric names matching the specified regex. | Metric: `node_.*` → returns `node_cpu_seconds_total`, `node_memory_MemFree_bytes`, etc. |
| **Query result** | `query` (required) | Runs a PromQL query and returns the results as variable values. | `query_result(up{job="prometheus"})` |
| **Series query** | `metric`, `label`, or both | Returns time series matching the specified metric and/or label selectors. | Metric: `http_requests_total`, Label: `job="api"` |
| **Classic query** | query string | _Deprecated._ Legacy syntax using functions like `label_values(metric, label)`. | `label_values(http_requests_total, job)` |

For details on metric names, label names, and label values, refer to the [Prometheus data model](http://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).

### Query type examples

**Label values — Populate a dropdown with all jobs:**

1. Create a new variable with **Type: Query**.
1. Select your Prometheus data source.
1. Set **Query type** to `Label values`.
1. Set **Label** to `job`.
1. Leave **Metric** empty to query across all metrics.

The variable dropdown now shows all unique `job` label values.

**Label values — Filtered by metric:**

Set **Label** to `instance` and **Metric** to `node_cpu_seconds_total` to show only instances that report CPU metrics.

**Metrics — Find available metrics by pattern:**

Set **Query type** to `Metrics` and enter `http_.*_total` in the **Metric** field to populate the dropdown with all HTTP counter metrics.

**Query result — Dynamic top-N filtering:**

Set **Query type** to `Query result` and enter:

```promql
query_result(topk(5, sum(rate(http_requests_total[$__range])) by (instance)))
```

Set **Regex** to `/"([^"]+)"/` to extract the instance values from the result.

Set **Refresh** to `On time range change` so the top 5 instances update as you change the dashboard time range.

### Query options

| Option | Description |
| --- | --- |
| **Data source** | The Prometheus data source to query. |
| **Regex** | Optional regex to extract a portion of the returned values. Use capture groups — for example, `/.*instance="([^"]+)".*/` extracts the instance label value from a series string. |
| **Sort** | Sort order for dropdown values: `Disabled`, `Alphabetical (asc)`, `Alphabetical (desc)`, `Numerical (asc)`, `Numerical (desc)`, `Alphabetical (case-insensitive, asc)`, `Alphabetical (case-insensitive, desc)`. |
| **Refresh** | When to update values: `On dashboard load` or `On time range change`. Use `On time range change` for variables that depend on `$__range`. |

### Selection options

- **Multi-value** — Allows selecting multiple values at once. Grafana joins them with a pipe (`|`) for regex matching.
- **Include All option** — Adds an "All" option that selects every value. Combined with multi-value, this generates a regex like `value1|value2|value3`.

{{< admonition type="note" >}}
When **Multi-value** or **Include All** is enabled, use `=~` (regex match) instead of `=` (exact match) in your queries, since the variable value becomes a regex pattern.
{{< /admonition >}}

**Example with multi-value:**

```promql
rate(http_requests_total{job=~"$job"}[$__rate_interval])
```

### Use interval and range variables

You can use global built-in variables in query variable definitions:

| Variable | Description |
| --- | --- |
| `$__interval` | Calculated interval based on time range and panel width. |
| `$__interval_ms` | Same as `$__interval` in milliseconds. |
| `$__range` | Duration of the current dashboard time range (for example, `1h`). |
| `$__range_s` | Duration in seconds. |
| `$__range_ms` | Duration in milliseconds. |

For details, refer to [Global built-in variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#global-variables).

The `label_values` function (Classic query type) doesn't support these variables. Use `Query result` type with `query_result()` instead:

```promql
query_result(max_over_time(up{job="$job"}[${__range_s}s]) == 1)
```

Set the variable's **Refresh** to `On time range change` to update values when the time range changes.

## Use `$__rate_interval`

`$__rate_interval` is a Grafana-specific variable designed for use with `rate()` and `increase()`. It guarantees a range window large enough to capture at least four scrape samples, preventing gaps or inaccuracies in results.

**Always use `$__rate_interval` instead of a fixed interval or `$__interval`:**

```promql
rate(http_requests_total[$__rate_interval])
```

Not:

```promql
rate(http_requests_total[5m])       # breaks at different zoom levels
rate(http_requests_total[$__interval])  # can be too small for rate()
```

### How `$__rate_interval` is calculated

```
max($__interval + scrape_interval, 4 * scrape_interval)
```

Where `scrape_interval` is:
1. The per-query **Min step** setting, if set.
2. Otherwise, the data source's **Scrape interval** setting (under Interval behavior in the data source configuration).

The panel-level `min interval` is affected by the resolution setting and doesn't factor into this calculation.

### Configure `$__rate_interval` correctly

For `$__rate_interval` to produce reliable results, the scrape interval must match your actual Prometheus scrape configuration:

1. Open the Prometheus data source configuration.
1. Under **Interval behavior**, set the **Scrape interval** to match the `scrape_interval` in your Prometheus configuration file (for example, `30s` or `1m`).
1. If different targets have different scrape intervals, set the data source scrape interval to the **longest** interval in use, or use the per-query **Min step** to override on specific panels.

### Common pitfalls

- **Missing or incorrect scrape interval setting:** If the data source scrape interval is left at the default `15s` but your actual Prometheus scrape interval is `60s`, `$__rate_interval` calculates too small a window. This causes `rate()` to return no data because there aren't enough data points in the window.

- **Different values in edit mode versus dashboard:** When editing a query, the panel displays at full width. On the dashboard, the panel may be narrower, which increases `$__interval` and therefore `$__rate_interval`. Queries that work in edit mode may produce different results (or gaps) on the dashboard.

- **LBAC-enabled data sources:** Data sources using Label-Based Access Control (LBAC) may not inherit the scrape interval setting from the parent data source. Set the **Min step** explicitly on each query panel to ensure a correct `$__rate_interval` calculation.

- **Recording rules with fixed intervals:** If you use `$__rate_interval` in a recording rule query, the interval depends on the evaluation context. For recording rules, use a fixed interval (for example, `[5m]`) rather than `$__rate_interval`.

For troubleshooting `$__rate_interval` issues, refer to [`$__rate_interval` returns no data or incorrect values](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/#rate_interval-returns-no-data-or-incorrect-values).

For additional background, refer to [$\_\_rate_interval for Prometheus rate queries that just work](https://grafana.com/blog/2020/09/28/new-in-grafana-7.2-__rate_interval-for-prometheus-rate-queries-that-just-work/).

## Variable syntax

The Prometheus data source supports three variable syntaxes:

| Syntax | Example | Use case |
| --- | --- | --- |
| `$varname` | `rate(http_requests_total{job=~"$job"}[$__rate_interval])` | Simple, readable. Cannot be used mid-word. |
| `${varname}` | `rate(http_requests_total{job=~"${job}"}[$__rate_interval])` | Use when the variable is adjacent to other text (for example, `${env}-cluster`). |
| `[[varname]]` | `rate(http_requests_total{job=~"[[job]]"}[$__rate_interval])` | Legacy syntax. Supported for backward compatibility. |

{{< admonition type="note" >}}
If **Multi-value** or **Include All** is enabled, the variable value becomes a regex pattern (for example, `value1|value2`). Use `=~` instead of `=` in your label matchers.
{{< /admonition >}}

## Filters variable

Prometheus supports the [Filters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters) variable type (formerly called "ad hoc filters"), which lets dashboard viewers dynamically add label filters without editing queries.

{{< admonition type="note" >}}
In Grafana 13, the **Filter and Group by** feature (public preview) extends the Filters variable by adding grouping support for Prometheus and Loki data sources. Enable the `dashboardUnifiedDrilldownControls` feature toggle to use it. For more information, refer to [Dashboard controls](http://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/dashboard-controls/#filter-and-group-by).
{{< /admonition >}}

To set up a Filters variable:

1. Create a new variable with **Type: Filters**.
1. Select your Prometheus data source.
1. Save the dashboard.

Once added, a filter bar appears at the top of the dashboard. Viewers can add filters by selecting a label, operator (`=`, `!=`, `=~`, `!~`), and value. Grafana automatically applies these filters to **all** Prometheus queries on the dashboard.

**Example:** A viewer adds the filter `namespace = production`. All queries on the dashboard now include `{namespace="production"}` without any query modifications.

{{< admonition type="note" >}}
Filters are applied to all queries using the selected data source. You cannot selectively apply them to specific panels.
{{< /admonition >}}

## Related resources

- [Query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor/) — Use variables in PromQL queries.
- [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/annotations/) — Use template variables in annotation queries.
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/) — Resolve variable-related query issues.
