---
title: 'JSON alert object'
---

| Key            | Type   | Description                                                                         |
| -------------- | ------ | ----------------------------------------------------------------------------------- |
| `status`       | string | Current status of the alert, `firing` or `resolved`.                                |
| `labels`       | object | Labels that are part of this alert, map of string keys to string values.            |
| `annotations`  | object | Annotations that are part of this alert, map of string keys to string values.       |
| `startsAt`     | string | Start time of the alert.                                                            |
| `endsAt`       | string | End time of the alert, default value when not resolved is `0001-01-01T00:00:00Z`.   |
| `values`       | object | Values that triggered the current status.                                           |
| `generatorURL` | string | URL of the alert rule in the Grafana UI.                                            |
| `fingerprint`  | string | The labels fingerprint, alarms with the same labels will have the same fingerprint. |
| `silenceURL`   | string | URL to silence the alert rule in the Grafana UI.                                    |
| `dashboardURL` | string | A link to the Grafana Dashboard if the alert has a Dashboard UID annotation.        |
| `panelURL`     | string | A link to the panel if the alert has a Panel ID annotation.                         |
| `imageURL`     | string | URL of a screenshot of a panel assigned to the rule that created this notification. |
