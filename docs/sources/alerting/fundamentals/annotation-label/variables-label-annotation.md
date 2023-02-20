---
description: Learn about templating of labels and annotations
keywords:
  - grafana
  - alerting
  - guide
  - fundamentals
title: Templating labels and annotations
weight: 117
---

# Templating labels and annotations

In Grafana, you can template labels and annotations just like in Prometheus. Those who have used Prometheus before should be familiar with `$labels` and `$value` as these variables contain the labels and value of the alert. You can use the same variables in Grafana to template labels and annotations, even if the alert does not use a Prometheus data source.

## Printing labels

Suppose you want to create an alert rule that fires when an instance is down for more than 5 minutes. You want the alert to contain a summary telling you which instance is down. You can do this by creating a summary annotation that prints the instance label and the message "has been down for more than 5 minutes".

```
Instance {{ $labels.instance }} has been down for more than 5 minutes
```

## Labels with dots

If the label contains a dot (full stop or period) in its name then the following will not work:

```
Instance {{ $labels.instance.name }} has been down for more than 5 minutes
```

This is because it is attempting to use a non-existing field `name` in `$labels.instance` rather than `instance.name` in `$labels`. Instead use the `index` function to print `instance.name`:

```
Instance {{ index $labels "instance.name" }} has been down for more than 5 minutes
```

## Printing the ValueString

You can print the value of the alert with `$value`. However, where `$value` in Prometheus is a floating point number containing the value of the expression, in Grafana it is is a string containing the labels and values of all Threshold, Reduce and Maths expressions from the alert rule definition. It does not contain time series or tabular data, as a single query can return anywhere from 1 to 10,000s of rows or metrics.

This `$value` variable is called the ValueString. If you were to use it in the template of a summary annotation:

```
{{ $labels.instance }} has an average 95th percentile request latency above 1s: {{ $value }})
```

you would get the following summary:

```
http_server has an average 95th percentile request latency above 1s: [ var='B' labels={instance=http_server} value=10 ]
```

## Printing the values of individual expressions

You can also print the values of individual expressions with `$values`. For example, if you have an alert rule with a Reduce expression `B` and a Math expression `C`, you can print just the value of `B`:

```
{{ $labels.instance }} has an average 95th percentile request latency above 1s: {{ $values.B }}
```

and then you would get this summary:

```
http_server has an average 95th percentile request latency above 1s: 11
```

You might want to do this if your Math expression `C` is a boolean comparison, for example:

```
$B > 100
```

as its value will be either 0 or 1 depending on the result of the comparison.

## No data and execution errors or timeouts

Should query `A` return no data then the reduce expression `B` will also return no data. This means that
`{{ $values.B }}` will be nil. To ensure that labels and annotations can still be templated even when a query returns no data, we can use an if statement to check for this condition:

```
{{ if $values.B }}{{ $labels.instance }} has a 95th percentile request latency above 1s: {{ $values.B }}){{ end }}
```

## Classic Conditions

If the rule uses Classic Conditions instead of Reduce and Math expressions, then `$values` contains the combination of the Ref ID and position of the condition. For example, `{{ $values.A0 }}` and `{{ $values.A1 }}`.

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

#### humanize

**Template string** `{ humanize $value }`

**Input** `1234567.0`

**Expected** `1.235M`

#### humanize1024

**TemplateString** `{ humanize1024 $value } `

**Input** `1048576.0`

**Expected** `1Mi`

#### humanizeDuration

**TemplateString** `{ humanizeDuration $value }`

**Input** `899.99`

**Expected** `14m 59s`

#### humanizePercentage

**TemplateString** `{ humanizePercentage $value }`

**Input** `0.1234567`

**Expected** `12.35%`

#### humanizeTimestamp

**TemplateString** `{ $value | humanizeTimestamp }`

**Input** `1435065584.128`

**Expected** `2015-06-23 13:19:44.128 +0000 UTC`

#### title

**TemplateString** `{ $value | title }`

**Input** `aa bb CC`

**Expected** `Aa Bb Cc`

#### toUpper

**TemplateString** `{ $value | toUpper }`

**Input** `aa bb CC`

**Expected** `AA BB CC`

#### toLower

**TemplateString** `{ $value | toLower }`

**Input** `aA bB CC`

**Expected** `aa bb cc`

#### match

**TemplateString** `{ match "a+" $labels.instance }`

**Input** `aa`

**Expected** `true`

#### reReplaceAll

**TemplateString** `{{ reReplaceAll "localhost:(.*)" "my.domain:$1" $labels.instance }}`

**Input** `localhost:3000`

**Expected** `my.domain:3000`

#### graphLink

**TemplateString** `{{ graphLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}`

**Expected** `/explore?left=["now-1h","now","gdev-prometheus",{"datasource":"gdev-prometheus","expr":"up","instant":false,"range":true}]`

#### tableLink

**TemplateString** `{{ tableLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}`

**Expected** `/explore?left=["now-1h","now","gdev-prometheus",{"datasource":"gdev-prometheus","expr":"up","instant":true,"range":false}]`

#### args

**TemplateString** `{{define "x"}}{{.arg0}} {{.arg1}}{{end}}{{template "x" (args 1 "2")}}`

**Expected** `1 2`

#### externalURL

**TemplateString** `{ externalURL }`

**Expected** `http://localhost/path/prefix`

#### pathPrefix

**TemplateString** `{ pathPrefix }`

**Expected** `/path/prefix`
