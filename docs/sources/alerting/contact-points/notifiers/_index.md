---
aliases:
  - /docs/grafana/latest/alerting/contact-points/message-templating/
  - /docs/grafana/latest/alerting/message-templating/
  - /docs/grafana/latest/alerting/unified-alerting/message-templating/
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: List of notifiers
weight: 130
---

# List of supported notifiers

The following table lists the notifiers (contact point types) supported by Grafana.

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
