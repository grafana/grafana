+++
title = "Grafana 8 Alerts"
aliases = ["/docs/grafana/latest/alerting/metrics/"]
weight = 113
+++

# Overview of Grafana 8 alerting

Grafana 8.0 has new and improved alerting that centralizes alerting information in a single, searchable view. It is an [opt-in]({{< relref "./opt-in.md" >}}) feature. We encourage you to create issues in the Grafana GitHub repository for bugs found while testing Grafana 8 alerting. See also, [What's New with Grafana 8 alerting]({{< relref "./difference-old-new.md" >}}).

When Grafana 8 alerting is enabled, you can:

- [Create a Grafana managed alerting rules]({{< relref "alerting-rules/create-grafana-managed-rule.md" >}})
- [Create a Cortex or Loki managed alerting rules]({{< relref "alerting-rules/create-cortex-loki-managed-rule.md" >}})
- [View existing alerting rules and manage their current state]({{< relref "alerting-rules/rule-list.md" >}})
- [View the state and health of alerting rules]({{< relref "./fundamentals/state-and-health.md" >}})
- [Add or edit an alert contact point]({{< relref "./contact-points.md" >}})
- [Add or edit notification policies]({{< relref "./notification-policies.md" >}})
- [Add or edit silences]({{< relref "./silences.md" >}})

Before you begin using Grafana 8 alerting, we recommend that you familiarize yourself with some [basic concepts]({{< relref "./fundamentals/_index.md" >}}) of Grafana 8 alerting.

## Limitations

- The Grafana 8 alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch rules from other supported data sources.
- Our aim is to support the latest two [minor](https://semver.org/) versions of both Prometheus and Alertmanager, older versions might work without any guarantees. As an example, if the current Prometheus version is `2.31.1`, we would support `>= 2.29.0`.
