+++
title = "Alerts"
weight = 110
+++

# Grafana alerts

Alerts allow you to learn about problems in your systems moments after they occur. Robust and actionable alerts help you identify and resolve issues quickly, minimizing disruption to your services.

Grafana 8.0 has new and improved alerting that centralizes alerting information in a single, searchable view. It allows you to:

- Create and manage Grafana alerts
- Create and manage Cortex and Loki managed alerts
- View alerting information from Prometheus and Alertmanager compatible data sources

Grafana 8 alerting has four key components:

- Alerting rule - Evaluation criteria that determine whether an alert will fire. It consists of one or more queries and expressions, a condition, the frequency of evaluation, and optionally, the duration over which the condition is met.
- Contact point - Channel for sending notifications when the conditions of an alerting rule are met.
- Notification policy - Set of matching and grouping criteria used to determine where and how frequently to send notifications.
- Silences - Date and matching criteria used to silence notifications.

To learn more, see [What's New with Grafana 8 alerting]({{< relref "../alerting/unified-alerting/difference-old-new.md" >}}).

For information on how to create and manage Grafana 8 alerts and notifications, refer to [Overview of Grafana 8.0 alerts]({{< relref "../alerting/unified-alerting/_index.md" >}}) and [Create and manage Grafana 8 alerting rules]({{< relref "./unified-alerting/alerting-rules/_index.md" >}}).

> **Note:** Grafana 8 alerting is an [opt-in]({{< relref "./unified-alerting/opt-in.md" >}}) feature. Out of the box, Grafana still supports old [legacy dashboard alerts]({{< relref "./old-alerting/_index.md" >}}). We encourage you to create issues in the Grafana GitHub repository for bugs found while testing Grafana 8 alerts.
