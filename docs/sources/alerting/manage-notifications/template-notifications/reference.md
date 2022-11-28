---
aliases:
keywords:
  - grafana
  - alerting
  - notifications
  - templates
title: Reference
weight: 600
---

# Reference

The following reference contains all the data and template functions that are available when templating notifications.

## Data

### ExtendedData

When templating notifications, the cursor at the start of the template refers to a structure called **ExtendedData**. This structure contains a number of fields including `Alerts`, `Status`, `GroupLabels`, `CommonLabels`, `CommonAnnotations` and `ExternalURL`. The complete set of fields can be found in the following table:

| Name              | Dot notation         | Kind        | Notes                                                                                                                |
| ----------------- | -------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Receiver          | `.Receiver`          | string      | Name of the contact point that the notification is being sent to.                                                    |
| Status            | `.Status`            | string      | `firing` if at least one alert is firing, otherwise `resolved`.                                                      |
| Alerts            | `.Alerts`            | Alert       | List of alert objects that are included in this notification (see below).                                            |
| Firing alerts     | `.Alerts.Firing`     | Alert       | List of alert objects that are included in this notification (see below).                                            |
| Resolved alerts   | `.Alerts.Resolved`   | Alert       | List of alert objects that are included in this notification (see below).                                            |
| GroupLabels       | `.GroupLabels`       | Named Pairs | Labels these alerts were grouped by.                                                                                 |
| CommonLabels      | `.CommonLabels`      | Named Pairs | Labels common to all the alerts included in this notification.                                                       |
| CommonAnnotations | `.CommonAnnotations` | Named Pairs | Annotations common to all the alerts included in this notification.                                                  |
| ExternalURL       | `.ExternalURL`       | string      | Back link to the Grafana that sent the notification. If using external Alertmanager, back link to this Alertmanager. |

### Alert

**ExtendedData** contains a list of alerts. Each alert in the list refers to a structure called **Alert**. This structure contains a number of fields including `Status`, `Labels`, `Annotations` and `Values`. The complete set of fields can be found in the following table:

| Name         | Dot notation    | Kind                                 | Notes                                                                                                                                          |
| ------------ | --------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Status       | `.Status`       | string                               | `firing` or `resolved`.                                                                                                                        |
| Labels       | `.Labels`       | Named Pairs                          | A set of labels attached to the alert.                                                                                                         |
| Annotations  | `.Annotations`  | Named Pairs                          | A set of annotations attached to the alert.                                                                                                    |
| Values       | `.Values`       | Named Pairs                          | A set of annotations attached to the alert.                                                                                                    |
| StartsAt     | `.StartsAt`     | [Time](https://pkg.go.dev/time#Time) | Time the alert started firing.                                                                                                                 |
| EndsAt       | `.EndsAt`       | [Time](https://pkg.go.dev/time#Time) | Only set if the end time of an alert is known. Otherwise set to a configurable timeout period from the time since the last alert was received. |
| GeneratorURL | `.GeneratorURL` | string                               | A back link to Grafana or external Alertmanager.                                                                                               |
| SilenceURL   | `.SilenceURL`   | string                               | Link to grafana silence for with labels for this alert pre-filled. Only for Grafana managed alerts.                                            |
| DashboardURL | `.DashboardURL` | string                               | Link to grafana dashboard, if alert rule belongs to one. Only for Grafana managed alerts.                                                      |
| PanelURL     | `.PanelURL`     | string                               | Link to grafana dashboard panel, if alert rule belongs to one. Only for Grafana managed alerts.                                                |
| Fingerprint  | `.Fingerprint`  | string                               | Fingerprint that can be used to identify the alert.                                                                                            |
| ValueString  | `.ValueString`  | string                               | A string that contains the labels and value of each reduced expression in the alert.                                                           |

### GroupLabels, CommonLabels and CommonAnnotations

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

### Functions
