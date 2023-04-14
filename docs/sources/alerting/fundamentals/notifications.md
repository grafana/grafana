---
aliases:
  - ../notifications/
description: Notifications
keywords:
  - grafana
  - alerting
  - alertmanager
  - notification policies
  - contact points
  - silences
title: Notifications
weight: 410
---

# Notifications

Grafana uses Alertmanagers to send notifications for firing and resolved alerts. Grafana has its own Alertmanager, referred to as "Grafana" in the user interface, but also supports sending notifications from other Alertmanagers too, such as the [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/). The Grafana Alertmanager uses notification policies and contact points to configure how and where a notification is sent; how often a notification should be sent; and whether alerts should all be sent in the same notification, sent in grouped notifications based on a set of labels, or as separate notifications.

## Notification policies

Notification policies control when and where notifications are sent. A notification policy can choose to send all alerts together in the same notification, send alerts in grouped notifications based on a set of labels, or send alerts as separate notifications. You can configure each notification policy to control how often notifications should be sent as well as having one or more mute timings to inhibit notifications at certain times of the day and on certain days of the week.

Notification policies are organized in a tree structure where at the root of the tree there is a notification policy called the default policy. There can be only one default policy and the default policy cannot be deleted.

Specific routing policies are children of the default policy and can be used to match either all alerts or a subset of alerts based on a set of matching labels. A notification policy matches an alert when its matching labels match the labels in the alert.

A nested policy can have its own nested policies, which allow for additional matching of alerts. An example of a nested policy could be sending infrastructure alerts to the Ops team; while a nested policy might send high priority alerts to Pagerduty and low priority alerts as emails.

All alerts, irrespective of their labels, match the default policy. However, when the default policy receives an alert it looks at each nested policy and sends the alert to the first nested policy that matches the alert. If the nested policy has further nested policies, then it can attempt to the match the alert against one of its nested policies. If no nested policies match the alert then the policy itself is the matching policy. If there are no nested policies, or no nested policies match the alert, then the default policy is the matching policy.

<!-- This definitely needs a diagram and some examples (Gilles) -->

## Contact points

Contact points contain the configuration for sending notifications. A contact point is a list of integrations, each of which sends a notification to a particular email address, service or URL. Contact points can have multiple integrations of the same kind, or a combination of integrations of different kinds. For example, a contact point could contain a Pagerduty integration; an email and Slack integration; or a Pagerduty integration, a Slack integration, and two email integrations. You can also configure a contact point with no integrations; in which case no notifications are sent.

A contact point cannot send notifications until it has been added to a notification policy. A notification policy can only send alerts to one contact point, but a contact point can be added to a number of notification policies at the same time. When an alert matches a notification policy, the alert is sent to the contact point in that notification policy, which then sends a notification to each integration in its configuration.

### Supported integrations

The following table contains the integrations supported in Grafana:

| Name                                             | Type                      | Grafana Alertmanager | Other Alertmanagers                                                                                      |
| ------------------------------------------------ | ------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| [DingDing](https://www.dingtalk.com/en)          | `dingding`                | Supported            | N/A                                                                                                      |
| [Discord](https://discord.com/)                  | `discord`                 | Supported            | N/A                                                                                                      |
| [Email](#email)                                  | `email`                   | Supported            | Supported                                                                                                |
| [Google Hangouts](https://hangouts.google.com/)  | `googlechat`              | Supported            | N/A                                                                                                      |
| [Kafka](https://kafka.apache.org/)               | `kafka`                   | Supported            | N/A                                                                                                      |
| [Line](https://line.me/en/)                      | `line`                    | Supported            | N/A                                                                                                      |
| [Microsoft Teams](https://teams.microsoft.com/)  | `teams`                   | Supported            | N/A                                                                                                      |
| [Opsgenie](https://atlassian.com/opsgenie/)      | `opsgenie`                | Supported            | Supported                                                                                                |
| [Pagerduty](https://www.pagerduty.com/)          | `pagerduty`               | Supported            | Supported                                                                                                |
| [Prometheus Alertmanager](https://prometheus.io) | `prometheus-alertmanager` | Supported            | N/A                                                                                                      |
| [Pushover](https://pushover.net/)                | `pushover`                | Supported            | Supported                                                                                                |
| [Sensu Go](https://docs.sensu.io/sensu-go/)      | `sensugo`                 | Supported            | N/A                                                                                                      |
| [Slack](https://slack.com/)                      | `slack`                   | Supported            | Supported                                                                                                |
| [Telegram](https://telegram.org/)                | `telegram`                | Supported            | N/A                                                                                                      |
| [Threema](https://threema.ch/)                   | `threema`                 | Supported            | N/A                                                                                                      |
| [VictorOps](https://help.victorops.com/)         | `victorops`               | Supported            | Supported                                                                                                |
| [Webhook](#webhook)                              | `webhook`                 | Supported            | Supported ([different format](https://prometheus.io/docs/alerting/latest/configuration/#webhook_config)) |
| [Cisco Webex Teams](#webex)                      | `webex`                   | Supported            | Supported                                                                                                |
| [WeCom](#wecom)                                  | `wecom`                   | Supported            | N/A                                                                                                      |
| [Zenduty](https://www.zenduty.com/)              | `webhook`                 | Supported            | N/A                                                                                                      |

## Templating notifications

You can customize notifications with templates. For example, templates can be used to change the subject and message of an email, or the title and message of notifications sent to Slack.

Templates are not limited to an individual integration or contact point, but instead can be used in a number of integrations in the same contact point and even integrations across different contact points. For example, a Grafana user can create a template called `custom_subject_or_title` and use it for both templating subjects in emails and titles of Slack messages without having to create two separate templates.

All notifications templates are written in [Go's templating language](https://pkg.go.dev/text/template), and are in the Contact points tab on the Alerting page.

## Silences

You can use silences to mute notifications from one or more firing rules. Silences do not stop alerts from firing or being resolved, or hide firing alerts in the user interface. A silence lasts as long as its duration which can be configured in minutes, hours, days, months or years.
