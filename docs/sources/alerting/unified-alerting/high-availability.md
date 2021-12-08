+++
title = " Configure high availability"
description = "High Availability"
keywords = ["grafana", "alerting", "tutorials", "ha", "high availability"]
weight = 450
+++

# High availability

The Grafana alerting system has two main components: a `Scheduler` and an internal `Alertmanager`. The `Scheduler` is responsible for the evaluation of your [alert rules]({{< relref "./fundamentals/evaluate-grafana-alerts.md" >}}) while the internal Alertmanager takes care of the **routing** and **grouping**.

When it comes to running Grafana alerting in high availability the operational mode of the scheduler is unaffected such that all alerts continue be evaluated in each Grafana instance. Rather the operational change happens in the Alertmanager which **deduplicates** alert notifications across Grafana instances.

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

The coordination between Grafana instances happens via [a Gossip protocol](https://en.wikipedia.org/wiki/Gossip_protocol). Alerts are not gossiped between instances. It is expected that each scheduler delivers the same alerts to each Alertmanager.

The two types of messages that are gossiped between instances are:

- Notification logs: Who (which instance) notified what (which alert)
- Silences: If an alert should fire or not

These two states are persisted in the database periodically and when Grafana is gracefully shutdown.

## Enable high availability

To enable high availability support you need to add at least 1 Grafana instance to the [`[ha_peer]` configuration option]({{<relref"../../administration/configuration.md#unified_alerting">}}) within the `[unified_alerting]` section:

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the `[unified_alerting]` section.
2. Set `[ha_peers]` to the number of hosts for each grafana instance in the cluster (using a format of host:port) e.g. `ha_peers=10.0.0.5:9094,10.0.0.6:9094,10.0.0.7:9094`
3. Gossiping of notifications and silences uses both TCP and UDP port 9094. Each Grafana instance will need to be able to accept incoming connections on these ports.
4. Set `[ha_listen_address]` to the instance IP address using a format of host:port (or the [Pod's](https://kubernetes.io/docs/concepts/workloads/pods/) IP in the case of using Kubernetes) by default it is set to listen to all interfaces (`0.0.0.0`).

## Kubernetes

If you are using Kubernetes, you can connect the different Grafana Pod's by
using a headless service and DNS service discovery.

1. Create a headless service for you Grafana deployment, make sure to replace
   the `selector` part with the one that works for you.
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     labels:
       app.kubernetes.io/name: grafana
     name: grafana-headless
   spec:
     clusterIP: None
     ports:
       - port: 9094
         protocol: TCP
         targetPort: 9094
     selector:
       app.kubernetes.io/name: grafana
     type: ClusterIP
   ```
1. Change you `grafana.ini`, so that the instances running in the Pod's are
   using this service for service discovery.
   ```toml
   ...
   [unified_alerting]
     enabled = true
     ha_peers = "grafana-headless:9094"
   [alerting]
     enabled = false
   ```
1. Make sure that your headless service is working by checking if any endpoints
   were created by running the following command:
   `kubectl get endpoints grafana-headless -o jsonpath="{.subsets[].addresses[*].ip}" `.
   In the output you should see the instances IP.
   ```text
   10.244.0.4 10.244.0.5 10.244.0.7
   ```
1. Check your logs to see if the instances are connecting to each other. When
   starting the Pod's you should see one of those messages for every server in
   the cluster after a few seconds.
   ```text
   t=2021-12-08T08:59:57+0000 lvl=info msg="component=cluster level=debug received=NotifyJoin node=01FPCM9TZ2QBYS46N3RCV9MEKR addr=10.244.0.4:9094" logger=ngalert.multiorg.alertmanager
   ```
