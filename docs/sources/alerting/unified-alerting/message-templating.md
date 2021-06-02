+++
title = "Message templating"
description = "Message templating"
keywords = ["grafana", "alerting", "guide", "contact point", "templating"]
weight = 400
+++

# Message templating

Notifications sent via [contact points]({{< relref "./contact-points.md" >}}) are built using templates. Grafana comes with default templates which you can customize. Grafana's notification templates are based on the [Go templating system](https://golang.org/pkg/text/template) where some fields are evaluated as text, while others are evaluated as HTML which can affect escaping. Since most of the contact point fields can be templated, you can create reusable templates and them in multiple contact points.

## Template data

Template data is passed on to templates as well as sent as payload to webhook pushes.

Name              | Type     | Notes
------------------|----------|-----------------------------------------------------------------
Receiver          | string   | Name of the contact point that the notification is being sent to.
Status            | string   | `firing` if at least one alert is firing, otherwise `resolved`.
Alerts            | Alert    | List of alert objects that are included in this notification (see below).
GroupLabels       | KeyValue | Labels these alerts were grouped by.
CommonLabels      | KeyValue | Labels common to all the alerts included in this notification.
CommonAnnotations | KeyValue | Annotations common to all the alerts included in this notification.
ExternalURL       | string   | Back link to the Grafana that sent the notification. If using external Alertmanager, back link to this Alertmanager.

The `Alerts` type exposes functions for filtering alerts:

* `Alerts.Firing` returns a list of firing alerts.
* `Alerts.Resolved` returns a list of resolved alerts.

### Alert

Name         | Type      | Notes
-------------|-----------|---------------------------------------------------------------------
Status       | string    | `firing` or `resolved`.
Labels       | KeyValue  | A set of labels attached to the alert.
Annotations  | KeyValue  | A set of annotations attached to the alert.
StartsAt     | time.Time | Time the alert started firing.
EndsAt       | time.Time | Only set if the end time of an alert is known. Otherwise set to a configurable timeout period from the time since the last alert was received.
GeneratorURL | string    | A back link to Grafana or external Alertmanager.
SilenceURL   | string    | Link to grafana silence for with labels for this alert pre-filled. Only for Grafana managed alerts.
DashboardURL | string    | Link to grafana dashboard, if alert rule belongs to one. Only for Grafana managed alerts.
PanelURL     | string    | Link to grafana dashboard panel, if alert rule belongs to one. Only for Grafana managed alerts.
Fingerprint  | string    | Fingerprint that can be used to identify the alert.

### KeyValue

`KeyValue` is a set of key/value string pairs that represent labels and annotations.

Here is an example containing two annotations:

```json
{
  "summary": "alert summary",
  "description": "alert description"
}
```

In addition to direct access of data (labels and annotations) stored as KeyValue, there are also methods for sorting, removing and transforming.

Name        | Arguments | Returns                                 | Notes
------------|-----------|-----------------------------------------|----------------
SortedPairs |           | Sorted list of key & value string pairs |
Remove      | []string  | KeyValue                                | Returns a copy of the Key/Value map without the given keys.
Names       |           | []string                                | List of label names
Values      |           | []string                                | List of label values

### Functions

Some functions to transform values are also available, along with [default functions provided by Go templating](https://golang.org/pkg/text/template/#hdr-Functions).

Name         | Arguments                    | Returns
-------------|------------------------------|----------------------------------------------
title        | string                       | Capitalizes first character of each word.
toUpper      | string                       | Converts all characters to upper case.
match        | pattern, string              | Match a string using RegExp.
reReplaceAll | pattern, replacement, string | RegExp substitution, unanchored.
join         | string, []string             | Concatenates the elements of the second argument to create a single string. First argument is the separator. 
safeHtml     | string                       | Marks string as HTML, not requiring auto-escaping.
stringSlice  | ...string                    | Returns passed strings as slice of strings.

## Using templating in contact point fields

This section shows an example of using templating to render a number of firing or resolved alerts in Slack message title, and listing alerts with status and name in the message body:

<img  src="/static/img/docs/alerting/unified/contact-points-template-fields-8-0.png" width="600px">

## Reusable templates

You can create named templates and then reuse them in contact point fields or other templates.

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

Simply enter `{{ template "templatename" . }}` into a contact point field, where `templatename` is the `define` parameter of a template. 

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
    Go to dashboard: {{ .Dashboard URL }}
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

Grafana alerting UI supports managing external Alertmanager configuration. Once you add an [Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}), a dropdown displays at the top of the page, allowing you to select either `Grafana` or an external Alertmanager data source. 

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" caption="Select Alertmanager" >}}
