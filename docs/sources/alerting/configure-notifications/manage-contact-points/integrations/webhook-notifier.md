---
aliases:
  - ../../../fundamentals/contact-points/notifiers/webhook-notifier/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/notifiers/webhook-notifier/
  - ../../../fundamentals/contact-points/webhook-notifier/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/webhook-notifier/
  - ../../../manage-notifications/manage-contact-points/webhook-notifier/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/manage-contact-points/webhook-notifier/
  - alerting/manage-notifications/manage-contact-points/webhook-notifier/
  - ../../../alerting-rules/manage-contact-points/integrations/webhook-notifier/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/manage-contact-points/integrations/webhook-notifier/

canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/
description: Configure the webhook notifier integration for Alerting
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Webhook
title: Configure the webhook notifier for Alerting
weight: 165
refs:
  notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
---

# Configure the webhook notifier for Alerting

The webhook notification is a simple way to send information about a state change over HTTP to a custom endpoint. Using this notification you could integrate Grafana into a system of your choosing.

## Webhook JSON payload

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
  "truncatedAlerts": 0,
  "title": "[FIRING:2]  (blue)",
  "state": "alerting",
  "message": "**Firing**\n\nLabels:\n - alertname = T2\n - team = blue\n - zone = us-1\nAnnotations:\n - description = This is the alert rule checking the second system\n - runbook_url = https://myrunbook.com\n - summary = This is my summary\nSource: https://play.grafana.org/alerting/1afz29v7z/edit\nSilence: https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT2%2Cteam%3Dblue%2Czone%3Dus-1\n\nLabels:\n - alertname = T1\n - team = blue\n - zone = eu-1\nAnnotations:\nSource: https://play.grafana.org/alerting/d1rdpdv7k/edit\nSilence: https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT1%2Cteam%3Dblue%2Czone%3Deu-1\n"
}
```

## Webhook fields

### Body

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
| title             | string                    | Custom title                                                                    |
| state             | string                    | State of the alert group (either `alerting` or `ok`)                            |
| message           | string                    | Custom message                                                                  |

### Alert

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

You can customize the `title` and `message` fields using [notification templates](ref:notification-templates).

However, you cannot customize webhook data structure or format, including JSON fields or sending data in XML, nor can you change the webhook HTTP headers.

{{< /admonition >}}

## Procedure

To create your Webhook integration in Grafana Alerting, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a contact point name.
1. From the Integration list, select **Webhook**.
1. In the **URL** field, copy in your Webhook URL.
1. Click **Test** to check that your integration works.

   ** For Grafana Alertmanager only.**

1. Click **Save contact point**.

## Next steps

The Webhook contact point is ready to receive alert notifications.

To add this contact point to your alert, complete the following steps.

1. In Grafana, navigate to **Alerting** > **Alert rules**.
1. Edit or create a new alert rule.
1. Scroll down to the **Configure labels and notifications** section.
1. Under Notifications, click **Select contact point**.
1. From the drop-down menu, select the previously created contact point.
1. **Click Save rule and exit**.
