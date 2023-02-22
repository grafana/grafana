---
description: Learn about templating of labels and annotations
keywords:
  - grafana
  - alerting
  - templating
  - labels
  - annotations
title: Templating labels and annotations
weight: 117
---

# Templating labels and annotations

In Grafana you template labels and annotations just like you would in Prometheus. If you have used Prometheus before then you should be familiar with the `$labels` and `$value` variables which contain the labels and value of the alert. You can use the same variables in Grafana, even if the alert does not use a Prometheus datasource. If you haven't used Prometheus before then don't worry as each of these variables, and how to template them, will be explained as you follow the rest of this page.

## Go's templating language

Templates for labels and annotations are written in Go's templating language, [text/template](https://pkg.go.dev/text/template).

### Opening and closing tags

In text/template, templates start with `{{` and end with `}}` irrespective of whether the template prints a variable or executes control structures such as if statements. This is different from other templating languages such as Jinja where printing a variable uses `{{` and `}}` and control structures use `{%` and `%}`.

### Print

To print the value of something use `{{` and `}}`. You can print the the result of a function or the value of a variable. For example, to print the `$labels` variable you would write the following:

```
{{ $labels }}
```

### Iterate over labels

To iterate over each label in `$labels` you can use a `range`. Here `$k` refers to the name and `$v` refers to the value of the current label. For example, if your query returned a label `instance=test` then `$k` would be `instance` and `$v` would be `test`.

```
{{ range $k, $v := $labels }}
{{ $k }}={{ $v }}
{{ end }}
```

## The labels, value and values variables

### The labels variable

The `$labels` variable contains the labels from the query. For example, a query that checks if an instance is down might return an instance label with the name of the instance that is down. For example, suppose you have an alert rule that fires when one of your instances has been down for more than 5 minutes. You want to add a summary to the alert that tells you which instance is down. With the `$labels` variable, you can create a summary that prints the instance label in the summary:

```
Instance {{ $labels.instance }} has been down for more than 5 minutes
```

### Labels with dots

If the label you want to print contains a dot (full stop or period) in its name using the same dot in the template will not work:

```
Instance {{ $labels.instance.name }} has been down for more than 5 minutes
```

This is because the template is attempting to use a non-existing field called `name` in `$labels.instance`. You should instead use the `index` function, which prints the label `instance.name` in the `$labels` variable:

```
Instance {{ index $labels "instance.name" }} has been down for more than 5 minutes
```

### The value variable

The `$value` variable works different from Prometheus. In Prometheus `$value` is a floating point number containing the value of the expression, but in Grafana it is a string containing the labels and values of all Threshold, Reduce and Math expressions, and Classic Conditions for this alert rule. It does not contain the results of queries, as these can return anywhere from 10s to 10,000s of rows or metrics.

If you were to use the `$value` variable in the summary of an alert:

```
{{ $labels.service }} has over 5% of responses with 5xx errors: {{ $value }})
```

The summary might look something like the following:

```
api has an over 5% of responses with 5xx errors: [ var='B' labels={service=api} value=6.789 ]
```

Here `var='B'` refers to the expression with the RefID B. In Grafana, all queries and expressions are identified by a RefID that identifies each query and expression in an alert rule. Similarly `labels={service=api}` refers to the labels, and `value=6.789` refers to the value.

You might have observed that there is no RefID A. That is because in most alert rules the RefID A refers to a query, and since queries can return many rows or time series they are not included in `$value`.

### The values variable

If the `$value` variable contains more information than you need, you can instead print the labels and value of individual expressions using `$values`. Unlike `$value`, the `$values` variable is a table of objects containing the labels and floating point values of each expression, indexed by their RefID.

If you were to print the value of the expression with RefID `B` in the summary of the alert:

```
{{ $labels.service }} has over 5% of responses with 5xx errors: {{ $values.B }}%
```

The summary will contain just the value:

```
api has an over 5% of responses with 5xx errors: 6.789%
```

However, while `{{ $values.B }}` prints the number 6.789, it is actually a string as you are printing the object that contains both the labels and value for RefID B, not of the floating point value of B. To use the floating point value of RefID B you must use the `Value` field from `$values.B`. If you were to humanize the floating point value in the summary of an alert:

```
{{ $labels.service }} has over 5% of responses with 5xx errors: {{ humanize $values.B.Value }}%
```

### No data, execution errors and timeouts

If the query in your alert rule returns no data, or fails because of a datasource error or timeout, then any Threshold, Reduce or Math expressions that use that query will also return no data or an error. When this happens these expression will be absent from `$values`. It is good practice to check that a RefID is present before using it as otherwise your template will break should your query return no data or an error. You can do this using an if statement:

```
{{ if $values.B }}{{ $labels.service }} has over 5% of responses with 5xx errors: {{ humanize $values.B.Value }}%{{ end }}
```

## Classic Conditions

If the rule uses Classic Conditions instead of Threshold, Reduce and Math expressions, then the `$values` variable is indexed by both the Ref ID and position of the condition in the Classic Condition. For example, if you have a Classic Condition with RefID B containing two conditions, then `$values` will contain two conditions `B0` and `B1`.

```
The first condition is {{ $values.B0 }}, and the second condition is {{ $values.B1 }}
```

## Reference

### Variables

The following template variables are available when expanding labels and annotations:

| Name    | Description                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| $labels | The labels from the query or condition. For example, `{{ $labels.instance }}` and `{{ $labels.job }}`. This is unavailable when the rule uses a [classic condition]({{< relref "../../alerting-rules/create-grafana-managed-rule/#single-and-multi-dimensional-rule" >}}).                                                                                                                                 |
| $values | The values of all reduce and math expressions that were evaluated for this alert rule. For example, `{{ $values.A }}`, `{{ $values.A.Labels }}` and `{{ $values.A.Value }}` where `A` is the `refID` of the reduce or math expression. If the rule uses a classic condition instead of a reduce and math expression, then `$values` contains the combination of the `refID` and position of the condition. |
| $value  | The value string of the alert instance. For example, `[ var='A' labels={instance=foo} value=10 ]`.                                                                                                                                                                                                                                                                                                         |

### Functions

The following functions are also available when expanding labels and annotations:

| Name                                      | Argument type                                                | Return type            | Description                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [humanize](#humanize)                     | number or string                                             | string                 | Converts a number to a more readable format, using metric prefixes.                                                                         |
| [humanize1024](#humanize1024)             | number or string                                             | string                 | Like humanize, but uses 1024 as the base rather than 1000.                                                                                  |
| [humanizeDuration](#humanizeduration)     | number or string                                             | string                 | Converts a duration in seconds to a more readable format.                                                                                   |
| [humanizePercentage](#humanizepercentage) | number or string                                             | string                 | Converts a ratio value to a fraction of 100.                                                                                                |
| [humanizeTimestamp](#humanizetimestamp)   | number or string                                             | string                 | Converts a Unix timestamp in seconds to a more readable format.                                                                             |
| [title](#title)                           | string                                                       | string                 | strings.Title, capitalises first character of each word.                                                                                    |
| [toUpper](#toupper)                       | string                                                       | string                 | strings.ToUpper, converts all characters to upper case.                                                                                     |
| [toLower](#tolower)                       | string                                                       | string                 | strings.ToLower, converts all characters to lower case.                                                                                     |
| [match](#match)                           | pattern, text                                                | boolean                | regexp.MatchString Tests for a unanchored regexp match.                                                                                     |
| [reReplaceAll](#rereplaceall)             | pattern, replacement, text                                   | string                 | Regexp.ReplaceAllString Regexp substitution, unanchored.                                                                                    |
| [graphLink](#graphlink)                   | string - JSON Object with `"expr"` and `"datasource"` fields | string                 | Returns the path to graphical view in [Explore](https://grafana.com/docs/grafana/latest/explore/) for the given expression and data source. |
| [tableLink](#tablelink)                   | string- JSON Object with `"expr"` and `"datasource"` fields  | string                 | Returns the path to tabular view in [Explore](https://grafana.com/docs/grafana/latest/explore/) for the given expression and data source.   |
| [args](#args)                             | []interface{}                                                | map[string]interface{} | Converts a list of objects to a map with keys, for example, arg0, arg1. Use this function to pass multiple arguments to templates.          |
| [externalURL](#externalurl)               | nothing                                                      | string                 | Returns a string representing the external URL.                                                                                             |
| [pathPrefix](#pathprefix)                 | nothing                                                      | string                 | Returns the path of the external URL.                                                                                                       |
