+++
title = "Template variables for alerting rule labels and annotations"
description = "Learn about labels and label matchers in alerting"
keywords = ["grafana", "alerting", "guide", "fundamentals"]
weight = 117
+++

# Template variables for alerting rule labels and annotations

The following template variables are available when expanding annotations and labels.

| Name    | Description                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| $labels | The labels from the query or condition. For example, `{{ $labels.instance }}` and `{{ $labels.job }}`. This is unavailable when the rule uses a [classic condition]({{< relref "../../alerting-rules/create-grafana-managed-rule/#single-and-multi-dimensional-rule" >}}).                                                                                                                              |
| $values | The values of all reduce and math expressions that were evaluated for this alert rule. For example, `{{ $values.A }}`, `{{ $values.A.Labels }}` and `{{ $values.A.Value }}` where `A` is the `refID` of the expression. If the rule uses classic conditions, then a combination of the `refID` and position of the condition is used. For example, `{{ $values.A0.Value }}` or `{{ $values.A1.Value }}` |
| $value  | The value string of the alert instance. For example, `[ var='A' labels={instance=foo} value=10 ]`.                                                                                                                                                                                                                                                                                                      |
