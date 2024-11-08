---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-mqtt/
description: Configure the MQTT notifier integration for Alerting
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - mqtt
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: MQTT
title: Configure the MQTT notifier for Alerting
weight: 140
---

# Configure the MQTT notifier for Alerting

Use the Grafana Alerting - MQTT integration to send notifications to an MQTT broker when your alerts are firing.

## Procedure

To configure the MQTT integration for Alerting, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. On the **Contact Points** tab, click **+ Add contact point**.
1. Enter a descriptive name for the contact point.
1. From the Integration list, select **MQTT**.
1. Enter your broker URL in the **Broker URL** field. Supports `tcp`, `ssl`, `mqtt`, `mqtts`, `ws`, `wss` schemes. For example: `tcp://127.0.0.1:1883`.
1. Enter the MQTT topic name in the **Topic** field.
1. In **Optional MQTT settings**, specify additional settings for the MQTT integration if needed.
1. Click **Test** to check that your integration works.

   ** For Grafana Alertmanager only.**

   A test alert notification should be sent to the MQTT broker.

1. Click **Save** contact point.

The integration sends data in JSON format by default. You can change that using **Message format** field in the **Optional MQTT settings** section. There are two supported formats:

- **JSON**: Sends the alert notification in JSON format.
- **Text**: Sends the rendered alert notification message in plain text format.

## MQTT JSON payload

If the JSON message format is selected in **Optional MQTT settings**, the payload is sent in the following structure.

```json
{
  "receiver": "My MQTT integration",
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
      "values": {
        "B": 44.23943737541908,
        "C": 1
      }
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
      "values": {
        "B": 44.23943737541908,
        "C": 1
      }
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
  "message": "**Firing**\n\nLabels:\n - alertname = T2\n - team = blue\n - zone = us-1\nAnnotations:\n - description = This is the alert rule checking the second system\n - runbook_url = https://myrunbook.com\n - summary = This is my summary\nSource: https://play.grafana.org/alerting/1afz29v7z/edit\nSilence: https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT2%2Cteam%3Dblue%2Czone%3Dus-1\n\nLabels:\n - alertname = T1\n - team = blue\n - zone = eu-1\nAnnotations:\nSource: https://play.grafana.org/alerting/d1rdpdv7k/edit\nSilence: https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT1%2Cteam%3Dblue%2Czone%3Deu-1\n"
}
```

### Payload fields

Each notification payload contains the following fields.

| Key               | Type                                        | Description                                                                     |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| receiver          | string                                      | Name of the contact point                                                       |
| status            | string                                      | Current status of the alert, `firing` or `resolved`                             |
| orgId             | number                                      | ID of the organization related to the payload                                   |
| alerts            | array of [alert instances](#alert-instance) | Alerts that are triggering                                                      |
| groupLabels       | object                                      | Labels that are used for grouping, map of string keys to string values          |
| commonLabels      | object                                      | Labels that all alarms have in common, map of string keys to string values      |
| commonAnnotations | object                                      | Annotations that all alarms have in common, map of string keys to string values |
| externalURL       | string                                      | External URL to the Grafana instance sending this webhook                       |
| version           | string                                      | Version of the payload                                                          |
| groupKey          | string                                      | Key that is used for grouping                                                   |
| message           | string                                      | Rendered message of the alerts                                                  |

### Alert instance

Each alert instance in the `alerts` array has the following fields.

| Key          | Type   | Description                                                                        |
| ------------ | ------ | ---------------------------------------------------------------------------------- |
| status       | string | Current status of the alert, `firing` or `resolved`                                |
| labels       | object | Labels that are part of this alert, map of string keys to string values            |
| annotations  | object | Annotations that are part of this alert, map of string keys to string values       |
| startsAt     | string | Start time of the alert                                                            |
| endsAt       | string | End time of the alert, default value when not resolved is `0001-01-01T00:00:00Z`   |
| values       | object | Values that triggered the current status                                           |
| generatorURL | string | URL of the alert rule in the Grafana UI                                            |
| fingerprint  | string | The labels fingerprint, alarms with the same labels will have the same fingerprint |
| silenceURL   | string | URL to silence the alert rule in the Grafana UI                                    |
| dashboardURL | string | A link to the Grafana Dashboard if the alert has a Dashboard UID annotation        |
| panelURL     | string | A link to the panel if the alert has a Panel ID annotation                         |
| imageURL     | string | URL of a screenshot of a panel assigned to the rule that created this notification |

{{< admonition type="note" >}}
Alert rules are not coupled to dashboards anymore. The fields related to dashboards `dashboardId` and `panelId` have been removed.
{{< /admonition >}}
