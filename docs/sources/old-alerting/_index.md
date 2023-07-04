---
draft: true
title: Legacy Grafana alerts
weight: 114
---

# Legacy Grafana alerts

Grafana Alerting is enabled by default for new OSS installations. For older installations, it is still an [opt-in]({{< relref "../alerting/migrating-alerts/opt-in" >}}) feature.

{{% admonition type="note" %}}
Legacy dashboard alerts are deprecated and will be removed in Grafana 9. We encourage you to migrate to [Grafana Alerting]({{< relref "../alerting/migrating-alerts" >}}) for all existing installations.
{{% /admonition %}}

Legacy dashboard alerts have two main components:

- Alert rule - When the alert is triggered. Alert rules are defined by one or more conditions that are regularly evaluated by Grafana.
- Notification channel - How the alert is delivered. When the conditions of an alert rule are met, the Grafana notifies the channels configured for that alert.

## Alert tasks

You can perform the following tasks for alerts:

- [Create an alert rule]({{< relref "./create-alerts" >}})
- [View existing alert rules and their current state]({{< relref "./view-alerts" >}})
- [Test alert rules and troubleshoot]({{< relref "./troubleshoot-alerts" >}})
- [Add or edit an alert contact point]({{< relref "./notifications" >}})

{{< docs/shared "alerts/grafana-managed-alerts.md" >}}
