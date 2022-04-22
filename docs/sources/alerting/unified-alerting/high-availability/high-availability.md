+++
title = " About high availability"
description = "High availability"
keywords = ["grafana", "alerting", "tutorials", "ha", "high availability"]
weight = 450
+++

# About high availability

The Grafana alerting system has two main components: a `Scheduler` and an internal `Alertmanager`. The `Scheduler` is responsible for the evaluation of your [alert rules]({{< relref "../fundamentals/evaluate-grafana-alerts.md" >}}) while the internal Alertmanager takes care of the **routing** and **grouping**.

When it comes to running Grafana alerting in high availability the operational mode of the scheduler is unaffected such that all alerts continue be evaluated in each Grafana instance. Rather the operational change happens in the Alertmanager which **deduplicates** alert notifications across Grafana instances.

{{< figure src="/static/img/docs/alerting/unified/high-availability-ua.png" class="docs-image--no-shadow" max-width= "750px" caption="High availability" >}}

The coordination between Grafana instances happens via [a Gossip protocol](https://en.wikipedia.org/wiki/Gossip_protocol). Alerts are not gossiped between instances. It is expected that each scheduler delivers the same alerts to each Alertmanager.

The two types of messages that are gossiped between instances are:

- Notification logs: Who (which instance) notified what (which alert)
- Silences: If an alert should fire or not

These two states are persisted in the database periodically and when Grafana is gracefully shutdown.
