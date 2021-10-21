+++
title = "Grafana 8 Alerts"
aliases = ["/docs/grafana/latest/alerting/metrics/"]
weight = 113
+++

# Overview of Grafana 8 alerts

Grafana 8 alerts is an [opt-in]({{< relref "./unified-alerting/opt-in.md" >}}) feature. We encourage you to create issues in the Grafana GitHub repository for bugs found while testing Grafana 8 alerting. See also, [What's New with Grafana 8 alerting]({{< relref "../alerting/unified-alerting/difference-old-new.md" >}}).

When Grafana 8 alerting is enabled, you can:

- [Create a Grafana managed alert rule]({{< relref "alerting-rules/create-grafana-managed-rule.md" >}})
- [Create a Cortex or Loki managed alert rule]({{< relref "alerting-rules/create-cortex-loki-managed-rule.md" >}})
- [View existing alert rules and their current state]({{< relref "alerting-rules/rule-list.md" >}})
- [View state and health of alerting rules]({{< relref "./basics/state-and-health.md" >}})
- [Add or edit an alert contact point]({{< relref "./contact-points.md" >}})
- [Add or edit notification policies]({{< relref "./notification-policies.md" >}})
- [Create and edit silences]({{< relref "./silences.md" >}})

## Limitation

- Grafana 8 alerting doesn’t support high availability. Alert notifications are not de-duplicated and load balancing is not supported between instances. For example, silences from one instance will not appear in another.
- Grafana 8 alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch rules from all other supported data sources at this time.
