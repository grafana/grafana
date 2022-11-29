---
aliases:
  - /docs/grafana/latest/alerting/notifications/
  - /docs/grafana/latest/alerting/contact-points/
  - /docs/grafana/latest/alerting/unified-alerting/contact-points/
  - /docs/grafana/latest/alerting/fundamentals/contact-points/contact-point-types/
description: Create or edit contact point
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - notification channel
  - create
title: Notifications
weight: 410
---

# Notifications

Notifications are sent when an alert is firing or has been resolved, and configuring how and where a notification should be sent is done via notification policies. With notification policies it is possible to configure how often a notification should be sent; and whether alerts should all be sent in the same notification, sent in grouped notifications based on a set of labels, or as seperate notifications.

## Notification policies

Notification policies control when and where notifications are sent. A notification policy can choose to send all alerts together in the same notification, send alerts in grouped notifications based on a set of labels, or send alerts as separate notifications. Each notification policy can have its own timings configuration that control how often notifications should be sent; and can reference one or more mute timings to inhibit notifications at certain times of the day and on certain days of the week.

Notification policies are organized in a tree structure where at the root of the tree there is a notification policy called the root policy. There can be only one root policy, and the root policy cannot be deleted.

Specific routing policies are children of the root policy, and can be used to match either all alerts, or a subset of alerts based on a set of labels. An example of a specific routing policy could be sending high priority alerts to Pagerduty and sending low priority alerts as emails. Another example of a specific routing policy could be sending infrastructure alerts to the Ops team, and all other alerts to another team.

When an alert is sent to the root policy it looks at each specific routing policy and sends the alert to the first specific routing policy that matches the alert. If there are no specific routing policies, or none which match the alert, then the root policy is the matching policy.

More information on how to configure notification policies can be found [here]({{< relref "../../manage-notifications/create-notification-policy/" >}}).

## Contact points

Contact points contain the configuration for sending notifications. A contact point is a list of integrations, each of which sends a notification to a particular email address, service or URL. Contact points can have multiple integrations of the same kind, or a combination of integrations of different kinds. For example, a contact point could contain a Pagerduty integration; an email and Slack integration; or a Pagerduty integration, a Slack integration, and two email integrations. A contact point can also be configured with no integrations in which case no notifications are sent.

However, a contact point cannot send notifications until it has been added to a notification policy. A notification policy can only send alerts to one contact point, but a contact point can be added to a number of notification policies at the same time. When an alert matches a notification policy, the alert is sent to the contact point in that notification policy, which then sends a notification to each integration in its configuration.

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

You can to customize notifications with templates. For example, templates can be used to change the subject and message of an email, or the title and message of notifications sent to Slack.

Templates are not limited to an individual integration or contact point, but instead can be used in a number of integrations in the same contact point and even integrations across different contact points. For example, a Grafana user can create a template called `custom_subject_or_title` and use it for both templating subjects in emails and titles of Slack messages without having to create two separate templates.

All notifications templates are written [Go's templating language](https://pkg.go.dev/text/template), and can be found in the Contact points tab on the Alerting page.

More information on how to template notifications can be found [here]({{< relref "../../manage-notifications/create-message-template/" >}}).

## Useful links

- [Notification policies]({{< relref "../../manage-notifications/create-notification-policy/" >}})
- [Contact points]({{< relref "../../manage-notifications/create-contact-point/" >}})
- [Templating notifications]({{< relref "../../manage-notifications/create-message-template/" >}})
