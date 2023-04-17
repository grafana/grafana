---
description: Configure integrations
keywords:
  - Grafana
  - alerting
  - guide
  - notifications
  - integrations
  - contact points
title: Configure integrations
weight: 100
---

# Configure integrations

Configure integrations in Grafana to select your preferred communication channel for receiving notifications when your alert rules are fire. Each integration has its own configuration options and setup process. In most cases, this involves providing an API key or a Webhook URL.

Once configured, you can use integrations as part of your contact points to receive notifications whenever your alert changes its state. In this section, we'll cover the basic steps to configure your integrations, so you can start receiving real-time alerts and stay on top of your monitoring data.

## List of supported integrations

| Name                    | Type                      |
| ----------------------- | ------------------------- |
| DingDing                | `dingding`                |
| Discord                 | `discord`                 |
| Email                   | `email`                   |
| Google Hangouts Chat    | `googlechat`              |
| Hipchat                 | `hipchat`                 |
| Kafka                   | `kafka`                   |
| Line                    | `line`                    |
| Microsoft Teams         | `teams`                   |
| Opsgenie                | `opsgenie`                |
| [Pagerduty](#pagerduty) | `pagerduty`               |
| Prometheus Alertmanager | `prometheus-alertmanager` |
| Pushover                | `pushover`                |
| Sensu                   | `sensu`                   |
| Sensu Go                | `sensugo`                 |
| Slack                   | `slack`                   |
| Telegram                | `telegram`                |
| Threema                 | `threema`                 |
| VictorOps               | `victorops`               |
| Webhook                 | `webhook`                 |

### PagerDuty

To set up PagerDuty, provide an integration key.

| Setting         | Description                                            |
| --------------- | ------------------------------------------------------ |
| Integration Key | Integration key for PagerDuty                          |
| Severity        | Level for dynamic notifications, default is `critical` |
| Custom Details  | Additional details about the event                     |

The `CustomDetails` field is an object containing arbitrary key-value pairs. The user-defined details are merged with the ones we use by default.

Our default values for `CustomDetails` are:

```go
{
	"firing":       `{{ template "__text_alert_list" .Alerts.Firing }}`,
	"resolved":     `{{ template "__text_alert_list" .Alerts.Resolved }}`,
	"num_firing":   `{{ .Alerts.Firing | len }}`,
	"num_resolved": `{{ .Alerts.Resolved | len }}`,
}
```

In case of duplicate keys, the user-defined details overwrite the default ones.
