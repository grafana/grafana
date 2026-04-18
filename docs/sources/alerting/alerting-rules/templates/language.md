---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/language/
description: Use Go template language to create your notification and alert rule templates
keywords:
  - grafana
  - alerting
  - templates
  - write templates
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Alerting template language
menuTitle: Template language
refs:
  alert-rule-template-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/
  alert-rule-template-reference-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/#variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/#variables
  notification-template-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/
  reference-notificationdata:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/#notification-data
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/#notification-data
---

# Alerting template language

Notification templates and alert rule templates, such as annotations and labels, both use the Go template language, [text/template](https://pkg.go.dev/text/template).

Both types of templates can use the same keywords, functions, and comparison operators of the Go template language, such as `range`, `if`, `and`, `index`, `eq`, and more.

However, it's important to note that because notifications and alert rules operate in distinct contexts, some additional variables and functions are only available for either notification or alert rule templates. Refer to:

- [Annotation and label template reference](ref:alert-rule-template-reference)
- [Notification template reference](ref:notification-template-reference)

This documentation provides an overview of the functions and operators of the Go template language that are available for both notification and alert rule templates.

## Print

To print the value of something, use `{{` and `}}`. You can print the value of a [variable](#variables), a field of a variable, the result of a function, or the value of dot.

```go
{{ $values }}
{{ $values.A.Value }}
{{ humanize 1000.0 }}
{{ .Alerts }}
```

## Dot

In `text/template`, there is a special cursor called dot, written as `.`. You can think of this cursor as a variable whose value changes depending on where in the template it is used.

At the start of notification templates, dot (`.`) refers to [Notification Data](ref:reference-notificationdata).

```go
{{ .Alerts }}
```

In annotation and label templates, dot (`.`) is initialized with all alert data. It’s recommended to use the [`$labels` and `$values` variables](ref:alert-rule-template-reference-variables) instead to directly access the alert labels and query values.

{{< admonition type="note" >}}
Dot (`.`) might refer to something else when used in a [range](#range), a [with](#with), or when writing [templates](#templates) used in other templates.
{{< /admonition >}}

[//]: <> (The above section is not included in the shared file because `refs` links are not supported in shared files.)

{{< docs/shared lookup="alerts/template-language.md" source="grafana" version="<GRAFANA_VERSION>" >}}
