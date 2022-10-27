---
aliases:
  - /docs/grafana/latest/alerting/contact-points/message-templating/
  - /docs/grafana/latest/alerting/contact-points/message-templating/create-message-template/
  - /docs/grafana/latest/alerting/message-templating/
  - /docs/grafana/latest/alerting/unified-alerting/message-templating/
  - /docs/grafana/latest/alerting/contact-points/message-templating/delete-message-template/
  - /docs/grafana/latest/alerting/contact-points/message-templating/edit-message-template/
  - /docs/grafana/latest/alerting/manage-notifications/create-message-template/
  - /docs/grafana/latest/alerting/contact-points/message-templating/
  - /docs/grafana/latest/alerting/contact-points/message-templating/example-template/
  - /docs/grafana/latest/alerting/message-templating/
  - /docs/grafana/latest/alerting/unified-alerting/message-templating/
  - /docs/grafana/latest/alerting/fundamentals/contact-points/example-template/
  - /docs/grafana/latest/alerting/contact-points/message-templating/template-data/
  - /docs/grafana/latest/alerting/message-templating/template-data/
  - /docs/grafana/latest/alerting/unified-alerting/message-templating/template-data/
  - /docs/grafana/latest/alerting/fundamentals/contact-points/template-data/
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Create and edit message templates
weight: 200
---

# Create and edit message templates

You can use message templates to customize notification messages for the contact point types.

## Create a message template:

To create a message template, complete the following steps.

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
2. In the Alerting page, click **Contact points** to open the page listing existing contact points.
3. From Alertmanager drop-down, select an external Alertmanager to create and manage templates for the external data source. Otherwise, keep the default option of Grafana.
   {{< figure max-width="250px" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" caption="Select Alertmanager" >}}
4. Click **Add template**.
5. In **Name**, add a descriptive name.
6. In **Content**, add the content of the template.
7. Click **Save template** button at the bottom of the page.
   <img  src="/static/img/docs/alerting/unified/templates-create-8-0.png" width="600px">

The `define` tag in the Content section assigns the template name. This tag is optional, and when omitted, the template name is derived from the **Name** field. When both are specified, it is a best practice to ensure that they are the same.

## Edit a message template:

To edit a message template, complete the following steps.

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. In the Template table, find the template you want to edit, then click the **Edit** (pen icon).
1. Make your changes, then click **Save template**.

## Delete a message template:

To delete a message template, complete the following steps.

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. In the Template table, find the template you want to delete, then click the **Delete** (trash icon).
1. In the confirmation dialog, click **Yes, delete** to delete the template.

Use caution when deleting a template since Grafana does not prevent you from deleting templates that are in use.

## Create a custom template

Here's an example of how to use a custom template. You can also use the default template included in the setup.

Step 1: Configure a template to render a single alert.

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

Step 2: Configure a template to render entire notification message.

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

Step 3: Add `mymessage` in the notification message field.

```
Alert summary:
{{ template "mymessage" . }}
```

## Template data

Template data is passed on to message templates as well as sent as payload to webhook pushes.

| Name              | Type     | Notes                                                                                                                |
| ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Receiver          | string   | Name of the contact point that the notification is being sent to.                                                    |
| Status            | string   | `firing` if at least one alert is firing, otherwise `resolved`.                                                      |
| Alerts            | Alert    | List of alert objects that are included in this notification (see below).                                            |
| GroupLabels       | KeyValue | Labels these alerts were grouped by.                                                                                 |
| CommonLabels      | KeyValue | Labels common to all the alerts included in this notification.                                                       |
| CommonAnnotations | KeyValue | Annotations common to all the alerts included in this notification.                                                  |
| ExternalURL       | string   | Back link to the Grafana that sent the notification. If using external Alertmanager, back link to this Alertmanager. |

The `Alerts` type exposes functions for filtering alerts:

- `Alerts.Firing` returns a list of firing alerts.
- `Alerts.Resolved` returns a list of resolved alerts.

## Alert

| Name         | Type      | Notes                                                                                                                                          |
| ------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Status       | string    | `firing` or `resolved`.                                                                                                                        |
| Labels       | KeyValue  | A set of labels attached to the alert.                                                                                                         |
| Annotations  | KeyValue  | A set of annotations attached to the alert.                                                                                                    |
| StartsAt     | time.Time | Time the alert started firing.                                                                                                                 |
| EndsAt       | time.Time | Only set if the end time of an alert is known. Otherwise set to a configurable timeout period from the time since the last alert was received. |
| GeneratorURL | string    | A back link to Grafana or external Alertmanager.                                                                                               |
| SilenceURL   | string    | Link to grafana silence for with labels for this alert pre-filled. Only for Grafana managed alerts.                                            |
| DashboardURL | string    | Link to grafana dashboard, if alert rule belongs to one. Only for Grafana managed alerts.                                                      |
| PanelURL     | string    | Link to grafana dashboard panel, if alert rule belongs to one. Only for Grafana managed alerts.                                                |
| Fingerprint  | string    | Fingerprint that can be used to identify the alert.                                                                                            |
| ValueString  | string    | A string that contains the labels and value of each reduced expression in the alert.                                                           |

## KeyValue

`KeyValue` is a set of key/value string pairs that represent labels and annotations.

Here is an example containing two annotations:

```json
{
  "summary": "alert summary",
  "description": "alert description"
}
```

In addition to direct access of data (labels and annotations) stored as KeyValue, there are also methods for sorting, removing and transforming.

| Name        | Arguments | Returns                                 | Notes                                                       |
| ----------- | --------- | --------------------------------------- | ----------------------------------------------------------- |
| SortedPairs |           | Sorted list of key & value string pairs |
| Remove      | []string  | KeyValue                                | Returns a copy of the Key/Value map without the given keys. |
| Names       |           | []string                                | List of label names                                         |
| Values      |           | []string                                | List of label values                                        |
