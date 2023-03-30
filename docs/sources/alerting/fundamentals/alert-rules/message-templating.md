---
aliases:
  - ../../contact-points/message-templating/
  - ../../message-templating/
  - ../../unified-alerting/message-templating/
description: Notification templating
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Notification templating
weight: 415
---

# Notification templating

Notifications sent via contact points are built using notification templates. Grafana's default templates are based on the [Go templating system](https://golang.org/pkg/text/template) where some fields are evaluated as text, while others are evaluated as HTML (which can affect escaping).

The default template [default_template.go](https://github.com/grafana/alerting/blob/main/templates/default_template.go) is a useful reference for custom templates.

Since most of the contact point fields can be templated, you can create reusable custom templates and use them in multiple contact points.

### Using templates

The following example shows how to use default templates to render an alert message in Slack. The message title contains a count of alerts that are firing or were resolved. The message body lists the alerts and their status.

{{< figure src="/static/img/docs/alerting/unified/contact-points-template-fields-8-0.png" class="docs-image--no-shadow" max-width= "550px" caption="Default template" >}}

The following example shows the use of a custom template within one of the contact point fields.

{{< figure src="/static/img/docs/alerting/unified/contact-points-use-template-8-0.png" class="docs-image--no-shadow" max-width= "550px" caption="Default template" >}}

### Nested templates

You can embed templates within other templates.

For example, you can define a template fragment using the `define` keyword:

```
{{ define "mytemplate" }}
  {{ len .Alerts.Firing }} firing. {{ len .Alerts.Resolved }} resolved.
{{ end }}
```

You can then embed custom templates within this fragment using the `template` keyword. For example:

```
Alert summary:
{{ template "mytemplate" . }}
```

You can use any of the following built-in template options to embed custom templates.

| Name                    | Notes                                                         |
| ----------------------- | ------------------------------------------------------------- |
| `default.title`         | Displays high-level status information.                       |
| `default.message`       | Provides a formatted summary of firing and resolved alerts.   |
| `teams.default.message` | Similar to `default.messsage`, formatted for Microsoft Teams. |

### HTML in notification templates

HTML in alerting notification templates is escaped. We do not support rendering of HTML in the resulting notification.

Some notifiers support alternative methods of changing the look and feel of the resulting notification. For example, Grafana installs the base template for alerting emails to `<grafana-install-dir>/public/emails/ng_alert_notification.html`. You can edit this file to change the appearance of all alerting emails.
