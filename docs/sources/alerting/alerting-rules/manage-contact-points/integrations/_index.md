---
aliases:
  - alerting/manage-notifications/manage-contact-points/configure-integrations/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/manage-contact-points/integrations/
description: Configure contact point integrations to select your preferred communication channels for receiving notifications of firing alerts.
keywords:
  - Grafana
  - alerting
  - guide
  - notifications
  - integrations
  - contact points
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure contact point integrations
weight: 100
---

# Configure contact point integrations

Configure contact point integrations in Grafana to select your preferred communication channel for receiving notifications when your alert rules are firing. Each integration has its own configuration options and setup process. In most cases, this involves providing an API key or a Webhook URL.

Once configured, you can use integrations as part of your contact points to receive notifications whenever your alert changes its state. In this section, we'll cover the basic steps to configure your integrations, so you can start receiving real-time alerts and stay on top of your monitoring data.

## List of supported integrations

| Name                    | Type                      |
| ----------------------- | ------------------------- |
| DingDing                | `dingding`                |
| Discord                 | `discord`                 |
| Email                   | `email`                   |
| Google Chat             | `googlechat`              |
| Hipchat                 | `hipchat`                 |
| Kafka                   | `kafka`                   |
| Line                    | `line`                    |
| Microsoft Teams         | `teams`                   |
| Opsgenie                | `opsgenie`                |
| Pagerduty               | `pagerduty`               |
| Prometheus Alertmanager | `prometheus-alertmanager` |
| Pushover                | `pushover`                |
| Sensu                   | `sensu`                   |
| Sensu Go                | `sensugo`                 |
| Slack                   | `slack`                   |
| Telegram                | `telegram`                |
| Threema                 | `threema`                 |
| VictorOps               | `victorops`               |
| Webhook                 | `webhook`                 |
