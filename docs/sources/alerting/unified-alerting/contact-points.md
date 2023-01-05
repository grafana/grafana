---
description: Create or edit contact point
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - notification channel
  - create
title: Contact points
weight: 430
---

# Contact points

Use contact points to define how your contacts are notified when an alert fires. A contact point can have one or more contact point types, for example, email, slack, webhook, and so on. When an alert fires, a notification is sent to all contact point types listed for a contact point. Optionally, use [message templates]({{< relref "./message-templating/_index.md" >}}) to customize notification messages for the contact point types.

You can configure Grafana managed contact points as well as contact points for an [external Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}). For more information, see [Alertmanager]({{< relref "./fundamentals/alertmanager.md" >}}).

## Add a contact point

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. Click **Contact points** to open the page listing existing contact points.
1. Click **New contact point**.
1. From the **Alertmanager** dropdown, select an Alertmanager. By default, Grafana Alertmanager is selected.
1. In **Name**, enter a descriptive name for the contact point.
1. From **Contact point type**, select a type and fill out mandatory fields. For example, if you choose email, enter the email addresses. Or if you choose Slack, enter the Slack channel(s) and users who should be contacted.
1. Some contact point types, like email or webhook, have optional settings. In **Optional settings**, specify additional settings for the selected contact point type.
1. In Notification settings, optionally select **Disable resolved message** if you do not want to be notified when an alert resolves.
1. To add another contact point type, click **New contact point type** and repeat steps 6 through 8.
1. Click **Save contact point** to save your changes.

## Edit a contact point

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. Find the contact point to edit, then click **Edit** (pen icon).
1. Make any changes and click **Save contact point**.

## Test a contact point

For Grafana managed contact points, you can send a test notification which helps verify a contact point is configured correctly.

To send a test notification:

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact** points.
1. Find the contact point to test, then click **Edit** (pen icon). You can also create a new contact point if needed.
1. Click **Test** (paper airplane icon) to open the contact point testing modal.
1. Choose whether to send a predefined test notification or choose custom to add your own custom annotations and labels to include in the notification.
1. Click **Send test notification** to fire the alert.

## Delete a contact point

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. Find the contact point to delete, then click **Delete** (trash icon).
1. In the confirmation dialog, click **Yes, delete**.

> **Note:** You cannot delete contact points that are in use by a notification policy. You will have to either delete the [notification policy]({{< relref "./notifications/_index.md" >}}) or update it to use another contact point.

## Edit Alertmanager global config

To edit global configuration options for an external Alertmanager, like SMTP server, that is used by default for all email contact types:

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. From the **Alertmanager** drop-down, select an external Alertmanager data source.
1. Click the **Edit global config** option.
1. Add global configuration settings.
1. Click **Save global config** to save your changes.

> **Note** This option is available only for external Alertmanagers. You can configure some global options for Grafana contact types, like email settings, via [Grafana configuration]({{< relref "../../administration/configuration.md" >}}).

## List of notifiers supported by Grafana

| Name                                          | Type                      | Grafana Alertmanager | Other Alertmanagers                                                                                      |
| --------------------------------------------- | ------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| [DingDing](#dingdingdingtalk)                 | `dingding`                | Supported            | N/A                                                                                                      |
| [Discord](#discord)                           | `discord`                 | Supported            | N/A                                                                                                      |
| [Email](#email)                               | `email`                   | Supported            | Supported                                                                                                |
| [Google Hangouts Chat](#google-hangouts-chat) | `googlechat`              | Supported            | N/A                                                                                                      |
| [Kafka](#kafka)                               | `kafka`                   | Supported            | N/A                                                                                                      |
| Line                                          | `line`                    | Supported            | N/A                                                                                                      |
| Microsoft Teams                               | `teams`                   | Supported            | N/A                                                                                                      |
| [Opsgenie](#opsgenie)                         | `opsgenie`                | Supported            | Supported                                                                                                |
| [Pagerduty](#pagerduty)                       | `pagerduty`               | Supported            | Supported                                                                                                |
| Prometheus Alertmanager                       | `prometheus-alertmanager` | Supported            | N/A                                                                                                      |
| [Pushover](#pushover)                         | `pushover`                | Supported            | Supported                                                                                                |
| Sensu                                         | `sensu`                   | Supported            | N/A                                                                                                      |
| [Sensu Go](#sensu-go)                         | `sensugo`                 | Supported            | N/A                                                                                                      |
| [Slack](#slack)                               | `slack`                   | Supported            | Supported                                                                                                |
| Telegram                                      | `telegram`                | Supported            | N/A                                                                                                      |
| Threema                                       | `threema`                 | Supported            | N/A                                                                                                      |
| VictorOps                                     | `victorops`               | Supported            | Supported                                                                                                |
| [Webhook](#webhook)                           | `webhook`                 | Supported            | Supported ([different format](https://prometheus.io/docs/alerting/latest/configuration/#webhook_config)) |
| [WeCom](#wecom)                               | `wecom`                   | Supported            | N/A                                                                                                      |
| [Zenduty](#zenduty)                           | `webhook`                 | Supported            | N/A                                                                                                      |

### Webhook

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

#### Body

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

#### Alert

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

#### Removed fields related to dashboards

Alerts are not coupled to dashboards anymore therefore the fields related to dashboards `dashboardId` and `panelId` have been removed.

### WeCom

WeCom contact points need a Webhook URL. These are obtained by setting up a WeCom robot on the corresponding group chat. To obtain a Webhook URL using the WeCom desktop Client please follow these steps:

1. Click the "..." in the top right corner of a group chat that you want your alerts to be delivered to
2. Click "Add Group Robot", select "New Robot" and give your robot a name. Click "Add Robot"
3. There should be a Webhook URL in the panel.

| Setting | Description        |
| ------- | ------------------ |
| Url     | WeCom webhook URL. |
