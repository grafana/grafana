---
aliases:
  - ../../fundamentals/contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/
  - ../../fundamentals/contact-points/contact-point-types/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/contact-point-types/
  - ../../contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/
  - ../../unified-alerting/contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/contact-points/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/contact-points/
description: Learn about contact points and the supported contact point integrations
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - notification channel
  - create
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Contact points
weight: 112
---

# Contact points

Contact points contain the configuration for sending notifications. A contact point is a list of integrations, each of which sends a notification to a particular email address, service or URL. Contact points can have multiple integrations of the same kind, or a combination of integrations of different kinds. For example, a contact point could contain a Pagerduty integration; an email and Slack integration; or a Pagerduty integration, a Slack integration, and two email integrations. You can also configure a contact point with no integrations; in which case no notifications are sent.

A contact point cannot send notifications until it has been added to a notification policy. A notification policy can only send alerts to one contact point, but a contact point can be added to a number of notification policies at the same time. When an alert matches a notification policy, the alert is sent to the contact point in that notification policy, which then sends a notification to each integration in its configuration.

Contact points can be configured for the Grafana Alertmanager as well as external alertmanagers.

You can also use notification templating to customize notification messages for contact point integrations.

**Note:**

If you've created an OnCall contact point in the Grafana OnCall application, you can view it in the Alerting application.

## Supported contact point integrations

The following table lists the contact point integrations supported by Grafana.

| Name                                             | Type                      | Grafana Alertmanager | Other Alertmanagers                                                                                      |
| ------------------------------------------------ | ------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| [DingDing](https://www.dingtalk.com/en)          | `dingding`                | Supported            | N/A                                                                                                      |
| [Discord](https://discord.com/)                  | `discord`                 | Supported            | N/A                                                                                                      |
| Email                                            | `email`                   | Supported            | Supported                                                                                                |
| [Google Chat](https://chat.google.com/)          | `googlechat`              | Supported            | N/A                                                                                                      |
| [Kafka](https://kafka.apache.org/)               | `kafka`                   | Supported            | N/A                                                                                                      |
| [Line](https://line.me/en/)                      | `line`                    | Supported            | N/A                                                                                                      |
| [Microsoft Teams](https://teams.microsoft.com/)  | `teams`                   | Supported            | Supported                                                                                                |
| [Opsgenie](https://atlassian.com/opsgenie/)      | `opsgenie`                | Supported            | Supported                                                                                                |
| [Pagerduty](https://www.pagerduty.com/)          | `pagerduty`               | Supported            | Supported                                                                                                |
| [Prometheus Alertmanager](https://prometheus.io) | `prometheus-alertmanager` | Supported            | N/A                                                                                                      |
| [Pushover](https://pushover.net/)                | `pushover`                | Supported            | Supported                                                                                                |
| [Sensu Go](https://docs.sensu.io/sensu-go/)      | `sensugo`                 | Supported            | N/A                                                                                                      |
| [Slack](https://slack.com/)                      | `slack`                   | Supported            | Supported                                                                                                |
| [Telegram](https://telegram.org/)                | `telegram`                | Supported            | N/A                                                                                                      |
| [Threema](https://threema.ch/)                   | `threema`                 | Supported            | N/A                                                                                                      |
| [VictorOps](https://help.victorops.com/)         | `victorops`               | Supported            | Supported                                                                                                |
| Webhook                                          | `webhook`                 | Supported            | Supported ([different format](https://prometheus.io/docs/alerting/latest/configuration/#webhook_config)) |
| Cisco Webex Teams                                | `webex`                   | Supported            | Supported                                                                                                |
| WeCom                                            | `wecom`                   | Supported            | N/A                                                                                                      |
| [Zenduty](https://www.zenduty.com/)              | `webhook`                 | Supported            | N/A                                                                                                      |
