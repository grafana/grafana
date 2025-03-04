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
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
---

# Configure webhook notifications

Use the webhook integration in contact points to send alert notifications to your webhook.

The webhook integration is a flexible way to integrate alerts into your system. When a notification is triggered, it sends a JSON request with alert details and additional data to the webhook endpoint.

## Configure webhook for a contact point

To create a contact point with webhook integration, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a name for the contact point.
1. From the **Integration** list, select **Webhook**.
1. In the **URL** field, copy in your Webhook URL.
1. (Optional) Configure [additional settings](#webhook-settings).
1. Click **Save contact point**.

For more details on contact points, including how to test them and enable notifications, refer to [Configure contact points](ref:configure-contact-points).

## Webhook settings

| Option | Description      |
| ------ | ---------------- |
| URL    | The Webhook URL. |

#### Optional settings

| Option                            | Description                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| HTTP Method                       | Specifies the HTTP method to use: `POST` or `PUT`.                                                                      |
| Basic Authentication Username     | Username for HTTP Basic Authentication.                                                                                 |
| Basic Authentication Password     | Password for HTTP Basic Authentication.                                                                                 |
| Authentication Header Scheme      | Scheme for the `Authorization` Request Header. Default is `Bearer`.                                                     |
| Authentication Header Credentials | Credentials for the `Authorization` Request header.                                                                     |
| Max Alerts                        | Maximum number of alerts to include in a notification. Any alerts exceeding this limit are ignored. `0` means no limit. |
| TLS                               | TLS configuration options, including CA certificate, client certificate, and client key.                                |

{{< admonition type="note" >}}

You can configure either HTTP Basic Authentication or the Authorization request header, but not both.

{{< /admonition >}}

#### Optional settings using templates

Use the following settings to include custom data within the [JSON payload](#body). Both options support using [notification templates](ref:notification-templates).

| Option  | Description                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Title   | Sends the value as a string in the `title` field of the [JSON payload](#body). Supports [notification templates](ref:notification-templates).   |
| Message | Sends the value as a string in the `message` field of the [JSON payload](#body). Supports [notification templates](ref:notification-templates). |

{{< admonition type="note" >}}
You can customize the `title` and `message` options to include custom messages and notification data using notification templates. These fields are always sent as strings in the JSON payload.

However, you cannot customize the webhook data structure, such as adding or changing other JSON fields and HTTP headers, or sending data in a different format like XML.

If you need to format these fields as JSON or modify other webhook request options, consider sending webhook notifications to a proxy server that adjusts the webhook request before forwarding it to the final destination.
{{< /admonition >}}

#### Optional notification settings

| Option                   | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| Disable resolved message | Enable this option to prevent notifications when an alert resolves. |

## JSON payload

The following example shows the payload of a webhook notification containing information about two firing alerts:

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

### Body

The JSON payload of webhook notifications includes the following key-value pairs:

| Key                 | Type                      | Description                                                                      |
| ------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `receiver`          | string                    | Name of the contact point.                                                       |
| `status`            | string                    | Current status of the alert, `firing` or `resolved`.                             |
| `orgId`             | number                    | ID of the organization related to the payload.                                   |
| `alerts`            | array of [alerts](#alert) | Alerts that are triggering.                                                      |
| `groupLabels`       | object                    | Labels that are used for grouping, map of string keys to string values.          |
| `commonLabels`      | object                    | Labels that all alarms have in common, map of string keys to string values.      |
| `commonAnnotations` | object                    | Annotations that all alarms have in common, map of string keys to string values. |
| `externalURL`       | string                    | External URL to the Grafana instance sending this webhook.                       |
| `version`           | string                    | Version of the payload structure.                                                |
| `groupKey`          | string                    | Key that is used for grouping.                                                   |
| `truncatedAlerts`   | number                    | Number of alerts that were truncated.                                            |
| `state`             | string                    | State of the alert group (either `alerting` or `ok`).                            |

The following key-value pairs are also included in the JSON payload and can be configured in the [webhook settings using notification templates](#optional-settings-using-templates).

| Key       | Type   | Description                                                                                                          |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `title`   | string | Custom title. Configurable in [webhook settings using notification templates](#optional-settings-using-templates).   |
| `message` | string | Custom message. Configurable in [webhook settings using notification templates](#optional-settings-using-templates). |

### Alert

The Alert object represents an alert included in the notification group, as provided by the [`alerts` field](#body).

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
