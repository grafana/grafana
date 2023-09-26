+++
title = "Message templating"
description = "Message templating"
aliases = ["/docs/grafana/v8.1/alerting/message-templating/"]
keywords = ["grafana", "alerting", "guide", "contact point", "templating"]
weight = 400
+++

# Message templating

Notifications sent via [contact points]({{< relref "../contact-points.md" >}}) are built using templates. Grafana comes with default templates which you can customize. Grafana's notification templates are based on the [Go templating system](https://golang.org/pkg/text/template) where some fields are evaluated as text, while others are evaluated as HTML which can affect escaping. Since most of the contact point fields can be templated, you can create reusable templates and them in multiple contact points. See [template data reference]({{< relref "./template-data.md" >}}) to check what variables are available in the templates. The default template is defined in [default_template.go](https://github.com/grafana/grafana/blob/main/pkg/services/ngalert/notifier/channels/default_template.go) which can serve as a useful reference or starting point for custom templates.

## Using templating in contact point fields

This section shows an example of using templating to render a number of firing or resolved alerts in Slack message title, and listing alerts with status and name in the message body:

<img  src="/static/img/docs/alerting/unified/contact-points-template-fields-8-0.png" width="600px">

## Reusable templates

You can create named templates and then reuse them in contact point fields or other templates.

Grafana alerting UI allows you to configure templates for the Grafana managed alerts (handled by the embedded Alertmanager) as well as templates for an [external Alertmanager if one is configured]({{< relref "../../../datasources/alertmanager.md" >}}), using the Alertmanager dropdown.

> **Note:** Currently the configuration of the embedded Alertmanager is shared across organisations. Therefore users are advised to use the new Grafana 8 Alerts only if they have one organisation otherwise templates for the Grafana managed alerts will be visible by all organizations

### Create a template

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. Click **Add template**.
1. Fill in **Name** and **Content** fields.
1. Click **Save template** button at the bottom of the page.

**Note** The template name used to reference this template in templating is not the value of the **Name** field, but the parameter to `define` tag in the content. When creating a template you can omit `define` entirely and it will be added automatically with same value as **Name** field. It's recommended to use the same name for `define` and **Name** field to avoid confusion.

<img  src="/static/img/docs/alerting/unified/templates-create-8-0.png" width="600px">

### Edit a template

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. Find the template you want to edit in the templates table and click the **pen icon** on the right side.
1. Make any changes and click **Save template** button at the bottom of the page.

### Delete a template

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. Find the template you want to edit in the templates table and click the **trash can icon** on the right side.
1. A confirmation dialog will open. Click **Yes, delete**.

**Note** You are not prevented from deleting templates that are in use somewhere in contact points or other templates. Be careful!

### Use a template in a contact point field

To use a template:

Enter `{{ template "templatename" . }}` into a contact point field, where `templatename` is the `define` parameter of a template.

<img  src="/static/img/docs/alerting/unified/contact-points-use-template-8-0.png" width="600px">

### Template examples

Here is an example of a template to render a single alert:

```
{{ define "alert" }}
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
{{ define "message" }}
  {{ if gt (len .Alerts.Firing) 0 }}
    {{ len .Alerts.Firing }} firing:
    {{ range .Alerts.Firing }} {{ template "alert" .}} {{ end }}
  {{ end }}
  {{ if gt (len .Alerts.Resolved) 0 }}
    {{ len .Alerts.Resolved }} resolved:
    {{ range .Alerts.Resolved }} {{ template "alert" .}} {{ end }}
  {{ end }}
{{ end }}
```

## Manage templates for an external Alertmanager

Grafana alerting UI supports managing external Alertmanager configuration. Once you add an [Alertmanager data source]({{< relref "../../../datasources/alertmanager.md" >}}), a dropdown displays at the top of the page, allowing you to select either `Grafana` or an external Alertmanager data source.

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" caption="Select Alertmanager" >}}
