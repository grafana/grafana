---
aliases:
keywords:
  - grafana
  - alerting
  - notifications
  - templates
title: Reference
weight: 400
---

# Reference

## Data

### Alert

| Name         | Kind     | Description                                                                          | Example               |
| ------------ | -------- | ------------------------------------------------------------------------------------ | --------------------- |
| Status       | `string` | Firing or resolved                                                                   | `{{ .Status }}`       |
| Labels       | `KV`     | The labels for this alert                                                            | `{{ .Labels }}`       |
| Annotations  | `KV`     | The annotations for this alert                                                       | `{{ .Annotations }}`  |
| Values       | `KV`     | The values of all expressions, including Classic Conditions                          | `{{ .Values }}`       |
| StartsAt     | `Time`   | The time the alert fired                                                             | `{{ .StartsAt }}`     |
| EndsAt       | `Time`   |                                                                                      | `{{ .EndsAt }}`       |
| GeneratorURL | `string` | A link to Grafana, or the Alertmanager if using an external Alertmanager             | `{{ .GeneratorURL }}` |
| SilenceURL   | `string` | A link to silence the alert                                                          | `{{ .SilenceURL }}`   |
| DashboardURL | `string` | A link to the Grafana Dashboard if the alert has a Dashboard UID annotation          | `{{ .DashboardURL }}` |
| PanelURL     | `string` | A link to the panel if the alert has a Panel ID annotation                           | `{{ .PanelID }}`      |
| Fingerprint  | `string` | A unique string that identifies the alert                                            | `{{ .Fingerprint }}`  |
| ValueString  | `string` | A string that contains the labels and value of each reduced expression in the alert. | `{{ .ValueString }}`  |

### ExtendedData

| Name              | Kind      | Description                                                                                          | Example                                                |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Receiver          | `string`  | The name of the contact point sending the notification                                               | `{{ .Receiver }}`                                      |
| Status            | `string`  | The status is `firing` if at least one alert is firing, otherwise `resolved`                         | `{{ .Status }}`                                        |
| Alerts            | `[]Alert` | List of all firing and resolved alerts in this notification                                          | `There are {{ len .Alerts }} alerts`                   |
| Firing alerts     | `[]Alert` | List of all firing alerts in this notification                                                       | `There are {{ len .Alerts.Firing }} firing alerts`     |
| Resolved alerts   | `[]Alert` | List of all resolved alerts in this notification                                                     | `There are {{ len .Alerts.Resolved }} resolved alerts` |
| GroupLabels       | `KV`      | The labels that group these alerts in this                                                           | `{{ .GroupLabels }}`                                   |
| CommonLabels      | `KV`      | The labels common to all alerts in this notification                                                 | `{{ .CommonLabels }}`                                  |
| CommonAnnotations | `KV`      | The annotations common to all alerts i this notification                                             | `{{ .CommonAnnotations }}`                             |
| ExternalURL       | `string`  | A link to Grafana, or the Alertmanager that sent this notification if using an external Alertmanager | `{{ .ExternalURL }}`                                   |

### KV

`KV` is a set of key value pairs, where each key and value is a string. If a KV happens to contain numbers or bools then these are string representations of the numeric or boolean value.

Here is an example of a KV, the annotations of an alert:

```yaml
summary: 'A summary of the alert'
description: 'A description of the alert'
```

In addition to iterating over each key value pair, you can sort the pairs, remove keys, and iterate over just the keys or the values.

| Name        | Description                                    | Arguments | Returns | Example                               |
| ----------- | ---------------------------------------------- | --------- | ------- | ------------------------------------- |
| SortedPairs | Sorts                                          |           |         | `{{ .Annotations.SortedPairs }}`      |
| Remove      | Returns a copy of the KV with the keys removed | []string  |         | `{{ .Annotations.Remove "summary" }}` |
| Names       | A list of the names                            |           |         | `{{ .Names }}`                        |
| Values      | A list of the values                           |           |         | `{{ .Values }}`                       |

### Time

Time is from the Go [`time`](https://pkg.go.dev/time#Time) package. You can print a time in a number of different formats. For example, to print the time that an alert fired in the format `Monday, 1st January 2022 at 10:00AM` you would write the following template:

```
{{ .StartsAt.Format "Monday, 2 January 2006 at 3:04PM" }}
```

You can find a reference for Go's time format [here](https://pkg.go.dev/time#pkg-constants).
