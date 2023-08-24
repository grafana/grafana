+++
title = "Legacy Grafana Alerts"
weight = 114
+++

# Legacy Grafana alerts

Out of the box, Grafana still supports legacy dashboard alerts. If you are using version 8.0 or later, you can [opt-in]({{< relref "../unified-alerting/opt-in.md" >}}) to use Grafana 8 alerts. See [What's New with Grafana 8 alerting]({{< relref "../unified-alerting/difference-old-new.md" >}}) for more information.

Legacy alerts have two main components:

- Alert rule - When the alert is triggered. Alert rules are defined by one or more conditions that are regularly evaluated by Grafana.
- Notification channel - How the alert is delivered. When the conditions of an alert rule are met, the Grafana notifies the channels configured for that alert.

## Alert tasks

You can perform the following tasks for alerts:

- [Create an alert rule]({{< relref "create-alerts.md" >}})
- [View existing alert rules and their current state]({{< relref "view-alerts.md" >}})
- [Test alert rules and troubleshoot]({{< relref "troubleshoot-alerts.md" >}})
- [Add or edit an alert contact point]({{< relref "notifications.md" >}})

{{< docs/shared lookup="alerts/grafana-managed-alerts.md" source="grafana" version="<GRAFANA VERSION>" >}}
