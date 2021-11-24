+++
title = "Legacy Grafana Alerts"
weight = 114
+++

# Legacy Grafana alerts

In Grafana 8.3 Grafana alerting is available by default for all new OSS installations. See [What's New with Grafana alerting]({{< relref "../unified-alerting/difference-old-new.md" >}}) for more information.

For older OSS and Enterprise installations (both old and new), Grafana still supports legacy dashboard alerts. For instructions on how migrate to new Grafana alerts, see [opt-in]({{< relref "../unified-alerting/opt-in.md" >}}).

Legacy dashboard alerts have two main components:

- Alert rule - When the alert is triggered. Alert rules are defined by one or more conditions that are regularly evaluated by Grafana.
- Notification channel - How the alert is delivered. When the conditions of an alert rule are met, the Grafana notifies the channels configured for that alert.

## Alert tasks

You can perform the following tasks for alerts:

- [Create an alert rule]({{< relref "create-alerts.md" >}})
- [View existing alert rules and their current state]({{< relref "view-alerts.md" >}})
- [Test alert rules and troubleshoot]({{< relref "troubleshoot-alerts.md" >}})
- [Add or edit an alert contact point]({{< relref "notifications.md" >}})

{{< docs/shared "alerts/grafana-managed-alerts.md" >}}
