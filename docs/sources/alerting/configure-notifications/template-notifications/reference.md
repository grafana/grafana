---
aliases:
  - ../../manage-notifications/template-notifications/reference/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/template-notifications/reference/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/reference/
description: Learn about templating notifications options
keywords:
  - grafana
  - alerting
  - notifications
  - templates
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Notification template reference
menuTitle: Template reference
weight: 102
refs:
  label-types:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#label-types
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#label-types
  alert-rule-template-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/
  alert-grouping:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/
  template-language:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/language/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/language/
  template-language-functions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/language/#functions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/language/#functions
---

# Notification template reference

By default, Grafana provides predefined templates to format notification messages.

You can also customize your notifications with custom templates, which are based on the [Go template language](ref:template-language).

This documentation lists the data available for use in notification templates.

## Notification Data

In notification templates, dot (`.`) is initialized with the following data:

| Name                | Type              | Description                                                                                           |
| ------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `Receiver`          | string            | The name of the contact point sending the notification                                                |
| `Status`            | string            | The status is `firing` if at least one alert is firing, otherwise `resolved`.                         |
| `Alerts`            | [][Alert](#alert) | List of all firing and resolved alerts in this notification.                                          |
| `Alerts.Firing`     | [][Alert](#alert) | List of all firing alerts in this notification.                                                       |
| `Alerts.Resolved`   | [][Alert](#alert) | List of all resolved alerts in this notification.                                                     |
| `GroupLabels`       | [KV](#kv)         | The labels that group these alerts in this notification based on the `Group by` option.               |
| `CommonLabels`      | [KV](#kv)         | The labels common to all alerts in this notification.                                                 |
| `CommonAnnotations` | [KV](#kv)         | The annotations common to all alerts in this notification.                                            |
| `ExternalURL`       | string            | A link to Grafana, or the Alertmanager that sent this notification if using an external Alertmanager. |

It's important to remember that [a single notification can group multiple alerts](ref:alert-grouping) to reduce the number of alerts you receive. `Alerts` is an array that includes all the alerts in the notification.

Here's an example that prints all available notification data from dot (`.`):

```go
{{ define "custom_template" }}
  {{ .Receiver }}
  {{ .Status }}
  There are {{ len .Alerts }} alerts
  There are {{ len .Alerts.Firing }} firing alerts
  There are {{ len .Alerts.Resolved }} resolved alerts
  {{ .GroupLabels }}
  {{ .CommonLabels }}
  {{ .CommonAnnotations }}
  {{ .ExternalURL }}
{{ end }}
```

## Alert

`Alert` contains data for an individual alert:

| Name           | Type          | Description                                                                                                                                    |
| -------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Status`       | string        | Firing or resolved.                                                                                                                            |
| `Labels`       | [KV](#kv)     | The labels for this alert. It includes all [types of labels](ref:label-types).                                                                 |
| `Annotations`  | [KV](#kv)     | The annotations for this alert.                                                                                                                |
| `StartsAt`     | [Time](#time) | The time the alert fired                                                                                                                       |
| `EndsAt`       | [Time](#time) | Only set if the end time of an alert is known. Otherwise set to a configurable timeout period from the time since the last alert was received. |
| `GeneratorURL` | string        | A link to Grafana, or the source of the alert if using an external alert generator.                                                            |
| `Fingerprint`  | string        | A unique string that identifies the alert.                                                                                                     |

Grafana-managed alerts include these additional properties:

| Name           | Type      | Description                                                                          |
| -------------- | --------- | ------------------------------------------------------------------------------------ |
| `DashboardURL` | string    | A link to the Grafana Dashboard if the alert has a Dashboard UID annotation.         |
| `PanelURL`     | string    | A link to the panel if the alert has a Panel ID annotation.                          |
| `SilenceURL`   | string    | A link to silence the alert.                                                         |
| `Values`       | [KV](#kv) | The values of all expressions, including Classic Conditions.                         |
| `ValueString`  | string    | A string that contains the labels and value of each reduced expression in the alert. |

This example iterates over the list of firing and resolved alerts (`.Alerts`) in the notification and prints the data for each alert:

```go
{{ define "custom_template" }}
{{ range .Alerts }}
  {{ .Status }}
  {{ .Labels }}
  {{ .Annotations }}
  {{ .StartsAt }}
  {{ .EndsAt }}
  {{ .GeneratorURL }}
  {{ .Fingerprint }}

  {{/* Only available for Grafana-managed alerts */}}
  {{ .DashboardURL }}
  {{ .PanelURL }}
  {{ .SilenceURL }}
  {{ .Values }}
  {{ .ValueString }}
{{ end }}
{{ end }}
```

## KV

`KV` is a set of key value pairs, where each key and value is a string.

Similarly to accessing variable properties, you can use `.` to retrieve the value of a value. For example:

```go
{{ define "custom_template" }}
  {{ .CommonLabels.grafana_folder }}
{{ end }}
```

If a KV happens to contain numbers or bools then these are string representations of the numeric or boolean value.

Additionally, KV provides methods to sort the pairs, remove keys, and iterate over just the keys or values:

| Method name | Description                                    | Arguments | Returns   |
| ----------- | ---------------------------------------------- | --------- | --------- |
| SortedPairs | Returns a sorted list of key/value pairs.      |           | Pairs     |
| Remove      | Returns a copy of the KV with the keys removed | []string  | [KV](#kv) |
| Names       | Return the names of the label names            |           | []string  |
| Values      | Return a list of the values                    |           | []string  |

Here's an example of using these methods:

```go
{{ define "custom_template" }}
  {{ .CommonLabels.SortedPairs }}
  {{ .CommonLabels.Names }}
  {{ .CommonLabels.Values }}
  {{ .CommonLabels.Remove (stringSlice "grafana_folder") }}
{{ end }}
```

## Time

Some template functions and properties return a `Time` object, which refers to the [type `Time`](https://pkg.go.dev/time#Time) in Go's time package.

When accessing a `Time` object, you can use various [`Time` functions](https://pkg.go.dev/time#Time) in your templates as follows.

```go
{{ define "custom_template" }}
  {{ range .Alerts }}
    {{ .StartsAt  }}
    {{ .StartsAt.Add 6000000000000  }}
    {{ .StartsAt.Add -6000000000000  }}
    {{ .StartsAt.AddDate 1 0 0  }}
    {{ .StartsAt.Year   }}/{{ .StartsAt.Month   }}/{{ .StartsAt.Day   }}
    {{ .StartsAt.Hour   }}:{{ .StartsAt.Minute   }}:{{ .StartsAt.Second   }}
    {{ .StartsAt.YearDay   }}-{{ .StartsAt.Weekday   }}
    {{ .StartsAt.Unix }} {{ .StartsAt.UnixMilli }}
  {{ end}}
{{ end }}
```

## Functions

Functions can perform actions in templates such as transforming or formatting data.

Note that the [functions provided by Go's template language](ref:template-language-functions), such as `index`, `and`, `printf`, and `len`, are available, along with many others.

In addition, the following functions are also available for templating notifications:

| Name           | Arguments                  | Returns       | Description                                                                                                                                                                                                      |
| -------------- | -------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`        | string                     | string        | Capitalizes the first character of each word.                                                                                                                                                                    |
| `toUpper`      | string                     | string        | Returns all text in uppercase.                                                                                                                                                                                   |
| `toLower`      | string                     | string        | Returns all text in lowercase.                                                                                                                                                                                   |
| `trimSpace`    | string                     | string        | Removes leading and trailing white spaces.                                                                                                                                                                       |
| `match`        | pattern, text              | boolean       | Matches the text against a regular expression pattern.                                                                                                                                                           |
| `reReplaceAll` | pattern, replacement, text | string        | Replaces text matching the regular expression.                                                                                                                                                                   |
| `join`         | sep string, s []string     | string        | Concatenates the elements of s to create a single string. The separator string sep is placed between elements in the resulting string.                                                                           |
| `safeHtml`     | string                     | string        | Marks string as HTML not requiring auto-escaping.                                                                                                                                                                |
| `stringSlice`  | ...string                  | string        | Returns the passed strings as a slice of strings. auto-escaping.                                                                                                                                                 |
| `date`         | string, [Time](#time)      | string        | Format a time in the specified format. For format options, refer to [Go's time format documentation](https://pkg.go.dev/time#pkg-constants).                                                                     |
| `tz`           | string, [Time](#time)      | [Time](#time) | Returns the time in the specified timezone, such as `Europe/Paris`. For available timezone options, refer to the [list of tz database time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones). |

Here's an example using some functions to format text:

```go
{{ define "custom_template" }}
  {{ title "hello, world!" }}
  {{ toUpper "Hello, world!" }}
  {{ toLower "Hello, world!" }}
  {{ trimSpace "Hello, world!" }}
  {{ match "a.*" "abc" }}
  {{ reReplaceAll "localhost:(.*)" "example.com:$1" "localhost:8080" }}
  {{ join "-" (stringSlice "a" "b" "c") }}
  {{ safeHtml "<b>Text</b>"}}
  {{ stringSlice "a" "b" "c" }}
{{ end }}
```

`date` and `tz` can format times. For example, to print the time an alert fired in the format `15:04:05 MST`:

```go
{{ define "custom_template" }}
  {{ range .Alerts }}
    {{ .StartsAt | date "15:04:05 MST" }}
  {{ end}}
{{ end }}
```

You can then use `tz` to change the timezone from UTC to local time, such as `Europe/Paris`.

```go
{{ define "custom_template" }}
  {{ range .Alerts }}
    {{ .StartsAt | tz "Europe/Paris" }}
    {{ .StartsAt | tz "Europe/Paris" | date "15:04:05 MST" }}
  {{ end}}
{{ end }}
```

```template-output
2024-10-30 21:01:45.227 +0100 CET
21:01:45 CET
```

## Differences with annotation and label templates

In the alert rule, you can also template annotations and labels to include additional information. For example, you might add a `summary` annotation that displays the query value triggering the alert.

Annotation and label templates add relevant information to individual alert instances, while notification templates inform about a group of alert instances.

Since both types of templates operate in distinct contexts, the [functions and variables available in annotation and label templates](ref:alert-rule-template-reference) differ from those used in notification templates.
