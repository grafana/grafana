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
title: Configure MQTT notifications
weight: 140
refs:
  notification-template-examples:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/examples/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/examples/
  notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
---

# Configure MQTT notifications

Use the MQTT integration in contact points to send alert notifications to your MQTT broker.

## Configure MQTT for a contact point

To create a contact point with MQTT integration, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a name for the contact point.
1. From the **Integration** list, select **MQTT**.
1. Enter your broker URL in the **Broker URL** field. Supports `tcp`, `ssl`, `mqtt`, `mqtts`, `ws`, `wss` schemes. For example: `tcp://127.0.0.1:1883`.
1. Enter the MQTT topic name in the **Topic** field.
1. (Optional) Configure [additional settings](#optional-settings).
1. Click **Save contact point**.

For more details on contact points, including how to test them and enable notifications, refer to [Configure contact points](ref:configure-contact-points).

### Required Settings

| Option     | Description                                  |
| ---------- | -------------------------------------------- |
| Broker URL | The URL of the MQTT broker.                  |
| Topic      | The topic to which the message will be sent. |

### Optional Settings

| Option                   | Description                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Message format           | If set to `json` (default), the notification message uses the [default JSON payload](#default-json-payload). <br/> If set to `text`, the notification message is fully customizable.                                                                                                                                   |
| Message                  | Depends on the **Message format** option. <br/> In `json` format, defines only the `message` field of the [default JSON payload](#default-json-payload). <br/> In `text` format, defines the [entire custom payload](#custom-payload). <br/> This field supports [notification templates](ref:notification-templates). |
| Client ID                | The client ID to use when connecting to the MQTT broker. If blank, a random client ID is used.                                                                                                                                                                                                                         |
| Username                 | The username to use when connecting to the MQTT broker.                                                                                                                                                                                                                                                                |
| Password                 | The password to use when connecting to the MQTT broker.                                                                                                                                                                                                                                                                |
| QoS                      | The quality of service to use when sending the message. Options are `At most once`, `At least once`, and `Exactly once`.                                                                                                                                                                                               |
| Retain                   | If set to true, the message will be retained by the broker.                                                                                                                                                                                                                                                            |
| TLS                      | TLS configuration options, including CA certificate, client certificate, and client key, and disable certificate verification.                                                                                                                                                                                         |
| Disable resolved message | Enable this option to prevent notifications when an alert resolves.                                                                                                                                                                                                                                                    |

## Default JSON payload

If the **Message format** option is `json` (the default), the payload is like this example.

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

### Body

If the **Message format** option is `json` (the default), the payload contains the following fields.

| Key                 | Type                             | Description                                                                                                                                                                 |
| ------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `receiver`          | string                           | Name of the contact point                                                                                                                                                   |
| `status`            | string                           | Current status of the alert, `firing` or `resolved`                                                                                                                         |
| `orgId`             | number                           | ID of the organization related to the payload                                                                                                                               |
| `alerts`            | array of [alerts](#alert-object) | Alerts that are triggering                                                                                                                                                  |
| `groupLabels`       | object                           | Labels that are used for grouping, map of string keys to string values                                                                                                      |
| `commonLabels`      | object                           | Labels that all alarms have in common, map of string keys to string values                                                                                                  |
| `commonAnnotations` | object                           | Annotations that all alarms have in common, map of string keys to string values                                                                                             |
| `externalURL`       | string                           | External URL to the Grafana instance sending this webhook                                                                                                                   |
| `version`           | string                           | Version of the payload                                                                                                                                                      |
| `groupKey`          | string                           | Key that is used for grouping                                                                                                                                               |
| `message`           | string                           | Custom message configured in **Message** (**Optional Settings**). <br/> Supports [notification templates](ref:notification-templates); the output is formatted as a string. |

{{< admonition type="note" >}}

When using the `json` **Message format**, only the **message** field of the JSON payload is customizable, and its output is formatted as a string.

To customize the full payload in text or JSON format, use the `text` format and define a [custom payload](#custom-payload).

{{< /admonition >}}

### Alert object

The Alert object represents an alert included in the notification group, as provided by the [`alerts` field](#body).

{{< docs/shared lookup="alerts/table-for-json-alert-object.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Custom payload

When you set the **Message format** option to `text`, you can customize the entire payload of the MQTT message.

In this mode, the **Message** option defines the entire payload. It supports [notification templates](ref:notification-templates) and can generate notification messages in plain text, JSON, or any custom format.

For examples of templates that produce plain text or JSON messages, refer to [notification template examples](ref:notification-template-examples).
