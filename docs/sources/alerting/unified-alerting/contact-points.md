+++
title = "Contact points"
description = "Create or edit contact point"
keywords = ["grafana", "alerting", "guide", "contact point", "notification channel", "create"]
weight = 400
+++

# Contact points

Contact points define where to send notifications about alerts that match a particular [notification policy]({{< relref "./notification-policies.md" >}}). A contact point can contain one or more contact point types, eg email, slack, webhook and so on. A notification will dispatched to all contact point types defined on a contact point. [Templating]({{< relref "./message-templating/_index.md" >}}) can be used to customize contact point type message with alert data. Grafana alerting UI can be used to configure both Grafana managed contact points and contact points for an [external Alertmanager if one is configured]({{< relref "../../datasources/alertmanager.md" >}}).

Grafana alerting UI allows you to configure contact points for the Grafana managed alerts (handled by the embedded Alertmanager) as well as contact points for an [external Alertmanager if one is configured]({{< relref "../../datasources/alertmanager.md" >}}), using the Alertmanager dropdown.

> **Note:** In v8.0 and v8.1, the configuration of the embedded Alertmanager was shared across organisations. Users running one of these versions are advised to use the new Grafana 8 Alerts only if they have one organisation otherwise contact points for the Grafana managed alerts will be visible by all organizations.

## Add a contact point

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. Click **Add contact point**.
1. Enter a **Name** for the contact point
1. Select contact point type and fill out mandatory fields. **Optional settings** can be expanded for more options.
1. If you'd like this contact point to notify via multiple channels, for example both email and slack, click **New contact point type** and fill out additional contact point type details.
1. Click **Save contact point** button at the bottom of the page.

## Editing a contact point

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. Find the contact point you want to edit in the contact points table and click the **pen icon** on the right side.
1. Make any changes and click **Save contact point** button at the bottom of the page.

## Deleting a contact point

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. Find the contact point you want to edit in the contact points table and click the **trash can icon** on the right side.
1. A confirmation dialog will open. Click **Yes, delete**.

**Note** You will not be able to delete contact points that are currently used by any notification policy. If you want to delete such contact point, you will have to first go to [notification policies]({{< relref "./notification-policies.md" >}}) and delete the policy or update it to use another contact point.

## List of notifiers supported by Grafana

| Name                                          | Type                      |
| --------------------------------------------- | ------------------------- |
| [DingDing](#dingdingdingtalk)                 | `dingding`                |
| [Discord](#discord)                           | `discord`                 |
| [Email](#email)                               | `email`                   |
| [Google Hangouts Chat](#google-hangouts-chat) | `googlechat`              |
| [Kafka](#kafka)                               | `kafka`                   |
| Line                                          | `line`                    |
| Microsoft Teams                               | `teams`                   |
| [Opsgenie](#opsgenie)                         | `opsgenie`                |
| [Pagerduty](#pagerduty)                       | `pagerduty`               |
| Prometheus Alertmanager                       | `prometheus-alertmanager` |
| [Pushover](#pushover)                         | `pushover`                |
| Sensu                                         | `sensu`                   |
| [Sensu Go](#sensu-go)                         | `sensugo`                 |
| [Slack](#slack)                               | `slack`                   |
| Telegram                                      | `telegram`                |
| Threema                                       | `threema`                 |
| VictorOps                                     | `victorops`               |
| [Webhook](#webhook)                           | `webhook`                 |
| [Zenduty](#zenduty)                           | `webhook`                 |

## Webhook

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
  "orgId": 1,
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

### Breaking changes when updating to unified alerting

Grafana 8 alerts introduce a new way to manage your alerting rules and alerts in Grafana.
As part of this change, there are some breaking changes that we will explain in details.

#### Multiple Alerts in one payload

As we now enable [multi dimensional alerting]({{< relref "../difference-old-new.md#multi-dimensional-alerting" >}}) a payload
consists of an array of alerts.

#### Removed fields related to dashboards

Alerts are not coupled to dashboards anymore therefore the fields related to dashboards `dashboardId` and `panelId` have been removed.
where removed. The removed fields are `dashboardId` and `panelId`.

## Manage contact points for an external Alertmanager

Grafana alerting UI supports managing external Alertmanager configuration. Once you add an [Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}), a dropdown displays at the top of the page where you can select either `Grafana` or an external Alertmanager as your data source.

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" caption="Select Alertmanager" >}}

### Edit Alertmanager global config

To edit global configuration options for an alertmanager, like SMTP server that is used by default for all email contact types:

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. In the dropdown at the top of the page, select an Alertmanager data source.
1. Click **Edit global config** button at the bottom of the page.
1. Fill out the form and click **Save global config**.

**Note** this is only for external Alertmanagers. Some global options for Grafana contact types, like email settings, can be configured via [Grafana configuration]({{< relref "../../administration/configuration.md" >}}).
