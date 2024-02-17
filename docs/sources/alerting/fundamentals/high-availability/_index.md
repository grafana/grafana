---
aliases:
  - ../high-availability/
  - ../unified-alerting/high-availability/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/high-availability/
description: Learn about high availability in Grafana Alerting
keywords:
  - grafana
  - alerting
  - tutorials
  - ha
  - high availability
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Alerting high availability
weight: 170
---

# Alerting high availability

Grafana Alerting uses the Prometheus model of separating the evaluation of alert rules from the delivering of notifications. In this model the evaluation of alert rules is done in the alert generator and the delivering of notifications is done in the alert receiver. In Grafana Alerting, the alert generator is the Scheduler and the receiver is the Alertmanager.

{{< figure src="/static/img/docs/alerting/unified/high-availability-ua.png" class="docs-image--no-shadow" max-width= "750px" caption="High availability" >}}

When running multiple instances of Grafana, all alert rules are evaluated on all instances. You can think of the evaluation of alert rules as being duplicated. This is how Grafana Alerting makes sure that as long as at least one Grafana instance is working, alert rules will still be evaluated and notifications for alerts will still be sent. You will see this duplication in state history, and is a good way to tell if you are using high availability.

While the alert generator evaluates all alert rules on all instances, the alert receiver makes a best-effort attempt to avoid sending duplicate notifications. Alertmanager chooses availability over consistency, which may result in occasional duplicated or out-of-order notifications. It takes the opinion that duplicate or out-of-order notifications are better than no notifications.

The Alertmanager uses a gossip protocol to share information about notifications between Grafana instances. It also gossips silences, which means a silence created on one Grafana instance is replicated to all other Grafana instances. Both notifications and silences are persisted to the database periodically, and during graceful shut down.

It is important to make sure that gossiping is configured and tested. You can find the documentation on how to do that [here][configure-high-availability].

## Useful links

[Configure alerting high availability][configure-high-availability]

{{% docs/reference %}}
[configure-high-availability]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-high-availability"
[configure-high-availability]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-high-availability"
{{% /docs/reference %}}
