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
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Prometheus template variables
title: Prometheus template variables
weight: 400
refs:
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
  add-template-variables-add-ad-hoc-filters:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
  add-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
  add-template-variables-global-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#global-variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#global-variables
---

# Prometheus template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables. Grafana refers to such variables as **template** variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the displayed data.

For an introduction to templating and template variables, refer to [Templating](ref:variables) and [Add and manage variables](ref:add-template-variables).

## Use query variables

Grafana supports several types of variables, but Query variables are specifically used to query Prometheus. They can return a list of metrics, labels, label values, query results, or series.

Select a Prometheus data source query type and enter the required inputs:

| Query Type      | Input(\* required)        | Description                                                                                                                                                   | Used API endpoints                             |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Label names`   | `metric`                  | Returns a list of all label names matching the specified `metric` regex.                                                                                      | /api/v1/labels                                 |
| `Label values`  | `label`\*, `metric`       | Returns a list of label values for the `label` in all metrics or the optional metric.                                                                         | /api/v1/label/`label`/values or /api/v1/series |
| `Metrics`       | `metric`                  | Returns a list of metrics matching the specified `metric` regex.                                                                                              | /api/v1/label/\_\_name\_\_/values              |
| `Query result`  | `query`                   | Returns a list of Prometheus query result for the `query`.                                                                                                    | /api/v1/query                                  |
| `Series query`  | `metric`, `label` or both | Returns a list of time series associated with the entered data.                                                                                               | /api/v1/series                                 |
| `Classic query` | classic query string      | Deprecated, classic version of variable query editor. Enter a string with the query type using a syntax like the following: `label_values(<metric>, <label>)` | all                                            |

For details on `metric names`, `label names`, and `label values`, refer to the [Prometheus documentation](http://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).

### Query options

With the query variable type, you can set the following query options:

| Option                | Description                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| **Data source**       | Select your data source from the drop-down list.                                                        |
| **Select query type** | Options are `default`, `value` and `metric name`. Each query type hits a different Prometheus endpoint. |
| **Regex**             | Optional, if you want to extract part of a series name or metric node segment.                          |
| **Sort**              | Default is `disabled`. Options include `alphabetical`, `numerical`, and `alphabetical case-sensitive`.  |
| **Refresh**           | When to update the values for the variable. Options are `On dashboard load` and `On time range change`. |

### Selection options

The following selection options are available:

- **Multi-value** - Check this option to enable multiple values to be selected at the same time.

- **Include All option** - Check this option to include all variables.

### Use interval and range variables

You can use global built-in variables in query variables, including the following:

- `$__interval`
- `$__interval_ms`
- `$__range`
- `$__range_s`
- `$__range_ms`

For details, refer to [Global built-in variables](ref:add-template-variables-global-variables).
The `label_values` function doesn't support queries, so you can use these variables in conjunction with the `query_result` function to filter variable queries.

Configure the variable’s `refresh` setting to `On Time Range Change` to ensure it dynamically queries and displays the correct instances when the dashboard time range is modified.

**Example:**

Populate a variable with the top 5 busiest request instances ranked by average QPS over the dashboard's selected time range:

```
query_result(topk(5, sum(rate(http_requests_total[$__range])) by (instance)))
Regex: /"([^"]+)"/
```

Populate a variable with the instances having a certain state over the time range shown in the dashboard, using `$__range_s`:

```
query_result(max_over_time(<metric>[${__range_s}s]) != <state>)
Regex:
```

## Use `$__rate_interval`

Grafana recommends using `$__rate_interval` with the `rate` and `increase` functions instead of `$__interval` or a fixed interval value.
Since `$__rate_interval` is always at least four times the scrape interval, it helps avoid issues specific to Prometheus, such as gaps or inaccuracies in query results.

For example, instead of using the following:

```
rate(http_requests_total[5m])
```

or:

```
rate(http_requests_total[$__interval])
```

Use the following:

```
rate(http_requests_total[$__rate_interval])
```

<!-- The value of `$__rate_interval` is defined as
*max(`$__interval` + *Scrape interval*, 4 \* *Scrape interval*)*,
where _Scrape interval_ is the "Min step" setting (also known as `query*interval`, a setting per PromQL query) if any is set.
Otherwise, Grafana uses the Prometheus data source's `scrape interval` setting. -->

The value of `$__rate_interval` is calculated as:

```
max($__interval + scrape_interval, 4 * scrape_interval)
```

Here, `scrape_interval` refers to the `min step` setting (also known as `query_interval`) specified per PromQL query, if set. If not, Grafana falls back to the Prometheus data source’s scrape interval setting.

The `min interval` setting in the panel is modified by the resolution setting, and therefore doesn't have any effect on `scrape interval`.

For details, refer to the Grafana blog [$\_\_rate_interval for Prometheus rate queries that just work](https://grafana.com/blog/2020/09/28/new-in-grafana-7.2-__rate_interval-for-prometheus-rate-queries-that-just-work/).

## Choose a variable syntax

The Prometheus data source supports two variable syntaxes for use in the **Query** field:

- `$<varname>`, for example `rate(http_requests_total{job=~"$job"}[$_rate_interval])`, which is easier to read and write but does not allow you to use a variable in the middle of a word.
- `[[varname]]`, for example `rate(http_requests_total{job=~"[[job]]"}[$_rate_interval])`

If you've enabled the `Multi-value` or `Include all value` options, Grafana converts the labels from plain text to a regex-compatible string, which requires you to use `=~` instead of `=`.

## Use the ad hoc filters variable type

Prometheus supports the special [ad hoc filters](ref:add-template-variables-add-ad-hoc-filters) variable type, which allows you to dynamically apply label/value filters across your dashboards. These filters are automatically added to all Prometheus queries, allowing dynamic filtering without modifying individual queries.
