---
aliases:
  - metrics/
title: Grafana alerts
weight: 113
---

# Overview of Grafana alerting

Grafana 8.0 has new and improved alerting that centralizes alerting information in a single, searchable view. It is enabled by default for all new OSS instances, and is an [opt-in]({{< relref "./opt-in.md" >}}) feature for older installations that still use legacy dashboard alerting. We encourage you to create issues in the Grafana GitHub repository for bugs found while testing Grafana alerting. See also, [What's New with Grafana alerting]({{< relref "./difference-old-new.md" >}}).

When Grafana alerting is enabled, you can:

- [Create Grafana managed alerting rules]({{< relref "alerting-rules/create-grafana-managed-rule.md" >}})
- [Create Cortex or Loki managed alerting rules]({{< relref "alerting-rules/create-cortex-loki-managed-rule.md" >}})
- [View existing alerting rules and manage their current state]({{< relref "alerting-rules/rule-list.md" >}})
- [View the state and health of alerting rules]({{< relref "./fundamentals/state-and-health.md" >}})
- [Add or edit an alert contact point]({{< relref "./contact-points.md" >}})
- [Add or edit notification policies]({{< relref "./notifications/_index.md" >}})
- [Add or edit silences]({{< relref "./silences.md" >}})

Before you begin using Grafana alerting, we recommend that you familiarize yourself with some [basic concepts]({{< relref "./fundamentals/_index.md" >}}) of Grafana alerting.

## Limitations

- The Grafana alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch rules from other supported data sources.
- We aim to support the latest two minor versions of both Prometheus and Alertmanager. We cannot guarantee that older versions will work. As an example, if the current Prometheus version is `2.31.1`, we support >= `2.29.0`.
