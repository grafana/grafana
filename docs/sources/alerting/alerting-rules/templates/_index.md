---
aliases:
  - ../fundamentals/annotation-label/variables-label-annotation/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/annotation-label/variables-label-annotation/
  - ../alerting-rules/templating-labels-annotations/ # /docs/grafana/<GRAFANA_VERSION>/alerting-rules/templating-labels-annotations/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/
description: Learn how to template annotations and labels to include data from queries and expressions in alert messages
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
title: Template annotations and labels
weight: 500
refs:
  explore:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# Template annotations and labels

You can use templates to include data from queries and expressions in labels and annotations. For example, you might want to set the severity label for an alert based on the value of the query, or use the instance label from the query in a summary annotation so you know which server is experiencing high CPU usage.

When using custom labels with templates it is important to make sure that the label value does not change between consecutive evaluations of the alert rule as this will end up creating large numbers of distinct alerts. However, it is OK for the template to produce different label values for different alerts. For example, do not put the value of the query in a custom label as this will end up creating a new set of alerts each time the value changes. Instead use annotations.

All templates should be written in [text/template](https://pkg.go.dev/text/template). Regardless of whether you are templating a label or an annotation, you should write each template inline inside the label or annotation that you are templating. This means you cannot share templates between labels and annotations, and instead you will need to copy templates wherever you want to use them.

Each template is evaluated whenever the alert rule is evaluated, and is evaluated for every alert separately. For example, if your alert rule has a templated summary annotation, and the alert rule has 10 firing alerts, then the template will be executed 10 times, once for each alert. You should try to avoid doing expensive computations in your templates as much as possible.

{{% admonition type="caution" %}}
Extra whitespace in label templates can break matches with notification policies.
{{% /admonition %}}

## Variables

In Grafana templating, the `$` and `.` symbols are used to reference variables and their properties. You can reference variables directly in your alert rule definitions using the `$` symbol followed by the variable name. Similarly, you can access properties of variables using the dot (`.`) notation within alert rule definitions.

The following variables are available to you when templating labels and annotations:

### The labels variable

The `$labels` variable contains all labels from the query. For example, suppose you have a query that returns CPU usage for all of your servers, and you have an alert rule that fires when any of your servers have exceeded 80% CPU usage for the last 5 minutes. You want to add a summary annotation to the alert that tells you which server is experiencing high CPU usage. With the `$labels` variable you can write a template that prints a human-readable sentence such as:

```
CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes
```

> If you are using a classic condition then `$labels` will not contain any labels from the query. Classic conditions discard these labels in order to enforce uni-dimensional behavior (at most one alert per alert rule). If you want to use labels from the query in your template then use the example [here](#print-all-labels-from-a-classic-condition).

### The value variable

The `$value` variable is a string containing the labels and values of all instant queries; threshold, reduce and math expressions, and classic conditions in the alert rule. It does not contain the results of range queries, as these can return anywhere from 10s to 10,000s of rows or metrics. If it did, for especially large queries a single alert could use 10s of MBs of memory and Grafana would run out of memory very quickly.

To print the `$value` variable in the summary you would write something like this:

```
CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes: {{ $value }}
```

And would look something like this:

```
CPU usage for instance1 has exceeded 80% for the last 5 minutes: [ var='A' labels={instance=instance1} value=81.234 ]
```

Here `var='A'` refers to the instant query with Ref ID A, `labels={instance=instance1}` refers to the labels, and `value=81.234` refers to the average CPU usage over the last 5 minutes.

If you want to print just some of the string instead of the full string then use the `$values` variable. It contains the same information as `$value`, but in a structured table, and is much easier to use then writing a regular expression to match just the text you want.

### The values variable

The `$values` variable is a table containing the labels and floating point values of all instant queries and expressions, indexed by their Ref IDs.

To print the value of the instant query with Ref ID A:

```
CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes: {{ index $values "A" }}
```

For example, given an alert with the labels `instance=server1` and an instant query with the value `81.2345`, this would print:

```
CPU usage for instance1 has exceeded 80% for the last 5 minutes: 81.2345
```

If the query in Ref ID A is a range query rather than an instant query then add a reduce expression with Ref ID B and replace `(index $values "A")` with `(index $values "B")`:

```
CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes: {{ index $values "B" }}
```

## Functions

The following functions are available to you when templating labels and annotations:

### args

The `args` function translates a list of objects to a map with keys arg0, arg1 etc. This is intended to allow multiple arguments to be passed to templates:

```
{{define "x"}}{{.arg0}} {{.arg1}}{{end}}{{template "x" (args 1 "2")}}
```

```
1 2
```

### externalURL

The `externalURL` function returns the external URL of the Grafana server as configured in the ini file(s):

```
{{ externalURL }}
```

```
https://example.com/grafana
```

### graphLink

The `graphLink` function returns the path to the graphical view in [Explore](ref:explore) for the given expression and data source:

```
{{ graphLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}
```

```
/explore?left=["now-1h","now","gdev-prometheus",{"datasource":"gdev-prometheus","expr":"up","instant":false,"range":true}]
```

### humanize

The `humanize` function humanizes decimal numbers:

```
{{ humanize 1000.0 }}
```

```
1k
```

### humanize1024

The `humanize1024` works similar to `humanize` but but uses 1024 as the base rather than 1000:

```
{{ humanize1024 1024.0 }}
```

```
1ki
```

### humanizeDuration

The `humanizeDuration` function humanizes a duration in seconds:

```
{{ humanizeDuration 60.0 }}
```

```
1m 0s
```

### humanizePercentage

The `humanizePercentage` function humanizes a ratio value to a percentage:

```
{{ humanizePercentage 0.2 }}
```

```
20%
```

### humanizeTimestamp

The `humanizeTimestamp` function humanizes a Unix timestamp:

```
{{ humanizeTimestamp 1577836800.0 }}
```

```
2020-01-01 00:00:00 +0000 UTC
```

### match

The `match` function matches the text against a regular expression pattern:

```
{{ match "a.*" "abc" }}
```

```
true
```

### pathPrefix

The `pathPrefix` function returns the path of the Grafana server as configured in the ini file(s):

```
{{ pathPrefix }}
```

```
/grafana
```

### tableLink

The `tableLink` function returns the path to the tabular view in [Explore](ref:explore) for the given expression and data source:

```
{{ tableLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}
```

```
/explore?left=["now-1h","now","gdev-prometheus",{"datasource":"gdev-prometheus","expr":"up","instant":true,"range":false}]
```

### title

The `title` function capitalizes the first character of each word:

```
{{ title "hello, world!" }}
```

```
Hello, World!
```

### toLower

The `toLower` function returns all text in lowercase:

```
{{ toLower "Hello, world!" }}
```

```
hello, world!
```

### toUpper

The `toUpper` function returns all text in uppercase:

```
{{ toUpper "Hello, world!" }}
```

```
HELLO, WORLD!
```

### reReplaceAll

The `reReplaceAll` function replaces text matching the regular expression:

```
{{ reReplaceAll "localhost:(.*)" "example.com:$1" "localhost:8080" }}
```

```
example.com:8080
```
