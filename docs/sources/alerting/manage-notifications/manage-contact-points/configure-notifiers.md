---
description: Notifier configuration guide
draft: true
keywords:
  - Grafana
  - alerting
  - guide
  - notifications
  - notifiers
  - contact points
title: Configure notifiers
weight: 100
---

# Configure notifiers

Configuring notifiers in Grafana allows you to receive notifications for your alert rules in your preferred communication channels. Each notifier has its own configuration options and setup process, but in general, the process involves providing an API key or webhook URL.

Once configured, you can use notifiers as part of your contact points to receive notifications whenever your alert changes its state. In this section, we'll cover the basic steps to configure your notifiers, so you can start receiving real-time alerts and stay on top of your monitoring data.

## List of supported notifiers

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

To set up PagerDuty, all you have to do is to provide an integration key.

| Setting         | Description                                            |
| --------------- | ------------------------------------------------------ |
| Integration Key | Integration key for PagerDuty                          |
| Severity        | Level for dynamic notifications, default is `critical` |
| Custom Details  | Additional details about the event                     |

The `CustomDetails` field is an object containing arbitrary key-value pairs. The user-defined details get merged with the ones we use by default.

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
