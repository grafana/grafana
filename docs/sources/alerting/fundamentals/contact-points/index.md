---
aliases:
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
title: Contact points
weight: 410
---

# Contact points

Use contact points to define how your contacts are notified when an alert rule fires. A contact point can have one or more contact point types, for example, email, slack, webhook, and so on. When an alert rule fires, a notification is sent to all contact point types listed for a contact point. Contact points can be configured for the Grafana Alertmanager as well as external alertmanagers.

You can also use notification templating to customize notification messages for contact point types.

**Note:**

If you've created an OnCall contact point in the Grafana OnCall application, you can view it in the Alerting application.

## Supported contact point integrations

The following table lists the contact point integrations supported by Grafana.

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

## Useful links

[Manage contact points](docs/grafana/next/alerting/manage-notifications/create-contact-point/)

[Create and edit notification templates](https:/docs/grafana/next/alerting/manage-notifications/create-message-template/)
