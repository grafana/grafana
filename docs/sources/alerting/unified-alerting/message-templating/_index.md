---
aliases:
  - ../message-templating/
description: Message templating
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Message templating
weight: 440
---

# Message templating

Notifications sent via [contact points]({{< relref "../contact-points.md" >}}) are built using messaging templates. Grafana's default templates are based on the [Go templating system](https://golang.org/pkg/text/template) where some fields are evaluated as text, while others are evaluated as HTML (which can affect escaping). The default template, defined in [default_template.go](https://github.com/grafana/grafana/blob/main/pkg/services/ngalert/notifier/channels/default_template.go), is a useful reference for custom templates.

Since most of the contact point fields can be templated, you can create reusable custom templates and use them in multiple contact points. The [template data]({{< relref "./template-data.md" >}}) topic lists variables that are available for templating. The default template is defined in [default_template.go](https://github.com/grafana/grafana/blob/main/pkg/services/ngalert/notifier/channels/default_template.go) which can serve as a useful reference or starting point for custom templates.

### Using templates

The following example shows how to use default templates to render an alert message in Slack. The message title contains a count of alerts that are firing or were resolved. The message body lists the alerts and their status.

<img  src="/static/img/docs/alerting/unified/contact-points-template-fields-8-0.png" width="450px">

The following example shows the use of a custom template within one of the contact point fields.

<img  src="/static/img/docs/alerting/unified/contact-points-use-template-8-0.png" width="400px">

### Create a message template

> **Note:** Before Grafana v8.2, the configuration of the embedded Alertmanager was shared across organisations. Users of Grafana 8.0 and 8.1 are advised to use the new Grafana 8 alerts only if they have one organisation. Otherwise, silences for the Grafana managed alerts will be visible by all organizations.

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. From [Alertmanager]({{< relref "../contact-points.md/#alertmanager" >}}) drop-down, select an external Alertmanager to create and manage templates for the external data source. Otherwise, keep the default option of Grafana.
   {{< figure max-width="250px" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" caption="Select Alertmanager" >}}
1. Click **Add template**.
1. In **Name**, add a descriptive name.
1. In **Content**, add the content of the template.
1. Click **Save template** button at the bottom of the page.
   <img  src="/static/img/docs/alerting/unified/templates-create-8-0.png" width="600px">

The `define` tag in the Content section assigns the template name. This tag is optional, and when omitted, the template name is derived from the **Name** field. When both are specified, it is a best practice to ensure that they are the same.

### Edit a message template

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. In the Template table, find the template you want to edit, then click the **Edit** (pen icon).
1. Make your changes, then click **Save template**.

### Delete a message template

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. In the Template table, find the template you want to delete, then click the **Delete** (trash icon).
1. In the confirmation dialog, click **Yes, delete** to delete the template.

Use caution when deleting a template since Grafana does not prevent you from deleting templates that are in use.

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

### Custom template examples

Here are a few examples of how to use custom templates.

Template to render a single alert:

```
{{ define "myalert" }}
  [{{.Status}}] {{ .Labels.alertname }}

  Labels:
  {{ range .Labels.SortedPairs }}
    {{ .Name }}: {{ .Value }}
  {{ end }}

  {{ if gt (len .Annotations) 0 }}
  Annotations:
  {{ range .Annotations.SortedPairs }}
    {{ .Name }}: {{ .Value }}
  {{ end }}
  {{ end }}

  {{ if gt (len .SilenceURL ) 0 }}
    Silence alert: {{ .SilenceURL }}
  {{ end }}
  {{ if gt (len .DashboardURL ) 0 }}
    Go to dashboard: {{ .DashboardURL }}
  {{ end }}
{{ end }}
```

Template to render entire notification message:

```
{{ define "mymessage" }}
  {{ if gt (len .Alerts.Firing) 0 }}
    {{ len .Alerts.Firing }} firing:
    {{ range .Alerts.Firing }} {{ template "myalert" .}} {{ end }}
  {{ end }}
  {{ if gt (len .Alerts.Resolved) 0 }}
    {{ len .Alerts.Resolved }} resolved:
    {{ range .Alerts.Resolved }} {{ template "myalert" .}} {{ end }}
  {{ end }}
{{ end }}
```

### HTML in Message Templates

HTML in alerting message templates is escaped. We do not support rendering of HTML in the resulting notification.

Some notifiers support alternative methods of changing the look and feel of the resulting notification. For example, Grafana installs the base template for alerting emails to `<grafana-install-dir>/public/emails/ng_alert_notification.html`. You can edit this file to change the appearance of all alerting emails.
