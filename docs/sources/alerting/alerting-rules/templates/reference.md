---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/reference/
description: Reference for variables and functions in Grafana alert rule templating.
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
title: Annotation and label template reference
menuTitle: Template reference
weight: 101
refs:
  label-types:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#label-types
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#label-types
  notification-template-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/
  language:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/language/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/language/
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
  print-all-labels-from-a-classic-condition:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/examples/#print-all-labels-from-a-classic-condition
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/examples/#print-all-labels-from-a-classic-condition
  template-annotations-and-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# Annotation and label template reference

Annotations and labels in alert rules can be defined using plain text. However, you can also define templates to customize their values with dynamic data from alert rule queries.

For example, you can template the `summary` annotation to include information from query values, providing relevant alert context for responders. Refer to [Template annotations and labels](ref:template-annotations-and-labels) for various use cases.

In templates, variables represent dynamic values from queries, while functions perform actions to transform or format this data.

## Variables

Variables represent dynamic values from alert rule queries that can be displayed or accessed in your templates.

The `$` and `.` symbols are used to reference variables and their properties. You can reference variables directly in your alert rule definitions using the `$` symbol followed by the variable name. Similarly, you can access properties of variables using the dot (`.`) notation in alert rule templates.

```
{{ $values.A.Value }}
```

Templates are based on the **Go templating system**. Refer to [Template language](ref:language) for additional information.

The following variables are available when templating annotations and labels:

| Variables          | Description                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [$labels](#labels) | Contains all labels from the query, only query labels.                                                                                              |
| [$values](#values) | Contains the labels and floating point values of all instant queries and expressions, indexed by their Ref IDs.                                     |
| [$value](#value)   | A string containing the labels and values of all instant queries; threshold, reduce and math expressions, and classic conditions in the alert rule. |

### $labels

The `$labels` variable contains all labels from the query. It excludes [user-configured and reserved labels](ref:label-types), containing only query labels.

{{< figure src="/media/docs/alerting/query-labels-and-values.png" max-width="1200px" caption="An alert rule displaying labels and value from a query." >}}

For example, suppose you have a query that returns CPU usage for all of your servers, and you have an alert rule that fires when any of your servers have exceeded 80% CPU usage for the last 5 minutes. You want to add a summary annotation to the alert that tells you which server is experiencing high CPU usage. With the `$labels` variable you can write a template that prints a human-readable sentence such as:

```
CPU usage for {{ $labels.instance }} has exceeded 80% for the last 5 minutes
```

The outcome of this template would be:

```
CPU usage for server1 has exceeded 80% for the last 5 minutes
```

> If you are using a classic condition then `$labels` will not contain any labels from the query. Classic conditions discard these labels in order to enforce uni-dimensional behavior (at most one alert per alert rule). If you want to use labels from the query in your template then use the example [here](ref:print-all-labels-from-a-classic-condition).

### $values

The `$values` variable is a table containing the labels and floating point values of all instant queries and expressions, indexed by their Ref IDs (e.g, `A`, `B`, `C`, etc.). It does not contain the results of range queries, as they can return hundreds or thousands of rows.

Each Ref IDs, such as `$values.A`, has the following properties

| Property | Type            | Description                                                  |
| -------- | --------------- | ------------------------------------------------------------ |
| `Value`  | Float           | The value returned by the instant query or expression.       |
| `Labels` | Key/value pairs | The labels associated with the instance query or expression. |

Here's the previous example printing now the value of the instant query with Ref ID `A`:

```
{{ $values.A.Value }} CPU usage for {{ $labels.instance }} over the last 5 minutes.
```

If the alert has the label `instance=server1` and the query returns `81.2345`, the template would print:

```
81.2345 CPU usage for instance1 over the last 5 minutes.
```

If the query in Ref ID `A` is a range query rather than an instant query then add a reduce expression with Ref ID `B` and replace `$values.A.Value` with `$values.B.Value`:

```
{{ $values.B.Value }} CPU usage for {{ $labels.instance }} over the last 5 minutes.
```

Alternatively, you can use the `index()` function to retrieve the query value:

```
{{ index $values "B" }} CPU usage for {{ index $labels "instance" }} over the last 5 minutes.
```

#### $value

The `$value` variable is a string containing the labels and values of all instant queries; threshold, reduce and math expressions, and classic conditions in the alert rule.

This example prints the `$value` variable:

```
{{ $value }}: CPU usage has exceeded 80% for the last 5 minutes.
```

It would display something like this:

```
[ var='A' labels={instance=instance1} value=81.234 ]: CPU usage has exceeded 80% for the last 5 minutes.
```

Instead, we recommend using [$values](#values), which contains the same information as `$value` but is structured in an easier-to-use table format.

## Functions

Functions can perform actions in templates such as transforming or formatting data.

Note that the [functions provided by Go's template language](ref:language-functions), such as `index`, `and`, `printf`, and `len`, are available, along with many others.

In addition, the following functions are also available for templating annotations and labels:

**Numbers**

| Name                                      | Arguments        | Returns | Description                                                      |
| ----------------------------------------- | ---------------- | ------- | ---------------------------------------------------------------- |
| [humanize](#humanize)                     | number or string | string  | Humanizes decimal numbers.                                       |
| [humanize1024](#humanize1024)             | number or string | string  | Like `humanize`, but but uses 1024 as the base rather than 1000. |
| [humanizeDuration](#humanizeduration)     | number or string | string  | Humanizes a duration in seconds.                                 |
| [humanizePercentage](#humanizepercentage) | number or string | string  | Humanizes a ratio value to a percentage.                         |
| [humanizeTimestamp](#humanizetimestamp)   | number or string | string  | Humanizes a Unix timestamp.                                      |
| [toTime](#totime)                         | number or string | time    | Converts a Unix timestamp in seconds to time.                    |

**Strings**

| Name                            | Arguments                  | Returns | Description                                                                                   |
| ------------------------------- | -------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| [title](#title)                 | string                     | string  | Capitalizes the first character of each word.                                                 |
| [toUpper](#toupper)             | string                     | string  | Returns all text in uppercase.                                                                |
| [toLower](#tolower)             | string                     | string  | Returns all text in lowercase.                                                                |
| [stripPort](#stripport)         | string                     | string  | Returns only host.                                                                            |
| [match](#match)                 | pattern, text              | boolean | Matches the text against a regular expression pattern.                                        |
| [reReplaceAll](#rereplaceall)   | pattern, replacement, text | string  | Replaces text matching the regular expression.                                                |
| [graphLink](#graphlink)         | expr                       | string  | Returns the path to the graphical view in `Explore` for the given expression and data source. |
| [tableLink](#tablelink)         | expr                       | string  | Returns the path to the tabular view in `Explore` for the given expression and data source.   |
| [parseDuration](#parseduration) | string                     | float   | Parses a duration string such as "1h" into the number of seconds it represents.               |
| [stripDomain](#stripdomain)     | string                     | string  | Returns the result of removing the domain part of a FQDN.                                     |

**Others**

| Name                        | Arguments     | Returns                | Description                                                                      |
| --------------------------- | ------------- | ---------------------- | -------------------------------------------------------------------------------- |
| [args](#args)               | []interface{} | map[string]interface{} | Translates a list of objects to a map with keys arg0, arg1 etc.                  |
| [safeHtml](#safehtml)       | string        | string                 | Marks string as HTML not requiring auto-escaping.                                |
| [externalURL](#externalurl) | none          | string                 | Returns the external URL of the Grafana server as configured in the ini file(s). |
| [pathPrefix](#pathprefix)   | none          | string                 | Returns the path of the Grafana server as configured in the ini file(s).         |

For further context on these functions, note that templating in Grafana is based on the [Prometheus template implementation](https://prometheus.io/docs/prometheus/latest/configuration/template_reference/), enabling the use of these functions and Prometheus-like templates for formatting alert messages within Grafana.

#### humanize

The `humanize` function humanizes decimal numbers:

```
{{ humanize 1000.0 }}
```

```
1k
```

#### humanize1024

The `humanize1024` works similar to `humanize` but but uses 1024 as the base rather than 1000:

```
{{ humanize1024 1024.0 }}
```

```
1ki
```

#### humanizeDuration

The `humanizeDuration` function humanizes a duration in seconds:

```
{{ humanizeDuration 60.0 }}
```

```
1m 0s
```

#### humanizePercentage

The `humanizePercentage` function humanizes a ratio value between 0 and 1 to a percentage:

```
{{ humanizePercentage 0.2 }}
```

```
20%
```

#### humanizeTimestamp

The `humanizeTimestamp` function humanizes a Unix timestamp:

```
{{ humanizeTimestamp 1577836800.0 }}
```

```
2020-01-01 00:00:00 +0000 UTC
```

#### toTime

The `toTime` function converts a Unix timestamp in seconds to time.:

```
{{ toTime 1727802106 }}
```

```
2024-10-01 17:01:46 +0000 UTC
```

#### title

The `title` function capitalizes the first character of each word:

```
{{ title "hello, world!" }}
```

```
Hello, World!
```

#### toUpper

The `toUpper` function returns all text in uppercase:

```
{{ toUpper "Hello, world!" }}
```

```
HELLO, WORLD!
```

#### toLower

The `toLower` function returns all text in lowercase:

```
{{ toLower "Hello, world!" }}
```

```
hello, world!
```

#### stripPort

The `stripPort` splits string into host and port, then returns only host:

```
{{ stripPort "example.com:8080" }}
```

```
example.com
```

#### match

The `match` function matches the text against a regular expression pattern:

```
{{ match "a.*" "abc" }}
```

```
true
```

#### reReplaceAll

The `reReplaceAll` function replaces text matching the regular expression:

```
{{ reReplaceAll "localhost:(.*)" "example.com:$1" "localhost:8080" }}
```

```
example.com:8080
```

#### graphLink

The `graphLink` function returns the path to the graphical view in [Explore](ref:explore) for the given expression and data source:

```
{{ graphLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}
```

```
/explore?left=["now-1h","now","gdev-prometheus",{"datasource":"gdev-prometheus","expr":"up","instant":false,"range":true}]
```

#### parseDuration

The `parseDuration` function parses a duration string such as "1h" into the number of seconds it represents.

```
{{ parseDuration "1h" }}
```

```
3600
```

#### stripDomain

The `stripDomain` removes the domain part of a FQDN, leaving port untouched:

```
{{ stripDomain "example.com:8080" }}
```

```
example:8080
```

#### tableLink

The `tableLink` function returns the path to the tabular view in [Explore](ref:explore) for the given expression and data source:

```
{{ tableLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}
```

```
/explore?left=["now-1h","now","gdev-prometheus",{"datasource":"gdev-prometheus","expr":"up","instant":true,"range":false}]
```

#### args

The `args` function translates a list of objects to a map with keys arg0, arg1 etc. This is intended to allow multiple arguments to be passed to templates:

```
{{define "x"}}{{.arg0}} {{.arg1}}{{end}}{{template "x" (args 1 "2")}}
```

```
1 2
```

#### safeHtml

The `safeHtml` function marks string as HTML not requiring auto-escaping:

```
{{ safeHtml "<b>Text</b>"}}
```

```
<b>Text</b>
```

#### externalURL

The `externalURL` function returns the external URL of the Grafana server as configured in the ini file(s):

```
{{ externalURL }}
```

```
https://example.com/grafana
```

#### pathPrefix

The `pathPrefix` function returns the path of the Grafana server as configured in the ini file(s):

```
{{ pathPrefix }}
```

```
/grafana
```

## Differences with notification templates

Both notification templates and alert rule templates use the Go templating system. However, the [functions and variables available in notification templates](ref:notification-template-reference) differ from those used in annotations and labels templates, which are described in this documentation.

Annotation and label templates operate in the context of an individual alert instance, while notification templates apply to a notification that includes a group of alert(s).

For example, notification templates provide the `.Alerts` variable, which includes the list of all firing and resolved alerts in the notification. This variable is not available in alert rule templates, which operate within the context of a single alert instance.

Additionally, you cannot reuse templates for labels and annotations as you can with notification templates. Instead, you need to write each template inline within the label or annotation fields and manually copy them wherever you want to reuse the templates.
