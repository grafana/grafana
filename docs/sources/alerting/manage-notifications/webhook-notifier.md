---
aliases:
  - ../contact-points/notifiers/webhook-notifier/
  - ../fundamentals/contact-points/webhook-notifier/
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Configure the webhook notifier
weight: 1000
---

### Configure the webhook notifier

Example JSON body:

```json
{
  "receiver": "My Super Webhook",
  "status": "firing",
  "orgId": 1,
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "High memory usage",
        "team": "blue",
        "zone": "us-1"
      },
      "annotations": {
        "description": "The system has high memory usage",
        "runbook_url": "https://myrunbook.com/runbook/1234",
        "summary": "This alert was triggered for zone us-1"
      },
      "startsAt": "2021-10-12T09:51:03.157076+02:00",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "https://play.grafana.org/alerting/1afz29v7z/edit",
      "fingerprint": "c6eadffa33fcdf37",
      "silenceURL": "https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT2%2Cteam%3Dblue%2Czone%3Dus-1",
      "dashboardURL": "",
      "panelURL": "",
      "valueString": "[ metric='' labels={} value=14151.331895396988 ]"
    },
    {
      "status": "firing",
      "labels": {
        "alertname": "High CPU usage",
        "team": "blue",
        "zone": "eu-1"
      },
      "annotations": {
        "description": "The system has high CPU usage",
        "runbook_url": "https://myrunbook.com/runbook/1234",
        "summary": "This alert was triggered for zone eu-1"
      },
      "startsAt": "2021-10-12T09:56:03.157076+02:00",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "https://play.grafana.org/alerting/d1rdpdv7k/edit",
      "fingerprint": "bc97ff14869b13e3",
      "silenceURL": "https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT1%2Cteam%3Dblue%2Czone%3Deu-1",
      "dashboardURL": "",
      "panelURL": "",
      "valueString": "[ metric='' labels={} value=47043.702386305304 ]"
    }
  ],
  "groupLabels": {},
  "commonLabels": {
    "team": "blue"
  },
  "commonAnnotations": {},
  "externalURL": "https://play.grafana.org/",
  "version": "1",
  "groupKey": "{}:{}",
  "truncatedAlerts": 0,
  "title": "[FIRING:2]  (blue)",
  "state": "alerting",
  "message": "**Firing**\n\nLabels:\n - alertname = T2\n - team = blue\n - zone = us-1\nAnnotations:\n - description = This is the alert rule checking the second system\n - runbook_url = https://myrunbook.com\n - summary = This is my summary\nSource: https://play.grafana.org/alerting/1afz29v7z/edit\nSilence: https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT2%2Cteam%3Dblue%2Czone%3Dus-1\n\nLabels:\n - alertname = T1\n - team = blue\n - zone = eu-1\nAnnotations:\nSource: https://play.grafana.org/alerting/d1rdpdv7k/edit\nSilence: https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT1%2Cteam%3Dblue%2Czone%3Deu-1\n"
}
```

### Webhook fields

## Body

| Key               | Type                      | Description                                                                     |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------- |
| receiver          | string                    | Name of the webhook                                                             |
| status            | string                    | Current status of the alert, `firing` or `resolved`                             |
| orgId             | number                    | ID of the organization related to the payload                                   |
| alerts            | array of [alerts](#alert) | Alerts that are triggering                                                      |
| groupLabels       | object                    | Labels that are used for grouping, map of string keys to string values          |
| commonLabels      | object                    | Labels that all alarms have in common, map of string keys to string values      |
| commonAnnotations | object                    | Annotations that all alarms have in common, map of string keys to string values |
| externalURL       | string                    | External URL to the Grafana instance sending this webhook                       |
| version           | string                    | Version of the payload                                                          |
| groupKey          | string                    | Key that is used for grouping                                                   |
| truncatedAlerts   | number                    | Number of alerts that were truncated                                            |
| title             | string                    | **Will be deprecated soon**                                                     |
| state             | string                    | **Will be deprecated soon**                                                     |
| message           | string                    | **Will be deprecated soon**                                                     |

### Alert

| Key          | Type   | Description                                                                        |
| ------------ | ------ | ---------------------------------------------------------------------------------- |
| status       | string | Current status of the alert, `firing` or `resolved`                                |
| labels       | object | Labels that are part of this alert, map of string keys to string values            |
| annotations  | object | Annotations that are part of this alert, map of string keys to string values       |
| startsAt     | string | Start time of the alert                                                            |
| endsAt       | string | End time of the alert, default value when not resolved is `0001-01-01T00:00:00Z`   |
| valueString  | string | Values that triggered the current status                                           |
| generatorURL | string | URL of the alert rule in the Grafana UI                                            |
| fingerprint  | string | The labels fingerprint, alarms with the same labels will have the same fingerprint |
| silenceURL   | string | URL to silence the alert rule in the Grafana UI                                    |
| dashboardURL | string | **Will be deprecated soon**                                                        |
| panelURL     | string | **Will be deprecated soon**                                                        |

### Removed fields related to dashboards

Alerts are not coupled to dashboards anymore therefore the fields related to dashboards `dashboardId` and `panelId` have been removed.

## WeCom

WeCom contact points need a Webhook URL. These are obtained by setting up a WeCom robot on the corresponding group chat. To obtain a Webhook URL using the WeCom desktop Client please follow these steps:

1. Click the "..." in the top right corner of a group chat that you want your alerts to be delivered to
2. Click "Add Group Robot", select "New Robot" and give your robot a name. Click "Add Robot"
3. There should be a Webhook URL in the panel.

| Setting | Description        |
| ------- | ------------------ |
| Url     | WeCom webhook URL. |
