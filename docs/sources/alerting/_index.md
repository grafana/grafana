+++
title = "Alerts"
weight = 110

+++

# Grafana alerts

Alerts allow you to learn about problems in your systems moments after they occur. Robust and actionable alerts help you identify and resolve issues quickly, minimizing disruption to your services.

Grafana alerting centralizes alerting information in a single, searchable view that allows you to:

- Create and manage Grafana alerts
- Create and manage Grafana Mimir and Loki managed alerts
- View alerting information from Prometheus and Alertmanager compatible data sources

Grafana alerting is enabled by default for new installations or  existing installs which do not have any alerts configured. For older installations, it is still an [opt-in]({{< relref "./opt-in.md" >}}) feature.

| Release                  | Cloud         | Enterprise    | OSS                              |
| ------------------------ | ------------- | ------------- | -------------------------------- |
| Grafana 9.0 (unreleased) | On by default | On by default | On by default                    |

Grafana alerting has four key components:

- Alerting rule - Evaluation criteria that determine whether an alert will fire. It consists of one or more queries and expressions, a condition, the frequency of evaluation, and optionally, the duration over which the condition is met.
- Contact point - Channel for sending notifications when the conditions of an alerting rule are met.
- Notification policy - Set of matching and grouping criteria used to determine where and how frequently to send notifications.
- Silences - Date and matching criteria used to silence notifications.

To learn more, see [What's New with Grafana alerting]({{< relref "./difference-old-new.md" >}}).
