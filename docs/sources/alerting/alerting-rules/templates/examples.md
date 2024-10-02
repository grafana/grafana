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
title: Examples of templating labels and annotations in alert rules
menuTitle: Examples
weight: 0
---

# Labels and annotations template examples

This document is a compilation of common use cases for templating labels and annotations within Grafana alert rules. Templating allows you to dynamically generate values for both labels and annotations, making your alerts more flexible and context-aware. By leveraging variables from your metrics, you can create more informative and actionable alerts that improve both routing and response times.

Each example provided here is specifically applicable to alert rules (though syntax and functionality may differ from notification templates). For those seeking examples related to notification templates—which cover the formatting of alert messages sent to external systems—please refer to the Notification Templates Examples document.

## Common use cases

Below are some examples that address common use cases and some of the different approaches you can take with templating. If you are unfamiliar with the templating language, check the [corresponding documentation](#).

### Firing and resolved alerts, with summary annotation

This is the Summary annotation for a rule that fires when disk usage of a database server exceeds 75%. It uses the instance label from the query to tell you which database server(s) are low on disk space.

```
The database server {{ index $labels "instance" }} has exceeded 75% of available disk space, please resize the disk within the next 24 hours
```

You can also show the amount of disk space used with the $values variable. For example, if your rule has a query called A that queries the disk space usage of all database servers and a Reduce expression called B that averages the result of query A, then you can use $values to show the average disk space usage for each database server.

```
The database server {{ index $labels "instance" }} has exceeded 75% of available disk space. Disk space used is {{ index $values "B" }}%, please resize the disk within the next 24 hours
```


### Print all labels, comma separated

To print all labels, comma separated, print the `$labels` variable:

```
{{ $labels }}
```

For example, given an alert with the labels `alertname=High CPU usage`, `grafana_folder=CPU alerts` and `instance=server1`, this would print:

```
alertname=High CPU usage, grafana_folder=CPU alerts, instance=server1
```

> If you are using classic conditions then `$labels` will not contain any labels from the query. Refer to [the $labels variable](#the-labels-variable) for more information.

### Print all labels, one per line

To print all labels, one per line, use a `range` to iterate over each key/value pair and print them individually. Here `$k` refers to the name and `$v` refers to the value of the current label:

```
{{ range $k, $v := $labels -}}
{{ $k }}={{ $v }}
{{ end }}
```

For example, given an alert with the labels `alertname=High CPU usage`, `grafana_folder=CPU alerts` and `instance=server1`, this would print:

```
alertname=High CPU usage
grafana_folder=CPU alerts
instance=server1
```

> If you are using classic conditions then `$labels` will not contain any labels from the query. Refer to [the $labels variable](#the-labels-variable) for more information.

### Print an individual label

To print an individual label use the `index` function with the `$labels` variable:

```
The host {{ index $labels "instance" }} has exceeded 80% CPU usage for the last 5 minutes
```

For example, given an alert with the labels `instance=server1`, this would print:

```
The host server1 has exceeded 80% CPU usage for the last 5 minutes
```

> If you are using classic conditions then `$labels` will not contain any labels from the query. Refer to [the $labels variable](#the-labels-variable) for more information.

### Print the value of a query

To print the value of an instant query you can print its Ref ID using the `index` function and the `$values` variable:

```
{{ index $values "A" }}
```

For example, given an instant query that returns the value 81.2345, this will print:

```
81.2345
```

To print the value of a range query you must first reduce it from a time series to an instant vector with a reduce expression. You can then print the result of the reduce expression by using its Ref ID instead. For example, if the reduce expression takes the average of A and has the Ref ID B you would write:

```
{{ index $values "B" }}
```

### Print the humanized value of a query

To print the humanized value of an instant query use the `humanize` function:

```
{{ humanize (index $values "A").Value }}
```

For example, given an instant query that returns the value 81.2345, this will print:

```
81.234
```

To print the humanized value of a range query you must first reduce it from a time series to an instant vector with a reduce expression. You can then print the result of the reduce expression by using its Ref ID instead. For example, if the reduce expression takes the average of A and has the Ref ID B you would write:

```
{{ humanize (index $values "B").Value }}
```

### Print the value of a query as a percentage

To print the value of an instant query as a percentage use the `humanizePercentage` function:

```
{{ humanizePercentage (index $values "A").Value }}
```

This function expects the value to be a decimal number between 0 and 1. If the value is instead a decimal number between 0 and 100 you can either divide it by 100 in your query or using a math expression. If the query is a range query you must first reduce it from a time series to an instant vector with a reduce expression.

### Set a severity from the value of a query

To set a severity label from the value of a query use an if statement and the greater than comparison function. Make sure to use decimals (`80.0`, `50.0`, `0.0`, etc) when doing comparisons against `$values` as text/template does not support type coercion. You can find a list of all the supported comparison functions [here](https://pkg.go.dev/text/template#hdr-Functions).

```
{{ if (gt $values.A.Value 80.0) -}}
high
{{ else if (gt $values.A.Value 50.0) -}}
medium
{{ else -}}
low
{{- end }}
```

### Print all labels from a classic condition

You cannot use `$labels` to print labels from the query if you are using classic conditions, and must use `$values` instead. The reason for this is classic conditions discard these labels to enforce uni-dimensional behavior (at most one alert per alert rule). If classic conditions didn't discard these labels, then queries that returned many time series would cause alerts to flap between firing and resolved constantly as the labels would change every time the alert rule was evaluated.

Instead, the `$values` variable contains the reduced values of all time series for all conditions that are firing. For example, if you have an alert rule with a query A that returns two time series, and a classic condition B with two conditions, then `$values` would contain `B0`, `B1`, `B2` and `B3`. If the classic condition B had just one condition, then `$values` would contain just `B0` and `B1`.

To print all labels of all firing time series use the following template (make sure to replace `B` in the regular expression with the Ref ID of the classic condition if it's different):

```
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

### Print all values from a classic condition

To print all values from a classic condition take the previous example and replace `$v.Labels` with `$v.Value`:

```
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
