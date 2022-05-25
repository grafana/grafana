+++
aliases = ["/docs/grafana/latest/alerting/", "/docs/grafana/latest/alerting/unified-alerting/difference-old-new/"]
title = "Alerting"
weight = 114
+++

# Grafana alerting

Grafana alerts allow you to learn about problems in your systems moments after they occur. Robust and actionable alerts help you identify and resolve issues quickly, minimizing disruption to your services. It centralizes alerting information in a single, searchable view that allows you to:

- Create and manage Grafana alerts
- Create and manage Grafana Mimir and Loki managed alerts
- View alerting information from Prometheus and Alertmanager compatible data sources

For new installations or existing installs without alerting configured, Grafana alerting is enabled by default.

| Release     | Cloud         | Enterprise    | OSS           |
| ----------- | ------------- | ------------- | ------------- |
| Grafana 9.0 | On by default | On by default | On by default |

- For existing OSS installations with legacy dashboard alerting, you can [opt-in]({{< relref "./opt-in.md" >}}) to Grafana alerting.
- For Grafana Cloud instances using legacy cloud alerting, contact customer support to migrate to Grafana alerting.

Before you begin, we recommend that you familiarize yourself with some of the [fundamental concepts]({{< relref "./fundamentals/_index.md" >}}) of Grafana alerting. Refer to [Role-based access control]({{< relref "../enterprise/access-control/_index.md" >}}) in Grafana Enterprise to learn more about controlling access to alerts using role-based permissions.

- [Enable Grafana alerting in OSS]({{< relref "./opt-in.md" >}})
- [Migrating legacy alerts]({{< relref "./migrating-legacy-alerts.md" >}})
- [Create Grafana managed alerting rules]({{< relref "alerting-rules/create-grafana-managed-rule.md" >}})
- [Create Grafana Mimir or Loki managed alerting rules]({{< relref "alerting-rules/create-mimir-loki-managed-rule.md" >}})
- [View existing alerting rules and manage their current state]({{< relref "alerting-rules/rule-list.md" >}})
- [View the state and health of alerting rules]({{< relref "./fundamentals/state-and-health.md" >}})
- [View alert groupings]({{< relref "./alert-groups/_index.md" >}})
- [Add or edit an alert contact point]({{< relref "./contact-points/_index.md" >}})
- [Add or edit notification policies]({{< relref "./notifications/_index.md" >}})
- [Add or edit silences]({{< relref "./silences/_index.md" >}})
