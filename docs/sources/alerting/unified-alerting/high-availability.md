+++
title = "High Availability"
description = "High Availability"
keywords = ["grafana", "alerting", "tutorials", "ha", "high availability"]
weight = 450
+++

# High Availability - How does it work?

The Grafana alerting systems has two main components, the `Scheduler` and the internal `Alertmanager`. The `Scheduler` is responsible for the evaluation of your [alert rules]({{< relref "/fundamentals/evaluate-grafana-alerts.md" >}}) while the internal Alertmanager takes care of the **routing** and **grouping**.

When it comes to a highly available setup, the operational mode of the scheduler is unaffected. All alerts will be evaluated in every instance. The operational change happens in the Alertmanager, it is in charge of also **deduplicating** the alert notifications between Grafana instances.

```
  .─────.
 ╱       ╲                                                                      ┌────────────────┐
(  User   )──────┐                        ┌──────────────────────────────────┐  │                │
 `.     ,'       │                        │┌─────────┐      ┌──────────────┐ │  │                ▼
   `───'         │                        ││Scheduler│──────▶Alertmananager│─┼──┘    ┌──────────────────────┐
                 │      ┌───────────┐  ┌─▶│└─────────┘      ▲──────────────┤ │       │                      │
  .─────.        │      │   Load    │  │  │Grafana          │              │ │       │                      │
 ╱       ╲       │      │ Balancing │  │  └─────────────────┼──────────────┼─┘       │     Integrations     │
(  User   )──────┼─────▶│  Reverse  │──┤  ┌─────────────────┼──────────────┼─┐       │                      │
 `.     ,'       │      │   Proxy   │  │  │┌─────────┐      ├──────────────▼ │       │                      │
   `───'         │      └───────────┘  │  ││Scheduler│──────▶Alertmananager│─┼──┐    └──────────────────────┘
                 │                     └─▶│└─────────┘      └──────────────┘ │  │                ▲
  .─────.        │                        │Grafana                           │  │                │
 ╱       ╲       │                        └──────────────────────────────────┘  └────────────────┘
(  User   )──────┘
 `.     ,'
   `───'
```

The coordination between Grafana instances happens via [Gossip](https://en.wikipedia.org/wiki/Gossip_protocol). Alerts are not gossiped between instances. It is expected that each scheduler delivers the same alerts to each Alertmanager.

The two types of messages that are gossiped between instances are:

- Notification logs: Who (which instance) notified what (which alert)
- Silences: If an alert should fire or not

These two states are persisted in the database periodically and when Grafana is gracefully shutdown.

## Setup

To enable high availability support, you need to set the configuration [option `ha_peers` within the `[unified_alerting]` section]({{< relref "../../administration/configuration.md#unified_alerting" >}}). Setting this option to at least 1 peer will trigger the high availability mode for Grafana 8 Alerts. Communication happens using port 9094 on both UDP and TCP, so please make sure each instance has access on these.

The idea here is that you:

- Set `ha_peers` to the set of hosts for each grafana instance in the cluster (using a format of `host:port`) e.g. `ha_peers=10.0.0.5:9094,10.0.0.6:9094,10.0.0.7:9094`
- Set `ha_listen_address` to the instance (or the [Pod's](https://kubernetes.io/docs/concepts/workloads/pods/) IP (using a format of `host:port`) in the case of using Kubernetes) by default it is set to listen all interfaces (`0.0.0.0`).

## Kubernetes

### Grafana Pod IP

If using Kubernetes, you can expose the pod IP [through an environment variable](https://kubernetes.io/docs/tasks/inject-data-application/environment-variable-expose-pod-information/) via the container definition such as:

```bash
env:
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
```
