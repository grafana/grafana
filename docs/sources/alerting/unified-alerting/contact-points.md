+++
title = "Contact points"
description = "Create or edit contact point"
keywords = ["grafana", "alerting", "guide", "contact point", "notification channel", "create"]
weight = 400
+++

# Contact points

Use contact points to define how your contacts are notified when an alert fires. A contact point can have one or more contact point types, for example, email, slack, webhook, and so on. When an alert fires, a notification is sent to all contact point types listed for a contact point. Optionally, use [mesasge templates]({{< relref "./message-templating/_index.md" >}}) to customize notification messages for the contact point types. 

## Alertmanager

Grafana includes built-in support for Prometheus Alertmanager. By default, contact points for Grafana managed alerts are handled by this embedded Alertmanager. Grafana 8 alerting also supports an external Alertmanager configuration. When you add an [Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}), a dropdown displays at the top of the create contact points page where you can select either `Grafana` or the external Alertmanager as your data source. To know more about Alertmanagers, see [Prometheus Alertmanager documentation](https://prometheus.io/docs/alerting/latest/alertmanager/).

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" max-width="250px" caption="Select Alertmanager" >}}

> **Note:** Before v8.2, the configuration of the embedded Alertmanager was shared across organizations. If you are on an older Grafana version, we recommend that you use Grafana 8 Alerts only if you have one organization. Otherwise, your contact points are visible to all organizations.

## Add a contact point

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. Click **Contact points** to open the page listing existing contact points. 
1. Click **New contact point**.
1. From the **Alertmanager** dropdown, select an Alertmanager. By default, the Grafana Alertmanager is listed.
1. In **Name**, enter a descriptive name for the contact point.
1. From **Contact point type**, select a type and fill out mandatory fields. For example, if you choose email, enter the email addresses. Or if you choose slack, enter the slack channels and users who should be contacted. 
1. Some contact point types, like email or webhook, have optional settings. In **Optional settings**, specify additional settings for the selected contact point type.
1. In Notification settings, optionally select **Disable resolved message** if you do not want to be notified when an alert resolves.
1. To add another contact point type, click **New contact point type** and repeat steps 6 through 8.
1. Click **Save contact point** to save your changes.

## Edit a contact point

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. Find the contact point you want to edit, then click **Edit** (pen icon).
1. Make any changes and click **Save contact point**.

## Delete a contact point

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. Find the contact point you want to delete, then click **Delete** (trash icon). 
1. In the confirmation dialog, click **Yes, delete**. This deletes the content point.

> **Note:** You cannot delete contact points that are in use by a notification policy. You will have to either delete the [notification policy]({{< relref "./notification-policies.md" >}}) or update it to use another contact point.

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

### Edit Alertmanager global config

To edit global configuration options for an external Alertmanager, like SMTP server, that is used by default for all email contact types:

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. From the **Alertmanager** drop down, select an external Alertmanager data source.
1. Click the **Edit global config** option.
1. Add global configuration settings. 
1. Click **Save global config** to save your changes.

> **Note** This option is available only for external Alertmanagers. You can configure some global options for Grafana contact types, like email settings, via [Grafana configuration]({{< relref "../../administration/configuration.md" >}}).
