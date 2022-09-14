---
aliases:
  - /docs/grafana/latest/alerting/fundamentals/annotation-label/variables-label-annotation/
description: Learn about labels and label matchers in alerting
keywords:
  - grafana
  - alerting
  - guide
  - fundamentals
title: How to template annotations and labels
weight: 117
---

# How to template annotations and labels

In Grafana it is possible to template annotations and labels just like you would in Prometheus. Those who have used
Prometheus before should be familiar with the `$labels` variable which holds the label key/value pairs of the alert
instance and the `$value` variable which holds the evaluated value of the alert instance.

In Grafana it is possible to use the same variables from Prometheus to template annotations and labels, even if your
alert does not use a Prometheus datasource.

For example, let's suppose we want to create an alert in Grafana that tells us when one of our instances is down for
more than 5 minutes. Like in Prometheus, we can add a summary annotation to show the instance which is down:

```
Instance {{ $labels.instance }} has been down for more than 5 minutes
```

For alerts where we also want to know the value of the condition at the time the alert fired, we can use both the
`$labels` and the `$value` variable to add even more informative summaries:

```
{{ $labels.instance }} has a 95th percentile request latency above 1s: {{ $value }})
```

One difference between Grafana and Prometheus is that Grafana uses `$value` to hold both the labels and the value
of the condition at the time the alert fired. For example:

```
[ var='B' labels={instance=http_server} value=10 ]
```

## Alert rules with two or more queries or expressions

In the case where an alert rule has two or more queries, or uses reduce and math expressions, it is possible to template
the reduced result of each query and expression with the `$values` variable. This variable holds the labels and value of
each reduced query, and the results of any math expressions. However, it does not hold the samples for each query.

For example, suppose you have the following alert rule:

{{< figure src="/static/img/docs/alerting/unified/grafana-alerting-histogram-quantile.png" class="docs-image--no-shadow" caption="An alert rule that uses histogram_quantile to compute 95th percentile" >}}

Should this rule create an alert instance `$values` will hold the result of the reduce expression `B` and the math
expression `C`. It will not hold the results returned by query `A` because query `A` does not return a single value
but rather a series of values over time.

If we were to write a summary annotation such as:

```
{{ $labels.instance }} has a 95th percentile request latency above 1s: {{ $value }})
```

We would find that because the condition of the alert, the math expression `C` must be a boolean comparison, it must
return either a `0` or a `1`. What we want instead is the 95th percentile from the reduce expression `B`:

```
{{ $labels.instance }} has a 95th percentile request latency above 1s: {{ $values.B }})
```

We can also show the labels of `B`, however since this alert rule has just one query the labels of `B` are equivalent to
`$labels`:

```
{{ $values.B.Labels.instance }} has a 95th percentile request latency above 1s: {{ $values.B }})
```

### No data and execution errors or timeouts

Should query `A` return no data then the reduce expression `B` will also return no data. This means that
`{{ $values.B }}` will be nil. To ensure that annotations and labels can still be templated even when a query returns
no data, we can use an if statement to check for `$values.B`:

```
{{ if $values.B }}{{ $labels.instance }} has a 95th percentile request latency above 1s: {{ $values.B }}){{ end }}
```

## Classic conditions

If the rule uses a classic condition instead of a reduce and math expression, then `$values` contains the combination
of the `refID` and position of the condition. For example, `{{ $values.A0 }}` and `{{ $values.A1 }}`.

## Variables

The following template variables are available when expanding annotations and labels.

| Name    | Description                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| $labels | The labels from the query or condition. For example, `{{ $labels.instance }}` and `{{ $labels.job }}`. This is unavailable when the rule uses a [classic condition]({{< relref "../../alerting-rules/create-grafana-managed-rule/#single-and-multi-dimensional-rule" >}}).                                                                                                                                 |
| $values | The values of all reduce and math expressions that were evaluated for this alert rule. For example, `{{ $values.A }}`, `{{ $values.A.Labels }}` and `{{ $values.A.Value }}` where `A` is the `refID` of the reduce or math expression. If the rule uses a classic condition instead of a reduce and math expression, then `$values` contains the combination of the `refID` and position of the condition. |
| $value  | The value string of the alert instance. For example, `[ var='A' labels={instance=foo} value=10 ]`.                                                                                                                                                                                                                                                                                                         |
