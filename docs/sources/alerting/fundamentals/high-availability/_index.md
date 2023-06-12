---
aliases:
  - ../high-availability/
  - ../unified-alerting/high-availability/
description: High availability
keywords:
  - grafana
  - alerting
  - tutorials
  - ha
  - high availability
title: Alerting high availability
weight: 430
---

# Alerting high availability

The Grafana Alerting system has two main components: a `Scheduler` and an internal `Alertmanager`. The `Scheduler` evaluates your alert rules, while the internal Alertmanager manages **routing** and **grouping**.

When running Grafana Alerting in high availability, the operational mode of the scheduler remains unaffected, and each Grafana instance evaluates all alerts. The operational change happens in the Alertmanager when it deduplicates alert notifications across Grafana instances.

{{< figure src="/static/img/docs/alerting/unified/high-availability-ua.png" class="docs-image--no-shadow" max-width= "750px" caption="High availability" >}}

The coordination between Grafana instances happens via [a Gossip protocol](https://en.wikipedia.org/wiki/Gossip_protocol). Alerts are not gossiped between instances and each scheduler delivers the same volume of alerts to each Alertmanager.

The two types of messages gossiped between Grafana instances are:

- Notification logs: Who (which instance) notified what (which alert).
- Silences: If an alert should fire or not.

The notification logs and silences are persisted in the database periodically and during a graceful Grafana shut down.

## Useful links

[Configure alerting high availability]({{< relref "../../set-up/configure-high-availability" >}})
