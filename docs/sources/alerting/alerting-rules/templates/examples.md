---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/examples/
description: Examples of templating labels and annotations in Grafana alert rules
keywords:
  - grafana
  - alerting
  - templating
  - labels
  - annotations
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Labels and annotations template examples
menuTitle: Examples
weight: 102
refs:
  shared-dynamic-label-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/dynamic-labels/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/dynamic-labels/
  labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#labels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#labels
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#annotations
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#annotations
  alert-rule-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/
    - pattern: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/
  reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/
  reference-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/#labels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/#labels
  reference-values:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/#values
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/#values
  reference-humanize:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/#humanize
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/#humanize
  reference-humanizepercentage:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/#humanizepercentage
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/#humanizepercentage
  reference-match:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/#match
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/#match
  reference-functions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/#functions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/#functions
  language-functions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/language/#functions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/language/#functions
  language-index:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/language/#functions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/language/#functions
  language:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/language
    - pattern: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/language
---

# Labels and annotations template examples

Templating allows you to add dynamic data from queries to alert labels and annotations. Dynamic data enhances alert context, making it easier for responders to quickly assess and address the issue.

This page provides common examples for templating labels and annotations. For more information on templating, refer to:

- [Template annotations and labels](ref:alert-rule-templates)
- [Annotation and label template reference](ref:reference)
- [Alerting template language](ref:language)

## Annotation example

[Annotations](ref:annotations) add extra details to alert instances and are often used to provide helpful information for identifying the issue and guiding the response.

A common use case for annotations is to display the specific query value or threshold that triggered the alert.

For example, you can display the query value from the [`$values`](ref:reference-values) variable to inform about the CPU value that triggered the alert.

```
CPU usage has exceeded 80% ({{ $values.A.value }}) for the last 5 minutes.
```

Alternatively, you can use the [`index()`](ref:language-index) function to retrieve the query value as follows.

```
CPU usage has exceeded 80% ({{ index $values "A" }}) for the last 5 minutes.
```

```template_output
CPU usage has exceeded 80% (81.2345) for the last 5 minutes.
```

### Include labels for extra details

To provide additional context, you can include labels from the query using the [`$labels`](ref:reference-labels) variable.

For instance, the previous case could also include the affected `instance`.

```
CPU usage for {{ $labels.instance }} has exceeded 80% ({{ $values.A.Value }}) for the last 5 minutes.
```

```template_output
CPU usage for Instance 1 has exceeded 80% (81.2345) for the last 5 minutes.
```

You can incorporate any labels returned by the query into the template. For instance, the following template includes information about the environment and region where the alert occurred.

```
Alert triggered in {{ $labels.environment }} on {{ $labels.region }} region.
```

```template_output
Alert triggered in production on AMER region.
```

### Print a range query

To print the value of an instant query you can print its Ref ID using the `index` function or the `$values` variable:

```
{{ $values.A.Value }}
```

For range queries, reduce them from a time series to an instant vector using a reduce expression. You can then print the result by referencing its Ref ID. For example, if the reduce expression averages `A` with the Ref ID `B`, you would then print `$values.B`:

```
{{ $values.B.Value }}
```

### Humanize the value of a query

To print the humanized value of an instant query, use the [`humanize`](ref:reference-humanize) function:

```
{{ humanize $values.A.Value }}
```

Alternatively:

```
{{ humanize (index $values "A").Value }}
```

```template_output
554.9
```

To print the value of an instant query as a percentage, use the [`humanizePercentage`](ref:reference-humanizepercentage) function:

```
{{ humanizePercentage $values.A.Value }}
```

```template_output
10%
```

For additional functions to display or format data, refer to:

- [Annotation and label template functions](ref:reference-functions)
- [Template language functions](ref:language-functions)

## Label example

[Labels](ref:labels) determine how alerts are routed and managed, ensuring that notifications reach the right teams at the right time. If the labels returned by your queries don’t fully capture the necessary context, you can create a new label and sets its value based on query data.

### Based on query value

Here’s an example of creating a `severity` label based on a query value:

```go
{{- if (gt $values.A.Value 90.0) -}}critical
{{- else if (gt $values.A.Value 80.0) -}}high
{{- else if (gt $values.A.Value 60.0) -}}medium
{{- else -}}low
{{- end -}}
```

In this example, the `severity` label is determined by the query value:

- `critical` for values above 90,
- `high` for values above 80,
- `medium` for values above 60,
- and `low` for anything below.

You can then use the `severity` label to control how alerts are handled. For instance, you could send `critical` alerts immediately, while routing `low` severity alerts to a team for further investigation.

> **Note:** An alert instance is uniquely identified by its set of labels.
>
> - Avoid displaying query values in labels, as this can create numerous alert instances—one for each distinct label set. Instead, use annotations for query values.
> - If a templated label's value changes, it maps to a different alert instance, and the previous instance is considered **stale**. Learn all the details in this [example using dynamic labels](ref:shared-dynamic-label-example).

[//]: <> ({{< docs/shared lookup="alerts/note-dynamic-labels.md" source="grafana" version="<GRAFANA_VERSION>" >}})

### Based on query label

You can use labels to differentiate alerts coming from various environments (e.g., production, staging, dev). For example, you may want to add a label that sets the environment based on the instance’s label. Here’s how you can template it:

```go
{{- if eq $labels.instance "prod-server-1" -}}
production
{{- else if eq $labels.instance "staging-server-1" -}}
staging
{{- else -}}
development
{{- end -}}
```

This would print:

- For instance `prod-server-1`, the label would be `production`.
- For `staging-server-1`, the label would be `staging`.
- All other instances would be labeled `development`.

To make this template more flexible, you can use a regular expression that matches the instance name with the instance name prefix using the [`match()`](ref:reference-match) function:

```go
{{- if match "^prod-server-.*" $labels.instance -}}
production
{{- else if match "^staging-server-.*" $labels.instance -}}
staging
{{- else -}}
development
{{- end -}}
```

{{< collapse title="Legacy Alerting templates" >}}

## Legacy Alerting templates

For users working with Grafana's legacy alerting system, templates can still be utilized to extract useful information from alert conditions. However, it's important to note that you cannot use `$labels` to print labels from the query if you are using classic conditions, and must use `$values` instead. The reason for this is classic conditions discard these labels to enforce uni-dimensional behavior (at most one alert per alert rule). If classic conditions didn't discard these labels, then queries that returned many time series would cause alerts to flap between firing and resolved constantly as the labels would change every time the alert rule was evaluated.

Instead, the `$values` variable contains the reduced values of all time series for all conditions that are firing. For example, if you have an alert rule with a query A that returns two time series, and a classic condition B with two conditions, then `$values` would contain `B0`, `B1`, `B2` and `B3`. If the classic condition B had just one condition, then `$values` would contain just `B0` and `B1`.

#### Print all labels from a classic condition

To print all labels of all firing time series use the following template (make sure to replace `B` in the regular expression with the Ref ID of the classic condition if it's different):

```go
{{ range $k, $v := $values -}}
{{ if (match "B[0-9]+" $k) -}}
{{ $k }}: {{ $v.Labels }}{{ end }}
{{ end }}
```

For example, a classic condition for two time series exceeding a single condition would print:

```
B0: instance=server1
B1: instance=server2
```

If the classic condition has two or more conditions, and a time series exceeds multiple conditions at the same time, then its labels will be duplicated for each condition that is exceeded:

```
B0: instance=server1
B1: instance=server2
B2: instance=server1
B3: instance=server2
```

If you need to print unique labels you should consider changing your alert rules from uni-dimensional to multi-dimensional instead. You can do this by replacing your classic condition with reduce and math expressions.

#### Print all values from a classic condition

To print all values from a classic condition take the previous example and replace `$v.Labels` with `$v.Value`:

```go
{{ range $k, $v := $values -}}
{{ if (match "B[0-9]+" $k) -}}
{{ $k }}: {{ $v.Value }}{{ end }}
{{ end }}
```

For example, a classic condition for two time series exceeding a single condition would print:

```
B0: 81.2345
B1: 84.5678
```

If the classic condition has two or more conditions, and a time series exceeds multiple conditions at the same time, then `$values` will contain the values of all conditions:

```
B0: 81.2345
B1: 92.3456
B2: 84.5678
B3: 95.6789
```

{{< /collapse >}}
