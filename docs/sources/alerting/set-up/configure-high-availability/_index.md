---
aliases:
  - ../unified-alerting/high-availability/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/high-availability
  - ../high-availability/enable-alerting-ha/ # /docs/grafana/<GRAFANA_VERSION>/alerting/high-availability/enable-alerting-ha/
  - ../high-availability/ # /docs/grafana/<GRAFANA_VERSION>/alerting/high-availability
  - ../fundamentals/high-availability/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/high-availability
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-high-availability/
description: Configure High Availability
keywords:
  - grafana
  - alerting
  - tutorials
  - ha
  - high availability
labels:
  products:
    - enterprise
    - oss
title: Configure high availability
weight: 600
---

# Configure high availability

Grafana Alerting uses the Prometheus model of separating the evaluation of alert rules from the delivering of notifications. In this model, the evaluation of alert rules is done in the alert generator and the delivering of notifications is done in the alert receiver. In Grafana Alerting, the alert generator is the Scheduler and the receiver is the Alertmanager.

{{< figure src="/static/img/docs/alerting/unified/high-availability-ua.png" class="docs-image--no-shadow" max-width= "750px" caption="High availability" >}}

When running multiple instances of Grafana, all alert rules are evaluated on all instances. You can think of the evaluation of alert rules as being duplicated by the number of running Grafana instances. This is how Grafana Alerting makes sure that as long as at least one Grafana instance is working, alert rules will still be evaluated and notifications for alerts will still be sent.

You can find this duplication in state history and it is a good way to confirm if you are using high availability.

While the alert generator evaluates all alert rules on all instances, the alert receiver makes a best-effort attempt to avoid sending duplicate notifications. Alertmanager chooses availability over consistency, which may result in occasional duplicated or out-of-order notifications. It takes the opinion that duplicate or out-of-order notifications are better than no notifications.

The Alertmanager uses a gossip protocol to share information about notifications between Grafana instances. It also gossips silences, which means a silence created on one Grafana instance is replicated to all other Grafana instances. Both notifications and silences are persisted to the database periodically, and during graceful shut down.

{{% admonition type="note" %}}

If using a mix of `execute_alerts=false` and `execute_alerts=true` on the HA nodes, since the alert state is not shared amongst the Grafana instances, the instances with `execute_alerts=false` will not show any alert status.
This is because the HA settings (`ha_peers`, etc), only apply to the alert notification delivery (i.e. de-duplication of alert notifications, and silences, as mentioned above).

{{% /admonition %}}

## Enable alerting high availability using Memberlist

**Before you begin**

Since gossiping of notifications and silences uses both TCP and UDP port `9094`, ensure that each Grafana instance is able to accept incoming connections on these ports.

**To enable high availability support:**

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the `[unified_alerting]` section.
1. Set `[ha_peers]` to the number of hosts for each Grafana instance in the cluster (using a format of host:port), for example, `ha_peers=10.0.0.5:9094,10.0.0.6:9094,10.0.0.7:9094`.
   You must have at least one (1) Grafana instance added to the `ha_peers` section.
1. Set `[ha_listen_address]` to the instance IP address using a format of `host:port` (or the [Pod's](https://kubernetes.io/docs/concepts/workloads/pods/) IP in the case of using Kubernetes).
   By default, it is set to listen to all interfaces (`0.0.0.0`).
1. Set `[ha_peer_timeout]` in the `[unified_alerting]` section of the custom.ini to specify the time to wait for an instance to send a notification via the Alertmanager. The default value is 15s, but it may increase if Grafana servers are located in different geographic regions or if the network latency between them is high.

## Enable alerting high availability using Redis

As an alternative to Memberlist, you can use Redis for high availability. This is useful if you want to have a central
database for HA and cannot support the meshing of all Grafana servers.

1. Make sure you have a redis server that supports pub/sub. If you use a proxy in front of your redis cluster, make sure the proxy supports pub/sub.
1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the [unified_alerting] section.
1. Set `ha_redis_address` to the redis server address Grafana should connect to.
1. [Optional] Set the username and password if authentication is enabled on the redis server using `ha_redis_username` and `ha_redis_password`.
1. [Optional] Set `ha_redis_prefix` to something unique if you plan to share the redis server with multiple Grafana instances.

The following metrics can be used for meta monitoring, exposed by Grafana's `/metrics` endpoint:

| Metric                                               | Description                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| alertmanager_cluster_messages_received_total         | Total number of cluster messages received.                                                                     |
| alertmanager_cluster_messages_received_size_total    | Total size of cluster messages received.                                                                       |
| alertmanager_cluster_messages_sent_total             | Total number of cluster messages sent.                                                                         |
| alertmanager_cluster_messages_sent_size_total        | Total number of cluster messages received.                                                                     |
| alertmanager_cluster_messages_publish_failures_total | Total number of messages that failed to be published.                                                          |
| alertmanager_cluster_members                         | Number indicating current number of members in cluster.                                                        |
| alertmanager_peer_position                           | Position the Alertmanager instance believes it's in. The position determines a peer's behavior in the cluster. |
| alertmanager_cluster_pings_seconds                   | Histogram of latencies for ping messages.                                                                      |
| alertmanager_cluster_pings_failures_total            | Total number of failed pings.                                                                                  |

## Enable alerting high availability using Kubernetes

1. You can expose the pod IP [through an environment variable](https://kubernetes.io/docs/tasks/inject-data-application/environment-variable-expose-pod-information/) via the container definition.

   ```yaml
   env:
     - name: POD_IP
       valueFrom:
         fieldRef:
           fieldPath: status.podIP
   ```

1. Add the port 9094 to the Grafana deployment:

   ```yaml
   ports:
     - containerPort: 3000
       name: http-grafana
       protocol: TCP
     - containerPort: 9094
       name: grafana-alert
       protocol: TCP
   ```

1. Add the environment variables to the Grafana deployment:

   ```yaml
   env:
     - name: POD_IP
       valueFrom:
         fieldRef:
           fieldPath: status.podIP
   ```

1. Create a headless service that returns the pod IP instead of the service IP, which is what the `ha_peers` need:

   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: grafana-alerting
     namespace: grafana
     labels:
       app.kubernetes.io/name: grafana-alerting
       app.kubernetes.io/part-of: grafana
   spec:
     type: ClusterIP
     clusterIP: 'None'
     ports:
       - port: 9094
     selector:
       app: grafana
   ```

1. Make sure your grafana deployment has the label matching the selector, e.g. `app:grafana`:

1. Add in the grafana.ini:

   ```bash
   [unified_alerting]
   enabled = true
   ha_listen_address = "${POD_IP}:9094"
   ha_peers = "grafana-alerting.grafana:9094"
   ha_advertise_address = "${POD_IP}:9094"
   ha_peer_timeout = 15s
   ```
