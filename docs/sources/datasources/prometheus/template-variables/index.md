---
aliases:
  - /docs/grafana/latest/datasources/prometheus/template-variables/
  - /docs/grafana/latest/data-sources/prometheus/template-variables/
description: Using template variables with Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - templates
  - variables
  - queries
menuTitle: Template variables
title: Prometheus template variables
weight: 400
---

# Prometheus template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating]({{< relref "../../../dashboards/variables" >}}) and [Add and manage variables]({{< relref "../../../dashboards/variables/add-template-variables" >}}) documentation.

## Use query variables

You can use variables of the type _Query_ to query Prometheus for a list of metrics, labels, or label values.

You can use these Prometheus data source functions in the **Query** input field:

| Name                          | Description                                                             | Used API endpoints                |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| `label_names()`               | Returns a list of label names.                                          | /api/v1/labels                    |
| `label_values(label)`         | Returns a list of label values for the `label` in every metric.         | /api/v1/label/`label`/values      |
| `label_values(metric, label)` | Returns a list of label values for the `label` in the specified metric. | /api/v1/series                    |
| `metrics(metric)`             | Returns a list of metrics matching the specified `metric` regex.        | /api/v1/label/\_\_name\_\_/values |
| `query_result(query)`         | Returns a list of Prometheus query result for the `query`.              | /api/v1/query                     |

For details on _metric names_, _label names_, and _label values_, refer to the [Prometheus documentation](http://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).

### Use interval and range variables

You can use some global built-in variables in query variables, for example, `$__interval`, `$__interval_ms`, `$__range`, `$__range_s` and `$__range_ms`.
For details, see [Global built-in variables]({{< relref "../../../dashboards/variables/add-template-variables#global-variables" >}}).
The `label_values` function doesn't support queries, so you can use these variables in conjunction with the `query_result` function to filter variable queries.

Make sure to set the variable's `refresh` trigger to be `On Time Range Change` to get the correct instances when changing the time range on the dashboard.

**Example:**

Populate a variable with the busiest 5 request instances based on average QPS over the time range shown in the dashboard:

```
Query: query_result(topk(5, sum(rate(http_requests_total[$__range])) by (instance)))
Regex: /"([^"]+)"/
```

Populate a variable with the instances having a certain state over the time range shown in the dashboard, using `$__range_s`:

```
Query: query_result(max_over_time(<metric>[${__range_s}s]) != <state>)
Regex:
```

## Use `$__rate_interval`

> **Note:** Available in Grafana v7.2 and higher.

We recommend using `$__rate_interval` in the `rate` and `increase` functions instead of `$__interval` or a fixed interval value.
Because `$__rate_interval` is always at least four times the value of the Scrape interval, it avoid problems specific to Prometheus.

For example, instead of using:

```
rate(http_requests_total[5m])
```

or:

```
rate(http_requests_total[$__interval])
```

We recommend that you use:

```
rate(http_requests_total[$__rate_interval])
```

The value of `$__rate_interval` is defined as
*max(`$__interval` + *Scrape interval*, 4 \* *Scrape interval*)*,
where _Scrape interval_ is the "Min step" setting (also known as `query*interval`, a setting per PromQL query) if any is set.
Otherwise, Grafana uses the Prometheus data source's "Scrape interval" setting.

The "Min interval" setting in the panel is modified by the resolution setting, and therefore doesn't have any effect on _Scrape interval_.

For details, refer to the [Grafana blog](/blog/2020/09/28/new-in-grafana-7.2-__rate_interval-for-prometheus-rate-queries-that-just-work/).

## Choose a variable syntax

The Prometheus data source supports two variable syntaxes for use in the **Query** field:

- `$<varname>`, for example `rate(http_requests_total{job=~"\$job"}[$_rate_interval])`, which is easier to read and write but does not allow you to use a variable in the middle of a word.
- `[[varname]]`, for example `rate(http_requests_total{job=~"[[job]]"}[$_rate_interval])`

If you've enabled the _Multi-value_ or _Include all value_ options, Grafana converts the labels from plain text to a regex-compatible string, which requires you to use `=~` instead of `=`.

## Use the ad hoc filters variable type

Prometheus supports the special [ad hoc filters]({{< relref "../../../dashboards/variables/add-template-variables#add-ad-hoc-filters" >}}) variable type, which you can use to specify any number of label/value filters on the fly.
These filters are automatically applied to all your Prometheus queries.
