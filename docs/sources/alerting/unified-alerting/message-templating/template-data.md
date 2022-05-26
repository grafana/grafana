---
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Template data
---

# Template data

Template data is passed on to [message templates]({{< relref "./_index.md" >}}) as well as sent as payload to webhook pushes.

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
