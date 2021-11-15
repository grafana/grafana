+++
title = "Annotations and labels for alerting rules"
description = "Annotations and labels for alerting"
keywords = ["grafana", "alerting", "guide", "rules", "create"]
weight = 401
+++

# Annotations and labels for alerting rules

Annotations and labels help customize alert messages so that you can quickly identify the service or application that needs attention.

## Annotations

Annotations are key-value pairs that provide additional meta-information about an alert. For example: a description, a summary, and runbook URL. These are displayed in rule and alert details in the UI and can be used in contact type message templates. Annotations can also be templated, for example `Instance {{ $labels.instance }} down` will have the evaluated `instance` label value added for every alert this rule produces.

## Labels

Labels are key-value pairs that categorize or identify an alert. Labels are used to match alerts in silences or match and groups alerts in notification policies. Labels are also shown in rule or alert details in the UI and can be used in contact type message templates. For example, you can add a `severity` label, then configure a separate notification policy for each severity. You can also add, for example, a `team` label and configure notification policies specific to the team or silence all alerts for a particular team. Labels can also be templated like annotations, for example, `{{ $labels.namespace }}/{{ $labels.job }}` will produce a new rule label that will have the evaluated `namespace` and `job` label value added for every alert this rule produces. The rule labels take precedence over the labels produced by the query/condition.

{{< figure src="/static/img/docs/alerting/unified/rule-edit-details-8-0.png" max-width="550px" caption="Alert details" >}}

#### Template variables

The following template variables are available when expanding annotations and labels.

| Name    | Description                                                                                                                                                                                                                                                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| $labels | The labels from the query or condition. For example, `{{ $labels.instance }}` and `{{ $labels.job }}`. This is unavailable when the rule uses a classic condition.                                                                                                                                                                                                      |
| $values | The values of all reduce and math expressions that were evaluated for this alert rule. For example, `{{ $values.A }}`, `{{ $values.A.Labels }}` and `{{ $values.A.Value }}` where `A` is the `refID` of the expression. This is unavailable when the rule uses a [classic condition]({{< relref "./create-grafana-managed-rule/#single-and-multi-dimensional-rule" >}}) |
| $value  | The value string of the alert instance. For example, `[ var='A' labels={instance=foo} value=10 ]`.                                                                                                                                                                                                                                                                      |

#### Template functions

The following template functions are available when expanding annotations and labels.

| Name               | Argument                                                     | Return                 | Description                                                                                                                                 |
| ------------------ | ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| humanize           | number or string                                             | string                 | Converts a number to a more readable format, using metric prefixes.                                                                         |
| humanize1024       | number or string                                             | string                 | Like humanize, but uses 1024 as the base rather than 1000.                                                                                  |
| humanizeDuration   | number or string                                             | string                 | Converts a duration in seconds to a more readable format.                                                                                   |
| humanizePercentage | number or string                                             | string                 | Converts a ratio value to a fraction of 100.                                                                                                |
| humanizeTimestamp  | number or string                                             | string                 | Converts a Unix timestamp in seconds to a more readable format.                                                                             |
| title              | string                                                       | string                 | strings.Title, capitalises first character of each word.                                                                                    |
| toUpper            | string                                                       | string                 | strings.ToUpper, converts all characters to upper case.                                                                                     |
| toLower            | string                                                       | string                 | strings.ToLower, converts all characters to lower case.                                                                                     |
| match              | pattern, text                                                | boolean                | regexp.MatchString Tests for a unanchored regexp match.                                                                                     |
| reReplaceAll       | pattern, replacement, text                                   | string                 | Regexp.ReplaceAllString Regexp substitution, unanchored.                                                                                    |
| graphLink          | string - JSON Object with `"expr"` and `"datasource"` fields | string                 | Returns the path to graphical view in [Explore](https://grafana.com/docs/grafana/latest/explore/) for the given expression and data source. |
| tableLink          | string- JSON Object with `"expr"` and `"datasource"` fields  | string                 | Returns the path to tabular view in [Explore](https://grafana.com/docs/grafana/latest/explore/) for the given expression and data source.   |
| args               | []interface{}                                                | map[string]interface{} | Converts a list of objects to a map with keys, for example, arg0, arg1. Use this function to pass multiple arguments to templates.          |
| externalURL        | nothing                                                      | string                 | Returns a string representing the external URL.                                                                                             |
| pathPrefix         | nothing                                                      | string                 | Returns the path of the external URL.                                                                                                       |
| tmpl               | string, []interface{}                                        | nothing                | Not supported                                                                                                                               |
| safeHtml           | string                                                       | string                 | Not supported                                                                                                                               |
| query              | query string                                                 | []sample               | Not supported                                                                                                                               |
| first              | []sample                                                     | sample                 | Not supported                                                                                                                               |
| label              | label, sample                                                | string                 | Not supported                                                                                                                               |
| strvalue           | []sample                                                     | string                 | Not supported                                                                                                                               |
| value              | sample                                                       | float64                | Not supported                                                                                                                               |
| sortByLabel        | label, []samples                                             | []sample               | Not supported                                                                                                                               |
